import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Wrapper für die Phyllo (InsightIQ) Creator-Discovery-API.
 *
 * Auth: Basic <base64(CLIENT_ID:SECRET)> gegen api.staging.insightiq.ai
 *       oder api.insightiq.ai (Production). Mode kommt aus PHYLLO_HOST.
 *
 * Rate Limits: 20 RPS authenticated. Bei 429 respektieren wir den
 * Retry-After-Header und retryen einmalig — danach Fehler propagieren
 * damit der User-Call nicht ewig hängt.
 *
 * Hinweis: Brand-spezifische Endpoints (/v1/social/brands/*) sind
 * unter unserem Account nicht freigeschaltet (403). Brand→Creator-
 * Suche läuft stattdessen über die Discovery-Search mit dem
 * brand_sponsors-Filter im selben Endpoint.
 */
@Injectable()
export class PhylloService {
  private readonly logger = new Logger(PhylloService.name);
  private readonly host: string;
  private readonly authHeader: string | null;

  // Bekannte Work-Platform-IDs aus /v1/work-platforms — gecached weil
  // statisch. Spart einen Roundtrip pro Search.
  static readonly INSTAGRAM_ID = '9bb8913b-ddd9-430b-a66a-d74d846e6c66';
  static readonly TIKTOK_ID = 'de55aeec-0dc8-4119-bf90-16b3d1f0c987';

  constructor(private readonly config: ConfigService) {
    const clientId = this.config.get<string>('PHYLLO_CLIENT_ID');
    const secret = this.config.get<string>('PHYLLO_SECRET');
    this.host = this.config.get<string>('PHYLLO_HOST') ?? 'https://api.staging.insightiq.ai';

    if (clientId && secret) {
      const token = Buffer.from(`${clientId}:${secret}`).toString('base64');
      this.authHeader = `Basic ${token}`;
    } else {
      this.authHeader = null;
      this.logger.warn('Phyllo credentials missing (PHYLLO_CLIENT_ID/SECRET) — Discovery wird 503 werfen');
    }
  }

  /**
   * Generischer authenticated Request mit Retry-on-429.
   */
  private async request<T>(
    path: string,
    init: RequestInit & { retried?: boolean } = {},
  ): Promise<T> {
    if (!this.authHeader) {
      throw new ServiceUnavailableException('Phyllo nicht konfiguriert — Credentials fehlen in Env');
    }
    const url = `${this.host}${path}`;
    const headers = {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    };

    const res = await fetch(url, { ...init, headers });

    if (res.status === 429 && !init.retried) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
      this.logger.warn(`Phyllo 429 — retry in ${retryAfter}s (path=${path})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.request<T>(path, { ...init, retried: true });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Phyllo ${res.status} bei ${path}: ${body.slice(0, 500)}`);
      // 4xx → BadRequest (User-Fehler), 5xx → 503 (Phyllo down)
      if (res.status >= 400 && res.status < 500) {
        throw new BadRequestException(`Phyllo: ${res.status} ${this.parsePhylloError(body)}`);
      }
      throw new ServiceUnavailableException(`Phyllo nicht erreichbar (${res.status})`);
    }

    return res.json() as Promise<T>;
  }

  private parsePhylloError(body: string): string {
    try {
      const j = JSON.parse(body);
      return j?.error?.message ?? j?.message ?? body.slice(0, 200);
    } catch {
      return body.slice(0, 200);
    }
  }

  /**
   * Discovery-Search auf Creator-Profilen. Sortier-Feld + Plattform sind
   * Pflicht (sonst 400 von Phyllo). Filter ist optional.
   *
   * @param filters Reichgereicht 1:1 an Phyllo. Beispiele:
   *   { follower_count: { min: 10000, max: 100000 } }
   *   { creator_locations: ["DE","AT","CH"] }
   *   { brand_sponsors: ["nike","adidas"] }   // Brand→Creator-Filter
   *   { creator_brand_affinities: [...] }
   */
  async searchCreators(params: {
    workPlatformId?: string;
    sortBy?: { field: string; order: 'ASCENDING' | 'DESCENDING' };
    limit?: number;
    offset?: number;
    filters?: Record<string, unknown>;
  }) {
    const body = {
      work_platform_id: params.workPlatformId ?? PhylloService.INSTAGRAM_ID,
      sort_by: params.sortBy ?? { field: 'FOLLOWER_COUNT', order: 'DESCENDING' },
      limit: Math.min(params.limit ?? 20, 100),
      offset: params.offset ?? 0,
      ...(params.filters ?? {}),
    };
    return this.request<{ data: any[]; metadata?: any }>(
      '/v1/social/creators/profiles/search',
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  /**
   * Profil-Details für einen einzelnen Creator (per Username + Plattform).
   * Wird für Detail-Seiten + Refresh-Snapshot verwendet.
   */
  async getCreatorProfile(identifier: string, workPlatformId: string) {
    return this.request<{ data: any }>(
      '/v1/social/creators/profiles',
      {
        method: 'POST',
        body: JSON.stringify({ identifier, work_platform_id: workPlatformId }),
      },
    );
  }
}
