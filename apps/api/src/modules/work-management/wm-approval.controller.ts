import {
  Controller, Get, Post, Delete, Param, Body, Headers,
  Logger, HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { WmApprovalService } from './wm-approval.service';
import { AuthService } from '../auth/auth.service';

@Controller('wm')
export class WmApprovalController {
  private readonly logger = new Logger(WmApprovalController.name);

  constructor(
    private readonly approval: WmApprovalService,
    private readonly auth: AuthService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) throw new HttpException('No token', HttpStatus.UNAUTHORIZED);
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
      throw new HttpException('Invalid auth', HttpStatus.UNAUTHORIZED);
    try { return this.auth.validateToken(parts[1]).sub; }
    catch { throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED); }
  }

  // === Categories ===

  @Get('categories')
  async listCategories() {
    return this.approval.listCategories();
  }

  @Post('categories')
  async createCategory(@Body() body: { name: string }) {
    if (!body.name?.trim()) throw new BadRequestException('Name fehlt');
    return this.approval.createCategory(body.name);
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.approval.deleteCategory(id);
  }

  // === Approval Projects ===

  @Post('projects/approval')
  async createApprovalProject(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string; description?: string; color?: string; approverIds: string[] },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!body.name?.trim()) throw new BadRequestException('Projektname fehlt');
    if (!body.approverIds?.length) throw new BadRequestException('Mindestens ein Genehmiger');
    return this.approval.createApprovalProject({ ...body, createdBy: userId });
  }

  // === Approval Tasks ===

  @Post('tasks/approval')
  async createApprovalTask(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      projectId: string;
      title: string;
      description?: string;
      approverIds: string[];
      deadlineHours?: number;
    },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!body.projectId || !body.title?.trim()) throw new BadRequestException('Projekt und Titel fehlen');
    if (!body.approverIds?.length) throw new BadRequestException('Mindestens ein Genehmiger');
    return this.approval.createApprovalTask({ ...body, createdById: userId });
  }

  @Post('tasks/:id/approval/submit')
  async submitForApproval(
    @Headers('authorization') authHeader: string,
    @Param('id') taskId: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.approval.submitForApproval(taskId, userId);
  }

  @Post('tasks/:id/approval/decide')
  async decide(
    @Headers('authorization') authHeader: string,
    @Param('id') taskId: string,
    @Body() body: { action: 'approved' | 'rejected'; comment?: string },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!['approved', 'rejected'].includes(body.action)) {
      throw new BadRequestException('Aktion muss "approved" oder "rejected" sein');
    }
    return this.approval.decide(taskId, userId, body.action, body.comment);
  }

  @Get('tasks/:id/approval')
  async getApprovalDetail(@Param('id') taskId: string) {
    return this.approval.getApprovalTaskDetail(taskId);
  }

  @Get('approvals/pending')
  async getPendingApprovals(@Headers('authorization') authHeader: string) {
    const userId = this.extractUserId(authHeader);
    return this.approval.getPendingApprovals(userId);
  }
}
