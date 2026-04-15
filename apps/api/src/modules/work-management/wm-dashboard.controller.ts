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

@Controller('wm')
export class WmDashboardController {
  private readonly logger = new Logger(WmDashboardController.name);

  constructor(private readonly dashboardService: WmDashboardService) {}

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
}
