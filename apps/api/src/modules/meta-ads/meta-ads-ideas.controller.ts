import { Controller, Get, Post, Put, Delete, Body, Headers, Param, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { MetaAdsIdeasService, IdeaInput, TaskBridgeInput } from './meta-ads-ideas.service';
import { PeriodRange } from './meta-ads.service';

@Controller('meta-ads')
export class MetaAdsIdeasController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: MetaAdsIdeasService,
  ) {}

  // --- Ideas ---
  @Get('ideas')
  async listIdeas(
    @Headers('authorization') authHeader: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('type') type?: string,
    @Query('productGroupId') productGroupId?: string,
    @Query('search') search?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listIdeas(orgId, { status, source, type, productGroupId, search });
  }

  // Statisch vor :id deklariert, damit "suggestions" nicht als id interpretiert wird.
  @Get('ideas/suggestions')
  async suggestions(
    @Headers('authorization') authHeader: string,
    @Query('productGroupId') productGroupId?: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.suggestions(orgId, { productGroupId, range, start, end });
  }

  @Post('ideas')
  async createIdea(@Headers('authorization') authHeader: string, @Body() body: IdeaInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createIdea(orgId, userId, body);
  }

  @Get('ideas/:id')
  async getIdea(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.getIdea(orgId, id);
  }

  @Put('ideas/:id')
  async updateIdea(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: IdeaInput) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.updateIdea(orgId, id, body);
  }

  @Delete('ideas/:id')
  async deleteIdea(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.deleteIdea(orgId, id);
  }

  // --- Task-Bridge ---
  @Post('ideas/:id/task')
  async taskFromIdea(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: TaskBridgeInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createTaskFromIdea(orgId, userId, id, body ?? {});
  }

  @Post('recipes/:id/task')
  async taskFromRecipe(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: TaskBridgeInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createTaskFromRecipe(orgId, userId, id, body ?? {});
  }
}
