import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WmDashboardService } from './wm-dashboard.service';
import { WmNotificationService } from './wm-notification.service';

@Controller('wm')
export class WmDashboardController {
  private readonly logger = new Logger(WmDashboardController.name);

  constructor(
    private readonly dashboardService: WmDashboardService,
    private readonly notificationService: WmNotificationService,
  ) {}

  // =========================================================================
  // DASHBOARD KPIs
  // =========================================================================

  @Get('dashboard')
  async getDashboard() {
    try {
      return await this.dashboardService.getDashboard();
    } catch (error) {
      this.logger.error('getDashboard failed', error);
      throw new HttpException('Failed to get dashboard data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // MY TASKS
  // =========================================================================

  @Get('my-tasks')
  async getMyTasks() {
    try {
      return await this.dashboardService.getMyTasks();
    } catch (error) {
      this.logger.error('getMyTasks failed', error);
      throw new HttpException('Failed to get my tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // AUTO-COMPLETE TRIGGER
  // =========================================================================

  @Patch('tasks/:id/auto-complete')
  async autoCompleteTask(@Param('id') id: string) {
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
  ) {
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
  async listProjectsWithCategory() {
    try {
      return await this.dashboardService.listProjectsWithCategory();
    } catch (error) {
      this.logger.error('listProjectsWithCategory failed', error);
      throw new HttpException('Failed to list projects', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // NOTIFICATIONS (Feature 2)
  // =========================================================================

  @Get('notifications')
  async getNotifications() {
    try {
      return await this.notificationService.getNotifications();
    } catch (error) {
      this.logger.error('getNotifications failed', error);
      throw new HttpException('Failed to get notifications', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('notifications/unread-count')
  async getUnreadCount() {
    try {
      return await this.notificationService.getUnreadCount();
    } catch (error) {
      this.logger.error('getUnreadCount failed', error);
      throw new HttpException('Failed to get unread count', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    try {
      return await this.notificationService.markAsRead(id);
    } catch (error) {
      this.logger.error('markNotificationRead failed', error);
      throw new HttpException('Failed to mark notification as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('notifications/read-all')
  async markAllNotificationsRead() {
    try {
      return await this.notificationService.markAllAsRead();
    } catch (error) {
      this.logger.error('markAllNotificationsRead failed', error);
      throw new HttpException('Failed to mark all as read', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // BURNDOWN CHART (Feature 3)
  // =========================================================================

  @Get('projects/:id/burndown')
  async getBurndown(@Param('id') projectId: string) {
    try {
      return await this.dashboardService.getBurndownData(projectId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getBurndown failed', error);
      throw new HttpException('Failed to get burndown data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
