import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Query,
  Param,
  Body,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkManagementService } from './work-management.service';
import { WmApprovalService } from './wm-approval.service';
import { AuthService } from '../auth/auth.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';
const DEV_USER_NAME = 'Dev User';

@Controller('wm')
export class WorkManagementController {
  private readonly logger = new Logger(WorkManagementController.name);

  constructor(
    private readonly wmService: WorkManagementService,
    private readonly wmApproval: WmApprovalService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) return DEV_USER_ID;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return DEV_USER_ID;
    try {
      return this.auth.validateToken(parts[1]).sub;
    } catch {
      return DEV_USER_ID;
    }
  }

  // =========================================================================
  // PROJECTS
  // =========================================================================

  @Get('projects')
  async listProjects() {
    try {
      return await this.wmService.listProjects();
    } catch (error) {
      this.logger.error('listProjects failed', error);
      throw new HttpException('Failed to list projects', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('projects')
  async createProject(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      name: string;
      description?: string;
      color?: string;
      projectType?: 'kanban' | 'approval';
      approverIds?: string[];
    },
  ) {
    try {
      const userId = this.extractUserId(authHeader);

      // If approval project, delegate to the approval service
      if (body.projectType === 'approval') {
        if (!body.approverIds?.length) {
          throw new BadRequestException('Mindestens ein Genehmiger erforderlich');
        }
        return await this.wmApproval.createApprovalProject({
          name: body.name,
          description: body.description,
          color: body.color,
          createdBy: userId,
          approverIds: body.approverIds,
        });
      }

      return await this.wmService.createProject({
        name: body.name,
        description: body.description,
        color: body.color,
        createdBy: userId,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createProject failed', error);
      throw new HttpException('Failed to create project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('projects/:id')
  async getProject(@Param('id') id: string) {
    try {
      return await this.wmService.getProjectById(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getProject failed', error);
      throw new HttpException('Failed to get project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('projects/:id')
  async updateProject(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; color?: string },
  ) {
    try {
      return await this.wmService.updateProject(id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('updateProject failed', error);
      throw new HttpException('Failed to update project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id') id: string) {
    try {
      return await this.wmService.deleteProject(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('deleteProject failed', error);
      throw new HttpException('Failed to delete project', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // COLUMNS
  // =========================================================================

  @Post('projects/:id/columns')
  async createColumn(
    @Param('id') projectId: string,
    @Body() body: { name: string; color?: string },
  ) {
    try {
      return await this.wmService.createColumn(projectId, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createColumn failed', error);
      throw new HttpException('Failed to create column', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('columns/:id')
  async updateColumn(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string },
  ) {
    try {
      return await this.wmService.updateColumn(id, body);
    } catch (error) {
      this.logger.error('updateColumn failed', error);
      throw new HttpException('Failed to update column', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('columns/:id')
  async deleteColumn(@Param('id') id: string) {
    try {
      return await this.wmService.deleteColumn(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('deleteColumn failed', error);
      throw new HttpException('Failed to delete column', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('projects/:id/columns/reorder')
  async reorderColumns(
    @Param('id') projectId: string,
    @Body() body: { columnIds: string[] },
  ) {
    try {
      return await this.wmService.reorderColumns(projectId, body.columnIds);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('reorderColumns failed', error);
      throw new HttpException('Failed to reorder columns', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // TASKS
  // =========================================================================

  @Get('projects/:id/tasks')
  async listProjectTasks(@Param('id') projectId: string) {
    try {
      return await this.wmService.listProjectTasks(projectId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('listProjectTasks failed', error);
      throw new HttpException('Failed to list tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tasks')
  async createTask(
    @Headers('authorization') authHeader: string,
    @Body()
    body: {
      projectId: string;
      columnId?: string;
      title: string;
      description?: string;
      assigneeId?: string;
      assigneeIds?: string[];
      approverIds?: string[];
      isApproval?: boolean;
      priority?: string;
      dueDate?: string;
      estimatedMinutes?: number;
      deadlineHours?: number;
      color?: string;
      section?: string;
    },
  ) {
    try {
      const userId = this.extractUserId(authHeader);

      // Auto-detect approval project or explicit isApproval flag
      if (body.isApproval || body.approverIds) {
        return await this.wmApproval.createApprovalTask({
          projectId: body.projectId,
          title: body.title,
          description: body.description,
          createdById: userId,
          approverIds: body.approverIds,
          deadlineHours: body.deadlineHours,
        });
      }

      // Also auto-detect: check if the project is of type 'approval'
      const project = await this.wmService.getProjectType(body.projectId);
      if (project === 'approval') {
        return await this.wmApproval.createApprovalTask({
          projectId: body.projectId,
          title: body.title,
          description: body.description,
          createdById: userId,
        });
      }

      return await this.wmService.createTask({
        ...body,
        columnId: body.columnId!,
        createdById: userId,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createTask failed', error);
      throw new HttpException('Failed to create task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('tasks/:id')
  async getTask(@Param('id') id: string) {
    try {
      return await this.wmService.getTaskById(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('getTask failed', error);
      throw new HttpException('Failed to get task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: string | null;
      assigneeId?: string | null;
      assigneeIds?: string[];
      columnId?: string;
      completed?: boolean;
      estimatedMinutes?: number | null;
      color?: string | null;
      section?: string | null;
    },
  ) {
    try {
      return await this.wmService.updateTask(id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('updateTask failed', error);
      throw new HttpException('Failed to update task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('tasks/:id')
  async deleteTask(@Param('id') id: string) {
    try {
      return await this.wmService.deleteTask(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('deleteTask failed', error);
      throw new HttpException('Failed to delete task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('tasks/:id/move')
  async moveTask(
    @Param('id') id: string,
    @Body() body: { columnId: string; position: number },
  ) {
    try {
      return await this.wmService.moveTask(id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('moveTask failed', error);
      throw new HttpException('Failed to move task', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('projects/:id/tasks/reorder')
  async bulkReorderTasks(
    @Param('id') projectId: string,
    @Body() body: { taskId: string; columnId: string; position: number }[],
  ) {
    try {
      return await this.wmService.bulkReorderTasks(projectId, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('bulkReorderTasks failed', error);
      throw new HttpException('Failed to reorder tasks', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // SUBTASKS
  // =========================================================================

  @Post('tasks/:id/subtasks')
  async createSubtask(
    @Param('id') parentTaskId: string,
    @Body() body: { title: string; assigneeId?: string },
  ) {
    try {
      return await this.wmService.createSubtask(parentTaskId, {
        ...body,
        createdById: DEV_USER_ID,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createSubtask failed', error);
      throw new HttpException('Failed to create subtask', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('subtasks/:id/toggle')
  async toggleSubtask(@Param('id') id: string) {
    try {
      return await this.wmService.toggleSubtask(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('toggleSubtask failed', error);
      throw new HttpException('Failed to toggle subtask', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================

  @Get('tasks/:id/comments')
  async listComments(@Param('id') taskId: string) {
    try {
      return await this.wmService.listComments(taskId);
    } catch (error) {
      this.logger.error('listComments failed', error);
      throw new HttpException('Failed to list comments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tasks/:id/comments')
  async createComment(
    @Param('id') taskId: string,
    @Body() body: { message: string },
  ) {
    try {
      return await this.wmService.createComment(taskId, {
        userId: DEV_USER_ID,
        userName: DEV_USER_NAME,
        message: body.message,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createComment failed', error);
      throw new HttpException('Failed to create comment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // ATTACHMENTS
  // =========================================================================

  @Post('tasks/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined,
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
    }),
  )
  async uploadAttachment(
    @Param('id') taskId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.buffer) throw new BadRequestException('File buffer missing');

    try {
      return await this.wmService.uploadAttachment(taskId, file);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('uploadAttachment failed', error);
      throw new HttpException('Failed to upload attachment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('attachments/:id')
  async deleteAttachment(@Param('id') id: string) {
    try {
      return await this.wmService.deleteAttachment(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('deleteAttachment failed', error);
      throw new HttpException('Failed to delete attachment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // ACTIVITIES
  // =========================================================================

  @Get('tasks/:id/activities')
  async listActivities(@Param('id') taskId: string) {
    try {
      return await this.wmService.listActivities(taskId);
    } catch (error) {
      this.logger.error('listActivities failed', error);
      throw new HttpException('Failed to list activities', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // LABELS
  // =========================================================================

  @Get('projects/:id/labels')
  async listLabels(@Param('id') projectId: string) {
    try {
      return await this.wmService.listLabels(projectId);
    } catch (error) {
      this.logger.error('listLabels failed', error);
      throw new HttpException('Failed to list labels', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('projects/:id/labels')
  async createLabel(
    @Param('id') projectId: string,
    @Body() body: { name: string; color: string },
  ) {
    try {
      return await this.wmService.createLabel(projectId, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('createLabel failed', error);
      throw new HttpException('Failed to create label', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('labels/:id')
  async deleteLabel(@Param('id') id: string) {
    try {
      return await this.wmService.deleteLabel(id);
    } catch (error) {
      this.logger.error('deleteLabel failed', error);
      throw new HttpException('Failed to delete label', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('tasks/:taskId/labels/:labelId')
  async addLabelToTask(
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
  ) {
    try {
      return await this.wmService.addLabelToTask(taskId, labelId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('addLabelToTask failed', error);
      throw new HttpException('Failed to add label', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('tasks/:taskId/labels/:labelId')
  async removeLabelFromTask(
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
  ) {
    try {
      return await this.wmService.removeLabelFromTask(taskId, labelId);
    } catch (error) {
      this.logger.error('removeLabelFromTask failed', error);
      throw new HttpException('Failed to remove label', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // MEMBERS
  // =========================================================================

  @Get('projects/:id/members')
  async listMembers(@Param('id') projectId: string) {
    try {
      return await this.wmService.listMembers(projectId);
    } catch (error) {
      this.logger.error('listMembers failed', error);
      throw new HttpException('Failed to list members', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('projects/:id/members')
  async addMember(
    @Param('id') projectId: string,
    @Body() body: { userId: string; userName: string; role?: string },
  ) {
    try {
      return await this.wmService.addMember(projectId, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('addMember failed', error);
      throw new HttpException('Failed to add member', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('members/:id')
  async updateMember(
    @Param('id') id: string,
    @Body() body: { role: string },
  ) {
    try {
      return await this.wmService.updateMember(id, body);
    } catch (error) {
      this.logger.error('updateMember failed', error);
      throw new HttpException('Failed to update member', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('members/:id')
  async removeMember(@Param('id') id: string) {
    try {
      return await this.wmService.removeMember(id);
    } catch (error) {
      this.logger.error('removeMember failed', error);
      throw new HttpException('Failed to remove member', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // WORKLOAD
  // =========================================================================

  @Get('workload')
  async getWorkload(@Query('projectId') projectId?: string) {
    try {
      return await this.wmService.getWorkload(projectId);
    } catch (error) {
      this.logger.error('getWorkload failed', error);
      throw new HttpException('Failed to get workload', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
