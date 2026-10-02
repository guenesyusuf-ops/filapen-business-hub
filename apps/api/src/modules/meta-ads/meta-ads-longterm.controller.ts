import {
  Controller, Post, Get, Body, Headers, Param, Query,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { MetaAdsLongTermService } from './meta-ads-longterm.service';

/**
 * Long-Term Creative Review — AI-Insights-Modus „Langzeitbewertung".
 * Aggregierter Meta-Export (mehrere Monate). KEINE Daily-Metric-Mutation.
 */
@Controller('meta-ads/long-term')
export class MetaAdsLongTermController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: MetaAdsLongTermService,
  ) {}

  private parseMapping(m?: string): Record<string, string | null> | undefined {
    if (!m) return undefined;
    try { return JSON.parse(m); } catch { throw new BadRequestException('mapping ist kein gültiges JSON'); }
  }
  private parsePrefer(p?: string): 'dmy' | 'mdy' | undefined {
    return p === 'mdy' ? 'mdy' : p === 'dmy' ? 'dmy' : undefined;
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async preview(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: any,
    @Body() body: { productGroupId?: string; mapping?: string; prefer?: string },
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.preview(orgId, file, body?.productGroupId, this.parseMapping(body?.mapping), this.parsePrefer(body?.prefer));
  }

  @Post('run')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async run(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: any,
    @Body() body: { productGroupId?: string; mapping?: string; prefer?: string },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.run(orgId, userId, file, body?.productGroupId, this.parseMapping(body?.mapping), this.parsePrefer(body?.prefer));
  }

  @Get('reviews')
  async list(@Headers('authorization') authHeader: string, @Query('productGroupId') productGroupId?: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.list(orgId, productGroupId);
  }

  @Get('reviews/:id')
  async get(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.get(orgId, id);
  }

  @Post('reviews/:id/accept')
  async accept(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: { recommendationId?: string }) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.recommendationId) throw new BadRequestException('recommendationId erforderlich');
    return this.svc.acceptRecommendation(orgId, userId, id, body.recommendationId);
  }
}
