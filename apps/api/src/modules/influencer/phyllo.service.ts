import { Injectable, Logger, BadRequestException, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

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
 * Quota-Schutz (wegen Staging-Limit von 10 Calls/Periode):
 *   1. Result-Cache (15min, payload-hashed) — identische Suchen verbrennen
 *      keine Credits doppelt.
 *   2. Min-Interval-Rate-Limiter (5s zwischen Discovery-Calls) — verhindert
 *      Flooding durch schnelle Mehrfach-Klicks.
 *   3. In-flight-Deduplication — gleicher Payload während laufender Anfrage
 *      teilt sich denselben Promise statt zwei Calls zu starten.
 *   4. Quota-Exhausted-Detection — bei "Maximum number of requests..."
 *      wird klar gefailt OHNE Retry, mit aktionsfähiger Fehlermeldung.
 *   5. KEIN Retry auf 4xx (nur auf 429 mit Retry-After bisher) — verbrennt
 *      keine Credits durch Schleifen.
 *
 * Hinweis: Brand-spezifische Endpoints (/v1/social/brands/*) sind unter
 * unserem Account 403. Brand→Creator-Suche läuft über Discovery mit
 * brand_sponsors-Filter im selben Endpoint.
 */
@Injectable()
export class PhylloService {
  private readonly logger = new Logger(PhylloService.name);
  private readonly host: string;
  private readonly authHeader: string | null;

  // Bekannte Work-Platform-IDs aus /v1/work-platforms — gecached weil statisch.
  static readonly INSTAGRAM_ID = '9bb8913b-ddd9-430b-a66a-d74d846e6c66';
  static readonly TIKTOK_ID = 'de55aeec-0dc8-4119-bf90-16b3d1f0c987';

  // Quota-Schutz-Konstanten
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;     // 15min
  private static readonly MIN_CALL_INTERVAL_MS = 5_000;       // 5s zwischen Discovery-Calls
  private static readonly QUOTA_EXHAUSTED_MARKER = /maximum number of requests.+exceeded/i;

  // In-Memory Result-Cache: cacheKey → { data, expiresAt }
  private readonly searchCache = new Map<string, { data: unknown; expiresAt: number }>();
  // In-Flight-Promises: cacheKey → laufender Promise (zum Deduplizieren paralleler Calls)
  private readonly inFlight = new Map<string, Promise<any>>();
  // Wann wurde zuletzt Discovery aufgerufen (Rate-Limit pro Service-Instanz)
  private lastDiscoveryCallTs = 0;
  // Globaler Counter für Logging (Phyllo-Calls seit Service-Start)
  private discoveryCallCount = 0;

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
   * Generischer authenticated Request. Retry NUR bei 429 (Rate-Limit) — bei
   * 4xx-Validation-Fehlern und Quota-Exhausted explizit KEIN Retry damit
   * keine Credits in Schleifen verbrannt werden.
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

      // Quota-Exhausted spezifisch behandeln: aktionsfähige Meldung,
      // KEIN Retry, eigener HTTP-Status damit Frontend differenzieren kann.
      if (PhylloService.QUOTA_EXHAUSTED_MARKER.test(body)) {
        throw new HttpException(
          'Phyllo API-Limit erreicht. Bitte kurz warten und erneut versuchen — oder Phyllo-Support kontaktieren für mehr Staging-Credits.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // 4xx → BadRequest (User-Fehler, kein Retry), 5xx → 503 (Phyllo down)
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
   * Discovery-Search mit allen Quota-Schutz-Layern. Reihenfolge:
   *
   *   1. Body bauen (typisiert → Phyllo-Schema)
   *   2. Cache-Key hashen
   *   3. Cache-Hit? → return ohne API-Call
   *   4. In-flight derselbe Payload? → returns same Promise (kein doppelter Call)
   *   5. Min-Interval seit letztem Call OK? → sonst 429 ohne API-Call
   *   6. Phyllo callen, loggen
   *   7. Erfolg → cachen, expose
   *   8. Quota-Exhausted-Error → ohne Retry an Frontend propagieren
   */
  async searchCreators(params: {
    workPlatformId?: string;
    sortBy?: { field: string; order: 'ASCENDING' | 'DESCENDING' };
    limit?: number;
    offset?: number;
    filters?: PhylloDiscoveryFilters;
  }) {
    const body = this.buildDiscoveryBody(params);
    const cacheKey = this.hashPayload(body);

    // 3. Cache-Hit
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.log(`Phyllo cache HIT (key=${cacheKey.slice(0, 12)}, count=${this.discoveryCallCount}, no API call)`);
      return cached.data as { data: any[]; metadata?: any };
    }
    if (cached) this.searchCache.delete(cacheKey); // expired

    // 4. In-Flight Dedup — wenn derselbe Payload gerade läuft, denselben Promise teilen
    const inFlight = this.inFlight.get(cacheKey);
    if (inFlight) {
      this.logger.log(`Phyllo in-flight DEDUP (key=${cacheKey.slice(0, 12)}, sharing Promise)`);
      return inFlight;
    }

    // 5. Min-Interval-Rate-Limiter
    const sinceLast = Date.now() - this.lastDiscoveryCallTs;
    if (sinceLast < PhylloService.MIN_CALL_INTERVAL_MS) {
      const waitMs = PhylloService.MIN_CALL_INTERVAL_MS - sinceLast;
      this.logger.warn(`Phyllo rate-limit: nur 1 Call alle ${PhylloService.MIN_CALL_INTERVAL_MS / 1000}s, noch ${waitMs}ms warten`);
      throw new HttpException(
        `Bitte ${Math.ceil(waitMs / 1000)} Sekunden warten — interner Rate-Limiter schützt das Phyllo-Quota.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 6. Aufruf — als Promise im in-flight-Map registrieren damit parallele
    // Calls denselben Promise teilen (Race-Schutz)
    this.discoveryCallCount += 1;
    this.lastDiscoveryCallTs = Date.now();
    this.logger.log(
      `Phyllo discovery CALL #${this.discoveryCallCount} ` +
      `key=${cacheKey.slice(0, 12)} ` +
      `ts=${new Date().toISOString()} ` +
      `body=${JSON.stringify(body)}`,
    );

    const promise = this.request<{ data: any[]; metadata?: any }>(
      '/v1/social/creators/profiles/search',
      { method: 'POST', body: JSON.stringify(body) },
    );
    this.inFlight.set(cacheKey, promise);

    try {
      const result = await promise;
      // 7. Cachen für 15min
      this.searchCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + PhylloService.CACHE_TTL_MS,
      });
      return result;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  /**
   * Body-Builder: typisierte flache Filter → Phyllo-Schema.
   *
   * Phyllo-Schema-Notizen:
   * - engagement_rate erwartet percentage_value-Wrapper
   * - follower_count akzeptiert flat { min, max }
   * - Felder werden NUR gesendet wenn Werte da sind — keine leeren Objekte
   */
  private buildDiscoveryBody(params: {
    workPlatformId?: string;
    sortBy?: { field: string; order: 'ASCENDING' | 'DESCENDING' };
    limit?: number;
    offset?: number;
    filters?: PhylloDiscoveryFilters;
  }): Record<string, unknown> {
    const body: Record<string, unknown> = {
      work_platform_id: params.workPlatformId ?? PhylloService.INSTAGRAM_ID,
      sort_by: params.sortBy ?? { field: 'FOLLOWER_COUNT', order: 'DESCENDING' },
      limit: Math.min(params.limit ?? 20, 100),
      offset: params.offset ?? 0,
    };

    const f = params.filters ?? {};

    if (f.followerMin !== undefined || f.followerMax !== undefined) {
      const range: Record<string, number> = {};
      if (f.followerMin !== undefined) range.min = f.followerMin;
      if (f.followerMax !== undefined) range.max = f.followerMax;
      body.follower_count = range;
    }

    if (f.engagementMin !== undefined || f.engagementMax !== undefined) {
      const range: Record<string, number> = {};
      if (f.engagementMin !== undefined) range.min = f.engagementMin;
      if (f.engagementMax !== undefined) range.max = f.engagementMax;
      body.engagement_rate = { percentage_value: range };
    }

    if (f.brandSponsors && f.brandSponsors.length > 0) {
      body.brand_sponsors = f.brandSponsors;
    }
    if (f.countries && f.countries.length > 0) {
      body.creator_locations = f.countries;
    }
    if (f.keywords && f.keywords.trim()) {
      body.description_keywords = f.keywords.trim();
    }

    return body;
  }

  /** Stabiler Hash über den fertigen Body — JSON.stringify ist deterministisch
   *  weil unser Builder die Felder immer in derselben Reihenfolge setzt. */
  private hashPayload(body: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
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
