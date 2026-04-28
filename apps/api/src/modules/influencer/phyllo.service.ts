import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typisierte Filter-Eingabe für Discovery-Search. Frontend sendet diese flache
 * Struktur, die PhylloService transformiert sie in Phyllos verschachteltes Schema
 * (z.B. engagement_rate.percentage_value). Felder sind alle optional — leere /
 * undefined Werte werden im Body weggelassen.
 */
export interface PhylloDiscoveryFilters {
  followerMin?: number;
  followerMax?: number;
  engagementMin?: number;
  engagementMax?: number;
  brandSponsors?: string[];
  countries?: string[];
  keywords?: string;
}

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
   * Discovery-Search auf Creator-Profilen.
   *
   * Wir nehmen typisierte Filter (flat) und bauen das Phyllo-Body hier auf —
   * das hält das Frontend frei vom Phyllo-Schema und macht künftige Schema-
   * Anpassungen lokal (genau hier). Vor dem API-Call wird der Body geloggt
   * damit man bei Fehlern sieht was Phyllo wirklich bekommen hat.
   *
   * Phyllo-spezifische Schema-Notizen:
   * - engagement_rate erwartet einen percentage_value-Wrapper:
   *     engagement_rate: { percentage_value: { min, max } }
   *   (NICHT direkt { min, max } — gibt sonst "Field required: percentage_value")
   * - follower_count akzeptiert direkt { min, max }
   * - Filter werden NUR dann gesendet wenn sie tatsächlich Werte haben —
   *   leere Objekte oder undefined-Werte sind verboten (Phyllo wirft 400).
   */
  async searchCreators(params: {
    workPlatformId?: string;
    sortBy?: { field: string; order: 'ASCENDING' | 'DESCENDING' };
    limit?: number;
    offset?: number;
    filters?: PhylloDiscoveryFilters;
  }) {
    const body: Record<string, unknown> = {
      work_platform_id: params.workPlatformId ?? PhylloService.INSTAGRAM_ID,
      sort_by: params.sortBy ?? { field: 'FOLLOWER_COUNT', order: 'DESCENDING' },
      limit: Math.min(params.limit ?? 20, 100),
      offset: params.offset ?? 0,
    };

    const f = params.filters ?? {};

    // Follower-Range — flat { min, max }, beide optional
    if (f.followerMin !== undefined || f.followerMax !== undefined) {
      const range: Record<string, number> = {};
      if (f.followerMin !== undefined) range.min = f.followerMin;
      if (f.followerMax !== undefined) range.max = f.followerMax;
      body.follower_count = range;
    }

    // Engagement-Rate — Phyllo erwartet percentage_value-Wrapper
    if (f.engagementMin !== undefined || f.engagementMax !== undefined) {
      const range: Record<string, number> = {};
      if (f.engagementMin !== undefined) range.min = f.engagementMin;
      if (f.engagementMax !== undefined) range.max = f.engagementMax;
      body.engagement_rate = { percentage_value: range };
    }

    // Brand-Sponsor — Array von Brand-Namen, nur senden wenn nicht leer
    if (f.brandSponsors && f.brandSponsors.length > 0) {
      body.brand_sponsors = f.brandSponsors;
    }

    // Creator-Locations — ISO-Country-Codes, nur senden wenn nicht leer
    if (f.countries && f.countries.length > 0) {
      body.creator_locations = f.countries;
    }

    // Bio-Stichwort-Suche — nur senden wenn non-empty string
    if (f.keywords && f.keywords.trim()) {
      body.description_keywords = f.keywords.trim();
    }

    this.logger.log(`Phyllo discovery body: ${JSON.stringify(body)}`);

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
