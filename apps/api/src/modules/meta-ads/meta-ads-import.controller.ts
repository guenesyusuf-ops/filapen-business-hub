import {
  Controller, Post, Get, Body, Headers, Param, Query,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { MetaAdsImportService, CommitRow } from './meta-ads-import.service';
import { ImportType } from './import/alias-map';

@Controller('meta-ads/import')
export class MetaAdsImportController {
  constructor(
    private readonly auth: AuthService,
    private readonly imp: MetaAdsImportService,
  ) {}

  /**
   * Datei hochladen + analysieren (Preview). KEINE Persistenz, keine Datei wird
   * gespeichert — nur im Speicher verarbeitet. Multipart: file + type + mapping(JSON) + prefer.
   */
  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async analyze(
    @Headers('authorization') authHeader: string,
    @UploadedFile() file: any,
    @Body() body: { type?: string; mapping?: string; prefer?: string },
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const type = this.parseType(body?.type);
    let mapping: Record<string, string | null> | undefined;
    if (body?.mapping) {
      try { mapping = JSON.parse(body.mapping); } catch { throw new BadRequestException('mapping ist kein gültiges JSON'); }
    }
    const prefer = body?.prefer === 'mdy' ? 'mdy' : body?.prefer === 'dmy' ? 'dmy' : undefined;
    return this.imp.analyze(orgId, type, file, mapping, prefer);
  }

  @Post('commit')
  async commit(
    @Headers('authorization') authHeader: string,
    @Body() body: { type?: string; filename?: string; mappingConfig?: Record<string, string | null>; rows?: CommitRow[] },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const type = this.parseType(body?.type);
    return this.imp.commit(orgId, userId, type, body?.filename ?? 'import', body?.mappingConfig, body?.rows ?? []);
  }

  @Get('history')
  async history(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.imp.history(orgId);
  }

  @Get(':id')
  async detail(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.imp.getImport(orgId, id);
  }

  private parseType(t?: string): ImportType {
    if (t !== 'meta' && t !== 'hyros') throw new BadRequestException('type muss "meta" oder "hyros" sein');
    return t;
  }
}
