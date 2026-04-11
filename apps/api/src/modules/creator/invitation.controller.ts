import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

interface BulkInviteBody {
  creatorIds: string[];
  message?: string;
}

interface RespondBody {
  creatorId: string;
}

@Controller()
export class InvitationController {
  private readonly logger = new Logger(InvitationController.name);

  constructor(private readonly invitationService: InvitationService) {}

  @Post('creator-projects/:projectId/invitations/bulk')
  async bulkInvite(
    @Param('projectId') projectId: string,
    @Body() body: BulkInviteBody,
  ) {
    try {
      return await this.invitationService.sendBulkInvitations(
        DEV_ORG_ID,
        projectId,
        body?.creatorIds || [],
        body?.message,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to send bulk invitations', error);
      throw new HttpException(
        error?.message || 'Failed to send invitations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('creator-projects/:projectId/invitations')
  async listForProject(@Param('projectId') projectId: string) {
    try {
      return await this.invitationService.listByProject(DEV_ORG_ID, projectId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list project invitations', error);
      throw new HttpException(
        error?.message || 'Failed to load invitations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('creator/invitations/for-creator/:creatorId')
  async listForCreator(@Param('creatorId') creatorId: string) {
    try {
      return await this.invitationService.listForCreator(creatorId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list creator invitations', error);
      throw new HttpException(
        error?.message || 'Failed to load invitations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('creator/invitations/:id/accept')
  async accept(@Param('id') id: string, @Body() body: RespondBody) {
    try {
      if (!body?.creatorId) {
        throw new HttpException('creatorId is required', HttpStatus.BAD_REQUEST);
      }
      return await this.invitationService.accept(id, body.creatorId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to accept invitation', error);
      throw new HttpException(
        error?.message || 'Failed to accept invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('creator/invitations/:id/decline')
  async decline(@Param('id') id: string, @Body() body: RespondBody) {
    try {
      if (!body?.creatorId) {
        throw new HttpException('creatorId is required', HttpStatus.BAD_REQUEST);
      }
      return await this.invitationService.decline(id, body.creatorId);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to decline invitation', error);
      throw new HttpException(
        error?.message || 'Failed to decline invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
