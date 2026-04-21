import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SegmentService } from './segment.service';
import { EmailSenderService } from './email-sender.service';

@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private readonly batchPerTick = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly segments: SegmentService,
    private readonly sender: EmailSenderService,
  ) {}

  /**
   * Runs every minute. For scheduled campaigns whose time has come,
   * transitions them to 'sending'. For campaigns already in 'sending',
   * dispatches the next batchPerTick messages. Stops when segment
   * iteration is exhausted.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'campaign-dispatcher' })
  async dispatchCampaigns() {
    try {
      // Transition scheduled → sending if time has come
      await this.prisma.emailCampaign.updateMany({
        where: {
          status: 'scheduled',
          scheduledAt: { lte: new Date() },
        },
        data: { status: 'sending' },
      });

      // Pick one campaign currently sending (fairness: oldest first)
      const sending = await this.prisma.emailCampaign.findMany({
        where: { status: 'sending' },
        orderBy: { scheduledAt: 'asc' },
        take: 3, // process up to 3 campaigns in parallel per tick
      });

      for (const campaign of sending) {
        try {
          await this.processCampaignBatch(campaign.id);
        } catch (err: any) {
          this.logger.error(`Campaign ${campaign.id} batch failed: ${err?.message}`, err?.stack);
        }
      }
    } catch (err: any) {
      this.logger.error(`Dispatcher loop failed: ${err?.message}`, err?.stack);
    }
  }

  private async processCampaignBatch(campaignId: string): Promise<void> {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || !campaign.segmentId || !campaign.templateId) return;

    let sent = 0;

    try {
      // Iterate segment members. We skip already-sent by checking emailMessage
      for await (const batch of this.segments.iterateMembers(campaign.orgId, campaign.segmentId, 200)) {
        for (const contactId of batch) {
          if (sent >= this.batchPerTick) break;

          // Skip if already sent for this campaign
          const already = await this.prisma.emailMessage.findFirst({
            where: { campaignId, contactId, status: { notIn: ['failed'] } },
          });
          if (already) continue;

          const res = await this.sender.send({
            orgId: campaign.orgId,
            contactId,
            templateId: campaign.templateId,
            campaignId: campaign.id,
            fromName: campaign.fromName,
            fromEmail: campaign.fromEmail,
            replyTo: campaign.replyTo,
            consentMode: campaign.consentMode,
          });

          if (res.status === 'sent') sent++;
        }
        if (sent >= this.batchPerTick) break;
      }
    } catch (err: any) {
      this.logger.error(`Campaign ${campaignId} iteration failed: ${err?.message}`);
    }

    // Increment stats
    if (sent > 0) {
      await this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: sent },
          recipientsCount: { increment: sent },
        },
      });
    }

    // Check if we're done: segment cursor fully consumed, and no un-sent contacts remain
    // Heuristic: if this tick sent fewer than batchPerTick, we likely exhausted the segment
    if (sent < this.batchPerTick) {
      // Count outstanding members (those not yet sent)
      const totalSegmentMembers = await this.countSegmentMembers(campaign.orgId, campaign.segmentId);
      const sentCount = await this.prisma.emailMessage.count({
        where: { campaignId, status: { notIn: ['failed'] } },
      });
      if (sentCount >= totalSegmentMembers) {
        await this.prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { status: 'sent', sentAt: new Date() },
        });
        this.logger.log(`Campaign ${campaignId} completed — ${sentCount} sent`);
      }
    }
  }

  private async countSegmentMembers(orgId: string, segmentId: string): Promise<number> {
    const seg = await this.prisma.segment.findFirst({ where: { id: segmentId, orgId } });
    if (!seg) return 0;
    try {
      const where = await this.segments.buildWhere(orgId, seg.rules as any);
      return this.prisma.contact.count({ where });
    } catch {
      return seg.memberCount;
    }
  }
}
