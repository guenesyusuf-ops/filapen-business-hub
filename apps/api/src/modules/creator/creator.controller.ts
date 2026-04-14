import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatorService } from './creator.service';
import { DealService } from './deal.service';
import { BriefingService } from './briefing.service';
import { UploadService } from './upload.service';
import { CommentService } from './comment.service';
import { ProjectService } from './project.service';
import { ChatService } from './chat.service';
import { NotificationService } from './notification.service';
import { EmailService } from '../../common/email/email.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Controller()
export class CreatorController {
  private readonly logger = new Logger(CreatorController.name);

  constructor(
    private readonly creatorService: CreatorService,
    private readonly dealService: DealService,
    private readonly briefingService: BriefingService,
    private readonly uploadService: UploadService,
    private readonly commentService: CommentService,
    private readonly projectService: ProjectService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  // =========================================================================
  // CREATORS
  // =========================================================================

  @Get('creators')
  async listCreators(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('niche') niche?: string,
    @Query('platform') platform?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '25', 10) || 25));

    try {
      return await this.creatorService.list(DEV_ORG_ID, {
        search,
        status,
        niche,
        platform,
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to list creators', error);
      throw new HttpException('Failed to load creators', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creators/stats')
  async getCreatorStats() {
    try {
      return await this.creatorService.getStats(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get creator stats', error);
      throw new HttpException('Failed to load creator stats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creators/:id')
  async getCreator(@Param('id') id: string) {
    try {
      return await this.creatorService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get creator', error);
      throw new HttpException('Failed to load creator', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('creators')
  async createCreator(@Body() body: any) {
    try {
      const creator = await this.creatorService.create(DEV_ORG_ID, body);

      // Attempt to send invite email (graceful — does not fail the request)
      let emailSent = false;
      if (creator.email && creator.inviteCode) {
        const appUrl =
          this.configService.get<string>('APP_URL') ||
          'http://localhost:3000';
        emailSent = await this.emailService.sendCreatorInvite({
          to: creator.email,
          creatorName: creator.name,
          inviteCode: creator.inviteCode,
          inviteLink: `${appUrl}/creator-portal?code=${creator.inviteCode}`,
        });
      }

      return { ...creator, emailSent };
    } catch (error) {
      this.logger.error('Failed to create creator', error);
      throw new HttpException(
        error.message || 'Failed to create creator',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('creators/:id')
  async updateCreator(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.creatorService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update creator', error);
      throw new HttpException('Failed to update creator', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('creators/:id')
  async deleteCreator(@Param('id') id: string) {
    try {
      return await this.creatorService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete creator', error);
      throw new HttpException('Failed to delete creator', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // DEALS
  // =========================================================================

  @Get('deals')
  async listDeals(
    @Query('stage') stage?: string,
    @Query('creatorId') creatorId?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '25', 10) || 25));

    try {
      return await this.dealService.list(DEV_ORG_ID, {
        stage,
        creatorId,
        type,
        search,
        startDate,
        endDate,
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to list deals', error);
      throw new HttpException('Failed to load deals', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('deals/kanban')
  async getKanban() {
    try {
      return await this.dealService.getKanban(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get kanban', error);
      throw new HttpException('Failed to load kanban data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('deals/pipeline')
  async getPipelineStats() {
    try {
      return await this.dealService.getPipelineStats(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get pipeline stats', error);
      throw new HttpException('Failed to load pipeline stats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('deals/:id')
  async getDeal(@Param('id') id: string) {
    try {
      return await this.dealService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get deal', error);
      throw new HttpException('Failed to load deal', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('deals')
  async createDeal(@Body() body: any) {
    try {
      return await this.dealService.create(DEV_ORG_ID, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create deal', error);
      throw new HttpException(
        error.message || 'Failed to create deal',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('deals/:id')
  async updateDeal(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.dealService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update deal', error);
      throw new HttpException('Failed to update deal', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('deals/:id/stage')
  async moveDealStage(@Param('id') id: string, @Body() body: { stage: string }) {
    try {
      return await this.dealService.moveStage(DEV_ORG_ID, id, body.stage);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to move deal stage', error);
      throw new HttpException('Failed to move deal stage', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // BRIEFINGS
  // =========================================================================

  @Get('briefings')
  async listBriefings(@Query('dealId') dealId: string) {
    if (!dealId) {
      throw new HttpException('dealId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.briefingService.listByDeal(DEV_ORG_ID, dealId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list briefings', error);
      throw new HttpException('Failed to load briefings', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('briefings/:id')
  async getBriefing(@Param('id') id: string) {
    try {
      return await this.briefingService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get briefing', error);
      throw new HttpException('Failed to load briefing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('briefings')
  async createBriefing(@Body() body: any) {
    try {
      return await this.briefingService.create(DEV_ORG_ID, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create briefing', error);
      throw new HttpException(
        error.message || 'Failed to create briefing',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('briefings/:id')
  async updateBriefing(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.briefingService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update briefing', error);
      throw new HttpException('Failed to update briefing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('briefings/:id')
  async deleteBriefing(@Param('id') id: string) {
    try {
      return await this.briefingService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete briefing', error);
      throw new HttpException('Failed to delete briefing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // CREATOR UPLOADS
  // =========================================================================

  @Get('creator-uploads/unseen-count')
  async getUnseenUploadCount() {
    try {
      return await this.uploadService.unseenCount(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get unseen upload count', error);
      throw new HttpException('Failed to get unseen count', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator-uploads/live')
  async listLiveUploads() {
    try {
      return await this.uploadService.listLive(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to list live uploads', error);
      throw new HttpException('Failed to load live uploads', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator-uploads/all')
  async listAllUploads(
    @Query('tab') tab?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '25', 10) || 25));
    try {
      return await this.uploadService.listAll(DEV_ORG_ID, { tab, page, pageSize });
    } catch (error) {
      this.logger.error('Failed to list all uploads', error);
      throw new HttpException('Failed to load uploads', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator-uploads')
  async listUploads(
    @Query('creatorId') creatorId: string,
    @Query('tab') tab?: string,
  ) {
    if (!creatorId) {
      throw new HttpException('creatorId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.uploadService.list(DEV_ORG_ID, { creatorId, tab });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list uploads', error);
      throw new HttpException('Failed to load uploads', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('creator-uploads')
  async createUpload(@Body() body: any) {
    try {
      return await this.uploadService.create(DEV_ORG_ID, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create upload', error);
      throw new HttpException(
        error.message || 'Failed to create upload',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('creator-uploads/:id/go-live')
  async goLiveUpload(@Param('id') id: string, @Body() body: { liveDate: string; notifyCreator?: boolean }) {
    if (!body.liveDate) {
      throw new HttpException('liveDate is required', HttpStatus.BAD_REQUEST);
    }
    const notifyCreator = body.notifyCreator !== false; // default true
    try {
      const result = await this.uploadService.goLive(DEV_ORG_ID, id, body.liveDate, notifyCreator);
      // Send chat notification to creator
      try {
        const dateStr = new Date(body.liveDate).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        await this.chatService.sendMessage(DEV_ORG_ID, result.creatorId, {
          message: `Dein Content '${result.label || result.fileName}' geht am ${dateStr} live! 🎉`,
          senderRole: 'admin',
          senderName: 'Filapen Team',
        });
      } catch (chatErr) {
        this.logger.warn('Failed to send go-live chat notification', chatErr);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to go live', error);
      throw new HttpException('Failed to set upload live', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // CREATOR NOTIFICATIONS
  // =========================================================================

  @Get('creator-notifications/:creatorId')
  async listNotifications(
    @Param('creatorId') creatorId: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(50, Math.max(1, parseInt(limitStr || '20', 10) || 20));
    try {
      return await this.notificationService.listByCreator(DEV_ORG_ID, creatorId, limit);
    } catch (error) {
      this.logger.error('Failed to list notifications', error);
      throw new HttpException('Failed to load notifications', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator-notifications/:creatorId/unread-count')
  async getUnreadNotificationCount(@Param('creatorId') creatorId: string) {
    try {
      return await this.notificationService.unreadCount(DEV_ORG_ID, creatorId);
    } catch (error) {
      this.logger.error('Failed to get unread notification count', error);
      throw new HttpException('Failed to get unread count', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('creator-notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    try {
      return await this.notificationService.markAsRead(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to mark notification as read', error);
      throw new HttpException('Failed to mark as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('creator-notifications/:creatorId/read-all')
  async markAllNotificationsRead(@Param('creatorId') creatorId: string) {
    try {
      return await this.notificationService.markAllAsRead(DEV_ORG_ID, creatorId);
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read', error);
      throw new HttpException('Failed to mark all as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('creator-uploads/:id/go-offline')
  async goOfflineUpload(@Param('id') id: string) {
    try {
      const result = await this.uploadService.goOffline(DEV_ORG_ID, id);
      // Send chat notification to creator
      try {
        await this.chatService.sendMessage(DEV_ORG_ID, result.creatorId, {
          message: `Dein Content '${result.label || result.fileName}' ist jetzt offline. Deine Analyse kommt bald.`,
          senderRole: 'admin',
          senderName: 'Filapen Team',
        });
      } catch (chatErr) {
        this.logger.warn('Failed to send go-offline chat notification', chatErr);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to go offline', error);
      throw new HttpException('Failed to set upload offline', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('creator-uploads/:id')
  async deleteUpload(@Param('id') id: string) {
    try {
      return await this.uploadService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete upload', error);
      throw new HttpException('Failed to delete upload', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('creator-uploads/mark-seen')
  async markUploadsSeen(@Body() body: { creatorId: string }) {
    if (!body.creatorId) {
      throw new HttpException('creatorId is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.uploadService.markSeen(DEV_ORG_ID, body.creatorId);
    } catch (error) {
      this.logger.error('Failed to mark uploads as seen', error);
      throw new HttpException('Failed to mark uploads as seen', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // UPLOAD COMMENTS
  // =========================================================================

  @Get('upload-comments')
  async listComments(@Query('uploadId') uploadId: string) {
    if (!uploadId) {
      throw new HttpException('uploadId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.commentService.listByUpload(DEV_ORG_ID, uploadId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list comments', error);
      throw new HttpException('Failed to load comments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('upload-comments')
  async createComment(@Body() body: any) {
    try {
      return await this.commentService.create(DEV_ORG_ID, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create comment', error);
      throw new HttpException(
        error.message || 'Failed to create comment',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('upload-comments/mark-read')
  async markCommentsRead(@Body() body: { uploadId: string; role: 'admin' | 'creator' }) {
    if (!body.uploadId || !body.role) {
      throw new HttpException('uploadId and role are required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.commentService.markRead(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to mark comments as read', error);
      throw new HttpException('Failed to mark comments as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // CREATOR PROJECTS
  // =========================================================================

  @Get('creator-projects')
  async listProjects() {
    try {
      return await this.projectService.list(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to list projects', error);
      throw new HttpException('Failed to load projects', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator-projects/:id')
  async getProject(@Param('id') id: string) {
    try {
      return await this.projectService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get project', error);
      throw new HttpException('Failed to load project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('creator-projects')
  async createProject(@Body() body: any) {
    try {
      return await this.projectService.create(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create project', error);
      throw new HttpException(
        error.message || 'Failed to create project',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('creator-projects/:id')
  async updateProject(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.projectService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update project', error);
      throw new HttpException('Failed to update project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('creator-projects/:id')
  async deleteProject(@Param('id') id: string) {
    try {
      return await this.projectService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete project', error);
      throw new HttpException('Failed to delete project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // RESEND INVITE
  // =========================================================================

  @Post('creators/:id/resend-invite')
  async resendInvite(@Param('id') id: string) {
    try {
      const creator = await this.creatorService.getById(DEV_ORG_ID, id);
      if (!creator.email || !creator.inviteCode) {
        throw new HttpException(
          'Creator has no email or invite code',
          HttpStatus.BAD_REQUEST,
        );
      }

      const appUrl =
        this.configService.get<string>('APP_URL') ||
        'http://localhost:3000';
      const emailSent = await this.emailService.sendCreatorInvite({
        to: creator.email,
        creatorName: creator.name,
        inviteCode: creator.inviteCode,
        inviteLink: `${appUrl}/creator-portal?code=${creator.inviteCode}`,
      });

      return { success: true, emailSent };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to resend invite', error);
      throw new HttpException('Failed to resend invite', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // CHAT
  // =========================================================================

  @Get('chat/:creatorId')
  async getChatMessages(@Param('creatorId') creatorId: string) {
    try {
      return await this.chatService.getMessages(DEV_ORG_ID, creatorId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get chat messages', error);
      throw new HttpException('Failed to load chat messages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('chat/:creatorId')
  async sendChatMessage(
    @Param('creatorId') creatorId: string,
    @Body() body: { message: string; senderRole: string; senderName: string },
  ) {
    if (!body.message || !body.senderRole || !body.senderName) {
      throw new HttpException(
        'message, senderRole, and senderName are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.chatService.sendMessage(DEV_ORG_ID, creatorId, {
        message: body.message,
        senderRole: body.senderRole as 'admin' | 'creator',
        senderName: body.senderName,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to send chat message', error);
      throw new HttpException('Failed to send message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('chat/:creatorId/read')
  async markChatRead(
    @Param('creatorId') creatorId: string,
    @Body() body: { role: 'admin' | 'creator' },
  ) {
    if (!body.role) {
      throw new HttpException('role is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.chatService.markRead(DEV_ORG_ID, creatorId, body.role);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to mark chat as read', error);
      throw new HttpException('Failed to mark as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // CREATOR PORTAL AUTH
  // =========================================================================

  @Post('creator-auth')
  async creatorAuth(@Body() body: { inviteCode: string }) {
    if (!body.inviteCode) {
      throw new HttpException('inviteCode is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const creator = await this.creatorService.findByInviteCode(body.inviteCode.toUpperCase());
      await this.creatorService.updateLastLogin(creator.id);
      // For MVP, return creator data directly (JWT can be added later)
      return { creator, token: `creator-${creator.id}` };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Creator auth failed', error);
      throw new HttpException('Invalid invite code', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('creator-portal/me')
  async getCreatorPortalProfile(@Query('creatorId') creatorId: string) {
    if (!creatorId) {
      throw new HttpException('creatorId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      // For portal, we need to look up the creator without requiring orgId from the caller
      return await this.creatorService.getById(DEV_ORG_ID, creatorId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get creator portal profile', error);
      throw new HttpException('Failed to load profile', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('creator-portal/me')
  async updateCreatorPortalProfile(
    @Query('creatorId') creatorId: string,
    @Body() body: any,
  ) {
    if (!creatorId) {
      throw new HttpException('creatorId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      // Only allow certain fields to be updated by the creator
      const allowedFields: any = {};
      if (body.avatarUrl !== undefined) allowedFields.avatarUrl = body.avatarUrl;
      if (body.phone !== undefined) allowedFields.phone = body.phone;
      if (body.location !== undefined) allowedFields.location = body.location;
      return await this.creatorService.update(DEV_ORG_ID, creatorId, allowedFields);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update creator portal profile', error);
      throw new HttpException('Failed to update profile', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
