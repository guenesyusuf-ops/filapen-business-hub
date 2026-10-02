import { Controller, Get, Post, Body, Headers, Param, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { MetaAdsAiService, AnalyzeInput } from './meta-ads-ai.service';

@Controller('meta-ads/ai')
export class MetaAdsAiController {
  constructor(
    private readonly auth: AuthService,
    private readonly svc: MetaAdsAiService,
  ) {}

  @Get('analyses')
  async list(
    @Headers('authorization') authHeader: string,
    @Query('scopeType') scopeType?: string,
    @Query('productGroupId') productGroupId?: string,
    @Query('adId') adId?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.listAnalyses(orgId, { scopeType, productGroupId, adId });
  }

  @Get('analyses/:id')
  async get(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.svc.getAnalysis(orgId, id);
  }

  // Analyse erzeugen = Write (kostet Tokens, legt einen Datensatz an).
  @Post('analyze')
  async analyze(@Headers('authorization') authHeader: string, @Body() body: AnalyzeInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.analyze(orgId, userId, body);
  }

  // Empfehlung als Idee (source=ai, status=draft) übernehmen — nie automatisch als Task.
  @Post('analyses/:id/accept')
  async accept(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: { index?: number }) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.svc.acceptRecommendation(orgId, userId, id, Number(body?.index ?? 0));
  }
}
