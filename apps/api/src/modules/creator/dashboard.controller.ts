import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { UploadService } from './upload.service';
import { CalendarNoteService } from './calendar-note.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Controller()
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly uploadService: UploadService,
    private readonly calendarNoteService: CalendarNoteService,
  ) {}

  // =========================================================================
  // CREATOR DASHBOARD
  // =========================================================================

  @Get('creator/dashboard-stats')
  async getDashboardStats() {
    try {
      return await this.dashboardService.getStats(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to load dashboard stats', error as Error);
      throw new HttpException('Failed to load dashboard stats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator/creators-without-uploads')
  async getCreatorsWithoutUploads() {
    try {
      return await this.dashboardService.listCreatorsWithoutUploads(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to load creators without uploads', error as Error);
      throw new HttpException(
        'Failed to load creators without uploads',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('creator/creators-with-uploads')
  async getCreatorsWithUploads() {
    try {
      return await this.dashboardService.listCreatorsWithUploads(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to load creators with uploads', error as Error);
      throw new HttpException(
        'Failed to load creators with uploads',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('creator/live-content')
  async getLiveContent() {
    try {
      return await this.uploadService.listLive(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to load live content', error as Error);
      throw new HttpException('Failed to load live content', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('creator/recent')
  async getRecentCreators() {
    try {
      return await this.dashboardService.listRecentCreators(DEV_ORG_ID, 5);
    } catch (error) {
      this.logger.error('Failed to load recent creators', error as Error);
      throw new HttpException('Failed to load recent creators', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // CALENDAR NOTES
  // =========================================================================

  @Get('calendar-notes')
  async listCalendarNotes(@Query('month') month?: string, @Query('date') date?: string) {
    try {
      if (date) {
        return await this.calendarNoteService.listByDate(DEV_ORG_ID, date);
      }
      const monthStr = month || new Date().toISOString().slice(0, 7);
      return await this.calendarNoteService.listByMonth(DEV_ORG_ID, monthStr);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to list calendar notes', error as Error);
      throw new HttpException('Failed to load calendar notes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('calendar-notes/:date')
  async getCalendarNotesByDate(@Param('date') date: string) {
    try {
      return await this.calendarNoteService.listByDate(DEV_ORG_ID, date);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get calendar notes for date', error as Error);
      throw new HttpException('Failed to load notes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('calendar-notes')
  async createCalendarNote(
    @Body() body: { date: string; content: string; reminderAt?: string | null; createdBy?: string },
  ) {
    try {
      return await this.calendarNoteService.create(DEV_ORG_ID, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create calendar note', error as Error);
      throw new HttpException('Failed to create calendar note', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('calendar-notes/:id')
  async updateCalendarNote(
    @Param('id') id: string,
    @Body() body: { content?: string; reminderAt?: string | null; date?: string },
  ) {
    try {
      return await this.calendarNoteService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update calendar note', error as Error);
      throw new HttpException('Failed to update calendar note', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('calendar-notes/:id')
  async deleteCalendarNote(@Param('id') id: string) {
    try {
      return await this.calendarNoteService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete calendar note', error as Error);
      throw new HttpException('Failed to delete calendar note', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
