import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';

const DEFAULT_EXPIRY_DAYS = 7;

export interface BulkInviteResult {
  created: number;
  skipped: number;
  emailsSent: number;
  invitations: Array<{ id: string; creatorId: string; status: string }>;
}

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async sendBulkInvitations(
    orgId: string,
    projectId: string,
    creatorIds: string[],
    message?: string,
  ): Promise<BulkInviteResult> {
    if (!Array.isArray(creatorIds) || creatorIds.length === 0) {
      throw new BadRequestException('creatorIds is required');
    }

    const project = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const creators = await this.prisma.creator.findMany({
      where: { id: { in: creatorIds }, orgId },
      select: { id: true, name: true, email: true },
    });

    if (creators.length === 0) {
      throw new BadRequestException('No valid creators found for this organization');
    }

    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    let created = 0;
    let skipped = 0;
    let emailsSent = 0;
    const invitations: BulkInviteResult['invitations'] = [];

    for (const creator of creators) {
      try {
        const invitation = await this.prisma.projectInvitation.create({
          data: {
            orgId,
            projectId,
            creatorId: creator.id,
            status: 'pending',
            expiresAt,
            message: message || null,
          },
        });
        created += 1;
        invitations.push({
          id: invitation.id,
          creatorId: creator.id,
          status: 'pending',
        });

        if (creator.email) {
          const sent = await this.sendInvitationEmail(creator, project);
          if (sent) emailsSent += 1;
        }
      } catch (err: any) {
        // Unique constraint (projectId, creatorId) -> already invited
        if (err?.code === 'P2002') {
          skipped += 1;
          continue;
        }
        this.logger.error(
          `Failed to create invitation for creator ${creator.id}: ${err.message || err}`,
        );
        skipped += 1;
      }
    }

    return { created, skipped, emailsSent, invitations };
  }

  async listByProject(orgId: string, projectId: string) {
    const project = await this.prisma.creatorProject.findFirst({
      where: { id: projectId, orgId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const invitations = await this.prisma.projectInvitation.findMany({
      where: { projectId, orgId },
      orderBy: { invitedAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            handle: true,
            platform: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    return invitations.map((inv) => this.serialize(inv));
  }

  async listForCreator(creatorId: string) {
    const invitations = await this.prisma.projectInvitation.findMany({
      where: { creatorId },
      orderBy: { invitedAt: 'desc' },
      include: {
        project: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                handle: true,
              },
            },
          },
        },
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      orgId: inv.orgId,
      status: inv.status,
      invitedAt: inv.invitedAt.toISOString(),
      respondedAt: inv.respondedAt ? inv.respondedAt.toISOString() : null,
      expiresAt: inv.expiresAt.toISOString(),
      message: inv.message,
      project: {
        id: inv.project.id,
        name: inv.project.name,
        description: inv.project.description,
        status: inv.project.status,
        campaignType: (inv.project as any).campaignType ?? null,
        action: (inv.project as any).action ?? null,
        startDate: (inv.project as any).startDate
          ? (inv.project as any).startDate.toISOString().slice(0, 10)
          : null,
        deadline: inv.project.deadline
          ? inv.project.deadline.toISOString().slice(0, 10)
          : null,
        neededCreators: (inv.project as any).neededCreators ?? 0,
        product: (inv.project as any).product
          ? {
              id: (inv.project as any).product.id,
              title: (inv.project as any).product.title,
              imageUrl: (inv.project as any).product.imageUrl,
              handle: (inv.project as any).product.handle,
            }
          : null,
      },
    }));
  }

  async accept(invitationId: string, creatorId: string) {
    return this.respond(invitationId, creatorId, 'accepted');
  }

  async decline(invitationId: string, creatorId: string) {
    return this.respond(invitationId, creatorId, 'declined');
  }

  private async respond(
    invitationId: string,
    creatorId: string,
    nextStatus: 'accepted' | 'declined',
  ) {
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.creatorId !== creatorId) {
      throw new ForbiddenException('You cannot respond to this invitation');
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status}`,
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.projectInvitation.update({
        where: { id: invitationId },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    const updated = await this.prisma.projectInvitation.update({
      where: { id: invitationId },
      data: {
        status: nextStatus,
        respondedAt: new Date(),
      },
    });

    // If accepted: optionally add creatorId to project.creatorIds (legacy sync)
    if (nextStatus === 'accepted') {
      try {
        const project = await this.prisma.creatorProject.findUnique({
          where: { id: invitation.projectId },
          select: { id: true, creatorIds: true },
        });
        if (project && !project.creatorIds.includes(creatorId)) {
          await this.prisma.creatorProject.update({
            where: { id: project.id },
            data: { creatorIds: { set: [...project.creatorIds, creatorId] } },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to sync creatorIds after accept: ${err.message || err}`);
      }
    }

    return {
      id: updated.id,
      status: updated.status,
      respondedAt: updated.respondedAt ? updated.respondedAt.toISOString() : null,
    };
  }

  /**
   * Cron helper — expires all pending invitations whose expiresAt has passed.
   */
  async expire(): Promise<{ expired: number }> {
    const result = await this.prisma.projectInvitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} project invitations`);
    }
    return { expired: result.count };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private serialize(inv: any) {
    return {
      id: inv.id,
      orgId: inv.orgId,
      projectId: inv.projectId,
      creatorId: inv.creatorId,
      status: inv.status,
      invitedAt: inv.invitedAt.toISOString(),
      respondedAt: inv.respondedAt ? inv.respondedAt.toISOString() : null,
      expiresAt: inv.expiresAt.toISOString(),
      message: inv.message,
      creator: inv.creator ?? null,
    };
  }

  private async sendInvitationEmail(
    creator: { id: string; name: string; email: string | null },
    project: { id: string; name: string },
  ): Promise<boolean> {
    if (!creator.email) return false;

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'https://app.filapen.com';
    const portalLink = `${frontendUrl.replace(/\/$/, '')}/portal`;

    return this.emailService.sendProjectInvitationEmail({
      to: creator.email,
      creatorName: creator.name,
      projectName: project.name,
      portalLink,
    });
  }
}
