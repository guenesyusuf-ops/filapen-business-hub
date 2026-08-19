import { Controller, Get, Put, Body, Headers, Param, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { SettingsService } from './settings.service';
import { SETTING_KEYS, SettingKey } from './settings.constants';

interface UpdateSettingBody {
  value: string;              // "3.0" oder "3,0"
  effectiveFrom: string;      // "2026-09-01" (YYYY-MM-DD)
  note?: string;
}

@Controller('profit-analysis/settings')
export class SettingsController {
  constructor(
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
  ) {}

  /** Liste aller Settings mit aktuellem Wert + Metadaten fuer die UI. */
  @Get()
  async list(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const items = await this.settings.listCurrent(orgId);
    return { items };
  }

  /** Historie eines einzelnen Keys (Timeline unter der Kachel). */
  @Get(':key/history')
  async history(
    @Headers('authorization') authHeader: string,
    @Param('key') key: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    this.assertKnownKey(key);
    const items = await this.settings.history(orgId, key as SettingKey);
    return { items };
  }

  /** Neuer Wert ab bestimmten Datum. */
  @Put(':key')
  async set(
    @Headers('authorization') authHeader: string,
    @Param('key') key: string,
    @Body() body: UpdateSettingBody,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    this.assertKnownKey(key);

    if (!body?.value) throw new BadRequestException('value fehlt');
    if (!body?.effectiveFrom) throw new BadRequestException('effectiveFrom fehlt');
    const effectiveFrom = new Date(body.effectiveFrom + 'T00:00:00.000Z');
    if (isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom ist kein gueltiges Datum (YYYY-MM-DD)');
    }
    return this.settings.setValue(orgId, key as SettingKey, body.value, effectiveFrom, userId, body.note);
  }

  private assertKnownKey(key: string) {
    const known: string[] = Object.values(SETTING_KEYS);
    if (!known.includes(key)) {
      throw new BadRequestException(`Unbekannter Setting-Key: ${key}`);
    }
  }
}
