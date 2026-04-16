import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class WmApprovalService {
  private readonly logger = new Logger(WmApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  async listCategories() {
    return this.prisma.wmCategory.findMany({
      where: { orgId: DEV_ORG_ID },
      orderBy: { position: 'asc' },
    });
  }

  async createCategory(name: string) {
    const maxPos = await this.prisma.wmCategory.aggregate({
      where: { orgId: DEV_ORG_ID },
      _max: { position: true },
    });
    return this.prisma.wmCategory.create({
      data: {
        orgId: DEV_ORG_ID,
        name: name.trim(),
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.wmCategory.findFirst({ where: { id, orgId: DEV_ORG_ID } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden');
    await this.prisma.wmCategory.delete({ where: { id } });
    return { deleted: true };
  }

  // =========================================================================
  // APPROVAL PROJECT CREATION
  // =========================================================================

  /**
   * Creates an "approval" project with auto-generated columns:
   * [Entwurf] → [Approver1 Name] → [Approver2 Name] → ... → [Genehmigt]
   */
  async createApprovalProject(data: {
    name: string;
    description?: string;
    color?: string;
    createdBy: string;
    approverIds: string[];
  }) {
    if (!data.approverIds || data.approverIds.length === 0) {
      throw new BadRequestException('Mindestens ein Genehmiger erforderlich');
    }

    // Resolve approver names
    const approvers = await this.prisma.user.findMany({
      where: { id: { in: data.approverIds } },
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
    });
    const approverMap = new Map(approvers.map((u) => [u.id, u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0]]));

    // Validate all IDs exist
    for (const id of data.approverIds) {
      if (!approverMap.has(id)) throw new BadRequestException(`Benutzer ${id} nicht gefunden`);
    }

    const project = await this.prisma.wmProject.create({
      data: {
        orgId: DEV_ORG_ID,
        name: data.name,
        description: data.description || null,
        color: data.color || '#8B5CF6',
        projectType: 'approval',
        createdBy: data.createdBy,
      },
    });

    // Build columns: Entwurf → Approvers → Genehmigt
    const columns = [
      { name: 'Entwurf', color: '#6B7280', position: 0 },
      ...data.approverIds.map((id, i) => ({
        name: approverMap.get(id) || 'Unbekannt',
        color: '#3B82F6',
        position: i + 1,
      })),
      { name: 'Genehmigt', color: '#10B981', position: data.approverIds.length + 1 },
    ];

    await this.prisma.wmColumn.createMany({
      data: columns.map((col) => ({
        projectId: project.id,
        ...col,
      })),
    });

    // Auto-populate members
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        orgId: DEV_ORG_ID,
        status: 'active',
        OR: [{ role: { in: ['owner', 'admin'] } }, { menuPermissions: { has: 'work-management' } }],
      },
      select: { id: true, name: true, email: true },
    });
    if (eligibleUsers.length > 0) {
      await this.prisma.wmProjectMember.createMany({
        data: eligibleUsers.map((u) => ({
          projectId: project.id,
          userId: u.id,
          userName: u.name || u.email.split('@')[0],
          role: u.id === data.createdBy ? 'admin' : 'member',
        })),
        skipDuplicates: true,
      });
    }

    // Return full project
    return this.prisma.wmProject.findUnique({
      where: { id: project.id },
      include: {
        columns: { orderBy: { position: 'asc' } },
        members: true,
      },
    });
  }

  // =========================================================================
  // APPROVAL TASK LIFECYCLE
  // =========================================================================

  /**
   * Create a task in an approval project with designated approvers.
   * Task starts in "Entwurf" column with approvalStatus="draft".
   */
  async createApprovalTask(data: {
    projectId: string;
    title: string;
    description?: string;
    createdById: string;
    approverIds: string[];
    deadlineHours?: number;
  }) {
    const project = await this.prisma.wmProject.findUnique({
      where: { id: data.projectId },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!project) throw new NotFoundException('Projekt nicht gefunden');
    if (project.projectType !== 'approval') {
      throw new BadRequestException('Dieses Projekt ist kein Abnahme-Projekt');
    }

    const firstColumn = project.columns[0]; // "Entwurf"
    if (!firstColumn) throw new BadRequestException('Projekt hat keine Spalten');

    const task = await this.prisma.wmTask.create({
      data: {
        orgId: DEV_ORG_ID,
        projectId: data.projectId,
        columnId: firstColumn.id,
        title: data.title,
        description: data.description || null,
        createdById: data.createdById,
        priority: 'medium',
        approvalStatus: 'draft',
        approvalVersion: 1,
        position: 0,
      },
    });

    // Create approval steps
    await this.prisma.wmApprovalStep.createMany({
      data: data.approverIds.map((userId, i) => ({
        taskId: task.id,
        userId,
        position: i,
        status: 'pending',
        deadline: data.deadlineHours
          ? new Date(Date.now() + data.deadlineHours * 3600_000)
          : null,
        version: 1,
      })),
    });

    return this.getApprovalTaskDetail(task.id);
  }

  /**
   * Creator submits a draft task for approval — moves to first approver's column.
   */
  async submitForApproval(taskId: string, userId: string) {
    const task = await this.prisma.wmTask.findUnique({
      where: { id: taskId },
      include: {
        project: { include: { columns: { orderBy: { position: 'asc' } } } },
        approvalSteps: { orderBy: { position: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('Task nicht gefunden');
    if (task.createdById !== userId) throw new ForbiddenException('Nur der Ersteller kann einreichen');
    if (task.approvalStatus !== 'draft' && task.approvalStatus !== 'rejected') {
      throw new BadRequestException('Task ist nicht im Entwurf-Status');
    }

    // If resubmitting, increment version and reset all steps
    const isResubmit = task.approvalStatus === 'rejected';
    const newVersion = isResubmit ? task.approvalVersion + 1 : task.approvalVersion;

    if (isResubmit) {
      await this.prisma.wmApprovalStep.updateMany({
        where: { taskId, version: task.approvalVersion },
        data: { status: 'pending', comment: null, decidedAt: null },
      });
      await this.prisma.wmApprovalStep.updateMany({
        where: { taskId },
        data: { version: newVersion },
      });
    }

    // Move to first approver's column (position 1)
    const approverColumn = task.project.columns[1]; // position 1 = first approver
    if (!approverColumn) throw new BadRequestException('Keine Genehmiger-Spalte');

    await this.prisma.wmTask.update({
      where: { id: taskId },
      data: {
        columnId: approverColumn.id,
        approvalStatus: 'in_review',
        approvalVersion: newVersion,
      },
    });

    // Notify the first approver
    const firstStep = task.approvalSteps[0];
    if (firstStep) {
      await this.notify(firstStep.userId, taskId, task.projectId,
        'Abnahme angefragt',
        `"${task.title}" wartet auf deine Genehmigung (Version ${newVersion})`,
      );
    }

    // Log activity
    await this.logActivity(taskId, task.projectId, userId,
      isResubmit ? 'resubmitted' : 'submitted',
      isResubmit ? `Erneut eingereicht (Version ${newVersion})` : 'Zur Genehmigung eingereicht',
    );

    return this.getApprovalTaskDetail(taskId);
  }

  /**
   * Approver decides: approve (moves to next) or reject (back to draft).
   */
  async decide(taskId: string, userId: string, action: 'approved' | 'rejected', comment?: string) {
    if (action === 'rejected' && (!comment || !comment.trim())) {
      throw new BadRequestException('Bei Ablehnung ist ein Kommentar Pflicht');
    }

    const task = await this.prisma.wmTask.findUnique({
      where: { id: taskId },
      include: {
        project: { include: { columns: { orderBy: { position: 'asc' } } } },
        approvalSteps: { where: { version: undefined }, orderBy: { position: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('Task nicht gefunden');
    if (task.approvalStatus !== 'in_review') throw new BadRequestException('Task ist nicht in Prüfung');

    // Load current version's steps
    const steps = await this.prisma.wmApprovalStep.findMany({
      where: { taskId, version: task.approvalVersion },
      orderBy: { position: 'asc' },
    });

    // Find the current pending step for this user
    const myStep = steps.find((s) => s.userId === userId && s.status === 'pending');
    if (!myStep) throw new ForbiddenException('Du bist nicht der aktuelle Genehmiger');

    // Ensure it's this user's turn (all previous steps must be approved)
    const previousSteps = steps.filter((s) => s.position < myStep.position);
    const allPreviousApproved = previousSteps.every((s) => s.status === 'approved');
    if (!allPreviousApproved) throw new ForbiddenException('Vorherige Genehmiger muessen zuerst entscheiden');

    // Update the step
    await this.prisma.wmApprovalStep.update({
      where: { id: myStep.id },
      data: {
        status: action,
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
    });

    const columns = task.project.columns;

    if (action === 'rejected') {
      // Move back to first column (Entwurf)
      await this.prisma.wmTask.update({
        where: { id: taskId },
        data: { columnId: columns[0].id, approvalStatus: 'rejected' },
      });
      // Notify creator
      const rejectorName = await this.getUserName(userId);
      await this.notify(task.createdById, taskId, task.projectId,
        'Abnahme abgelehnt',
        `"${task.title}" wurde von ${rejectorName} abgelehnt: ${comment}`,
      );
      await this.logActivity(taskId, task.projectId, userId, 'rejected',
        `Abgelehnt von ${rejectorName}: ${comment}`);
    } else {
      // Approved — check if all steps done
      const nextStep = steps.find((s) => s.position === myStep.position + 1 && s.status === 'pending');
      const approverName = await this.getUserName(userId);

      if (nextStep) {
        // Move to next approver's column
        const nextColumn = columns[myStep.position + 2]; // +2 because columns[0]="Entwurf"
        if (nextColumn) {
          await this.prisma.wmTask.update({
            where: { id: taskId },
            data: { columnId: nextColumn.id },
          });
        }
        // Notify next approver
        await this.notify(nextStep.userId, taskId, task.projectId,
          'Abnahme angefragt',
          `"${task.title}" wartet auf deine Genehmigung`,
        );
      } else {
        // All approved — move to "Genehmigt" column (last)
        const approvedColumn = columns[columns.length - 1];
        await this.prisma.wmTask.update({
          where: { id: taskId },
          data: {
            columnId: approvedColumn.id,
            approvalStatus: 'approved',
            completed: true,
            completedAt: new Date(),
          },
        });
        // Notify creator
        await this.notify(task.createdById, taskId, task.projectId,
          'Abnahme genehmigt',
          `"${task.title}" wurde von allen genehmigt. Bitte weitere Schritte einleiten.`,
        );
      }
      await this.logActivity(taskId, task.projectId, userId, 'approved',
        `Genehmigt von ${approverName}${comment ? ': ' + comment : ''}`);
    }

    return this.getApprovalTaskDetail(taskId);
  }

  // =========================================================================
  // QUERIES
  // =========================================================================

  async getApprovalTaskDetail(taskId: string) {
    const task = await this.prisma.wmTask.findUnique({
      where: { id: taskId },
      include: {
        approvalSteps: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
        taskLabels: { include: { label: true } },
        subtasks: true,
        comments: { orderBy: { createdAt: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!task) throw new NotFoundException('Task nicht gefunden');

    // Enrich steps with user names
    const userIds = task.approvalSteps.map((s) => s.userId);
    if (task.createdById) userIds.push(task.createdById);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, firstName: true, email: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, {
      name: u.name || u.firstName || u.email.split('@')[0],
      avatarUrl: u.avatarUrl,
    }]));

    const enrichedSteps = task.approvalSteps.map((s) => ({
      ...s,
      userName: userMap.get(s.userId)?.name || 'Unbekannt',
      userAvatarUrl: userMap.get(s.userId)?.avatarUrl || null,
    }));

    const approvedCount = enrichedSteps.filter((s) => s.status === 'approved' && s.version === task.approvalVersion).length;
    const totalSteps = enrichedSteps.filter((s) => s.version === task.approvalVersion).length;

    return {
      ...task,
      approvalSteps: enrichedSteps,
      createdByName: userMap.get(task.createdById)?.name || 'Unbekannt',
      createdByAvatarUrl: userMap.get(task.createdById)?.avatarUrl || null,
      approvalProgress: { approved: approvedCount, total: totalSteps },
    };
  }

  /**
   * All tasks pending the current user's approval — for /home widget.
   */
  async getPendingApprovals(userId: string) {
    const pendingSteps = await this.prisma.wmApprovalStep.findMany({
      where: { userId, status: 'pending' },
      select: { taskId: true, position: true, deadline: true },
    });

    if (pendingSteps.length === 0) return [];

    const taskIds = pendingSteps.map((s) => s.taskId);
    const tasks = await this.prisma.wmTask.findMany({
      where: { id: { in: taskIds }, approvalStatus: 'in_review' },
      select: {
        id: true, title: true, projectId: true, createdById: true,
        approvalVersion: true, createdAt: true,
        project: { select: { name: true, color: true } },
        approvalSteps: { where: { version: undefined }, orderBy: { position: 'asc' } },
      },
    });

    // Filter: only tasks where ALL previous steps are approved (it's actually this user's turn)
    const result = [];
    for (const task of tasks) {
      const steps = await this.prisma.wmApprovalStep.findMany({
        where: { taskId: task.id, version: task.approvalVersion },
        orderBy: { position: 'asc' },
      });
      const myStep = steps.find((s) => s.userId === userId && s.status === 'pending');
      if (!myStep) continue;
      const previousApproved = steps.filter((s) => s.position < myStep.position).every((s) => s.status === 'approved');
      if (!previousApproved) continue;

      const pending = pendingSteps.find((s) => s.taskId === task.id);
      const approvedCount = steps.filter((s) => s.status === 'approved').length;

      result.push({
        taskId: task.id,
        title: task.title,
        projectName: task.project.name,
        projectColor: task.project.color,
        createdByName: await this.getUserName(task.createdById),
        progress: `${approvedCount}/${steps.length}`,
        deadline: pending?.deadline,
        version: task.approvalVersion,
      });
    }

    return result;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async getUserName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, firstName: true, email: true },
    });
    return u?.name || u?.firstName || u?.email?.split('@')[0] || 'Unbekannt';
  }

  private async notify(userId: string, taskId: string, projectId: string, title: string, message: string) {
    try {
      await this.prisma.wmNotification.create({
        data: { userId, type: 'approval', taskId, projectId, title, message },
      });
    } catch (err) {
      this.logger.warn(`Notification failed: ${err}`);
    }
  }

  private async logActivity(taskId: string, projectId: string, userId: string, action: string, details: string) {
    try {
      const userName = await this.getUserName(userId);
      await this.prisma.wmActivity.create({
        data: { taskId, projectId, userId, userName, action, details },
      });
    } catch (err) {
      this.logger.warn(`Activity log failed: ${err}`);
    }
  }
}
