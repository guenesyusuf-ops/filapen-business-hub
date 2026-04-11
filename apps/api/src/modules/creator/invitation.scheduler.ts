import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvitationService } from './invitation.service';

/**
 * InvitationScheduler
 *
 * Hourly cron job that expires pending project invitations
 * whose expiresAt timestamp has passed.
 */
@Injectable()
export class InvitationScheduler {
  private readonly logger = new Logger(InvitationScheduler.name);

  constructor(private readonly invitationService: InvitationService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireOldInvitations() {
    try {
      const result = await this.invitationService.expire();
      if (result.expired > 0) {
        this.logger.log(`Expired ${result.expired} project invitations`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to run invitation expiration: ${error?.message || error}`,
      );
    }
  }
}
