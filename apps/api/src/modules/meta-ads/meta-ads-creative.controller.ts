import { Controller, Get, Post, Put, Delete, Body, Headers, Param, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { MetaAdsCreativeService, ComponentInput } from './meta-ads-creative.service';
import { PeriodRange } from './meta-ads.service';

@Controller('meta-ads')
export class MetaAdsCreativeController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: MetaAdsCreativeService,
  ) {}

  // --- Creative Lab ---
  @Get('creative-lab')
  async creativeLab(
    @Headers('authorization') authHeader: string,
    @Query('productGroupId') productGroupId?: string,
    @Query('format') format?: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.creativeLab(orgId, { productGroupId, format, range, start, end });
  }

  // --- Components ---
  @Get('components')
  async listComponents(
    @Headers('authorization') authHeader: string,
    @Query('type') type?: string,
    @Query('productGroupId') productGroupId?: string,
    @Query('sourceAdId') sourceAdId?: string,
    @Query('search') search?: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listComponents(orgId, { type, productGroupId, sourceAdId, search, range, start, end });
  }

  @Post('components')
  async createComponent(@Headers('authorization') authHeader: string, @Body() body: ComponentInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createComponent(orgId, userId, body);
  }

  @Get('components/:id')
  async getComponent(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.getComponent(orgId, id, range, start, end);
  }

  @Get('components/:id/performance')
  async getComponentPerformance(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Query('range') range?: PeriodRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.getComponentPerformance(orgId, id, range, start, end);
  }

  @Put('components/:id')
  async updateComponent(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: Partial<ComponentInput>) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.updateComponent(orgId, id, body);
  }

  @Delete('components/:id')
  async deleteComponent(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.deleteComponent(orgId, id);
  }

  // --- Ad ↔ Components ---
  @Get('ads/:id/components')
  async adComponents(
    @Headers('authorization') authHeader: string, @Param('id') id: string,
    @Query('range') range?: PeriodRange, @Query('start') start?: string, @Query('end') end?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listAdComponents(orgId, id, range, start, end);
  }

  @Post('ads/:id/components')
  async linkComponent(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: { componentId: string; role?: string }) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.linkComponent(orgId, id, body?.componentId, body?.role);
  }

  @Delete('ads/:id/components/:componentId')
  async unlinkComponent(@Headers('authorization') authHeader: string, @Param('id') id: string, @Param('componentId') componentId: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.unlinkComponent(orgId, id, componentId);
  }

  // --- Recipes ---
  @Get('recipes')
  async listRecipes(@Headers('authorization') authHeader: string, @Query('productGroupId') productGroupId?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listRecipes(orgId, productGroupId);
  }

  @Post('recipes')
  async createRecipe(@Headers('authorization') authHeader: string, @Body() body: any) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.createRecipe(orgId, userId, body);
  }

  @Get('recipes/:id')
  async getRecipe(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.getRecipe(orgId, id);
  }

  @Put('recipes/:id')
  async updateRecipe(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: any) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.updateRecipe(orgId, id, body);
  }
}
