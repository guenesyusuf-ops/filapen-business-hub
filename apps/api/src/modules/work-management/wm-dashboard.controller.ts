import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
  UnauthorizedException,} from '@nestjs/common';
import { WmDashboardService } from './wm-dashboard.service';
import { WmNotificationService } from './wm-notification.service';
import { AuthService } from '../auth/auth.service';

@Controller('wm')
export class WmDashboardController {
  private readonly logger = new Logger(WmDashboardController.name);

  constructor(
    private readonly dashboardService: WmDashboardService,
    private readonly notificationService: WmNotificationService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string | undefined {
    if (!authHeader) throw new UnauthorizedException('Kein gueltiger Token');
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') throw new UnauthorizedException('Kein gueltiger Token');
    try {
      return this.auth.validateToken(parts[1]).sub;
    } catch {
      throw new UnauthorizedException('Kein gueltiger Token');
    }
  }

  // =========================================================================
  // DASHBOARD KPIs
  // =========================================================================

  @Get('dashboard')
  async getDashboard(@Headers('authorization') authHeader?: string) {
    this.extractUserId(authHeader);
    try {
      return await this.dashboardService.getDashboard();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getDashboard failed', error);
      throw new HttpException('Failed to get dashboard data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('dashboard/bucket')
  async getTasksByBucket(@Query('bucket') bucket?: string, @Headers('authorization') authHeader?: string) {
    this.extractUserId(authHeader);
    const allowed = ['open', 'overdue', 'today', 'completed7d'] as const;
    if (!bucket || !allowed.includes(bucket as any)) {
      throw new HttpException(`Invalid bucket. Allowed: ${allowed.join(', ')}`, HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.dashboardService.getTasksByBucket(bucket as typeof allowed[number]);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`getTasksByBucket(${bucket}) failed`, error);
      throw new HttpException('Failed to load tasks for bucket', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // MY TASKS
  // =========================================================================

  @Get('my-tasks')
  async getMyTasks(@Headers('authorization') authHeader: string) {
    try {
      const userId = this.extractUserId(authHeader);
      return await this.dashboardService.getMyTasks(userId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getMyTasks failed', error);
      throw new HttpException('Failed to get my tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // AUTO-COMPLETE TRIGGER
  // =========================================================================

  @Patch('tasks/:id/auto-complete')
  async autoCompleteTask(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    this.extractUserId(authHeader);
    try {
      return await this.dashboardService.checkCompletionTrigger(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('autoCompleteTask failed', error);
      throw new HttpException('Failed to auto-complete task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // PROJECT CATEGORY
  // =========================================================================

  @Patch('projects/:id/category')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { category: string | null },
    @Headers('authorization') authHeader?: string,
  ) {
      this.extractUserId(authHeader);
    try {
      await this.dashboardService.updateProjectCategory(id, body.category);
      return { updated: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('updateCategory failed', error);
      throw new HttpException('Failed to update category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('projects-with-category')
  async listProjectsWithCategory(@Headers('authorization') authHeader?: string) {
    this.extractUserId(authHeader);
    try {
      return await this.dashboardService.listProjectsWithCategory();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('listProjectsWithCategory failed', error);
      throw new HttpException('Failed to list projects', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // NOTIFICATIONS (Feature 2)
  // =========================================================================

  @Get('notifications')
  async getNotifications(@Headers('authorization') authHeader: string) {
    try {
      const userId = this.extractUserId(authHeader);
      return await this.notificationService.getNotifications(userId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getNotifications failed', error);
      throw new HttpException('Failed to get notifications', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Headers('authorization') authHeader: string) {
    try {
      const userId = this.extractUserId(authHeader);
      return await this.notificationService.getUnreadCount(userId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getUnreadCount failed', error);
      throw new HttpException('Failed to get unread count', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    this.extractUserId(authHeader);
    try {
      return await this.notificationService.markAsRead(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('markNotificationRead failed', error);
      throw new HttpException('Failed to mark notification as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('notifications/read-all')
  async markAllNotificationsRead(@Headers('authorization') authHeader: string) {
    try {
      const userId = this.extractUserId(authHeader);
      return await this.notificationService.markAllAsRead(userId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('markAllNotificationsRead failed', error);
      throw new HttpException('Failed to mark all as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // BURNDOWN CHART (Feature 3)
  // =========================================================================

  @Get('projects/:id/burndown')
  async getBurndown(@Param('id') projectId: string, @Headers('authorization') authHeader?: string) {
    this.extractUserId(authHeader);
    try {
      return await this.dashboardService.getBurndownData(projectId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getBurndown failed', error);
      throw new HttpException('Failed to get burndown data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
