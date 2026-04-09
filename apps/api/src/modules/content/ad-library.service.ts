import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdLibraryAd {
  id: string;
  pageName: string;
  pageId: string;
  creativeBody: string;
  headline: string;
  linkCaption: string;
  linkDescription: string;
  snapshotUrl: string;
  startDate: string;
  platforms: string[];
  impressionsMin: number;
  impressionsMax: number;
  spendMin: number;
  spendMax: number;
  currency: string;
  demographics: Array<{ age: string; gender: string; percentage: number }>;
  languages: string[];
  regions: Array<{ region: string; percentage: number }>;
}

export interface AdLibraryResult {
  data: AdLibraryAd[];
  hasMore: boolean;
  configured: boolean;
}

export interface AdLibrarySearchParams {
  searchTerm: string;
  country?: string;
  adType?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const AD_LIBRARY_FIELDS = [
  'id',
  'ad_creation_time',
  'ad_creative_bodies',
  'ad_creative_link_captions',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_delivery_start_time',
  'ad_snapshot_url',
  'bylines',
  'currency',
  'delivery_by_region',
  'demographic_distribution',
  'estimated_audience_size',
  'impressions',
  'languages',
  'page_id',
  'page_name',
  'publisher_platforms',
  'spend',
].join(',');

@Injectable()
export class AdLibraryService {
  private readonly accessToken: string | null;
  private readonly logger = new Logger(AdLibraryService.name);

  constructor(private config: ConfigService) {
    this.accessToken = this.config.get<string>('META_ACCESS_TOKEN') || null;
    if (!this.accessToken) {
      this.logger.warn('META_ACCESS_TOKEN not set — Ad Library search disabled');
    }
  }

  async searchAds(params: AdLibrarySearchParams): Promise<AdLibraryResult> {
    if (!this.accessToken) {
      return { data: [], hasMore: false, configured: false };
    }

    const country = params.country || 'DE';
    const limit = Math.min(params.limit || 20, 50);

    const url = new URL('https://graph.facebook.com/v19.0/ads_archive');
    url.searchParams.set('access_token', this.accessToken);
    url.searchParams.set('search_terms', params.searchTerm);
    url.searchParams.set('ad_reached_countries', JSON.stringify([country]));
    url.searchParams.set('ad_active_status', 'ACTIVE');
    url.searchParams.set('ad_type', params.adType || 'ALL');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', AD_LIBRARY_FIELDS);

    try {
      const res = await fetch(url.toString());

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Ad Library API error: ${res.status} ${errorText}`);
        return { data: [], hasMore: false, configured: true };
      }

      const json = await res.json();
      const ads = (json.data || []).map(this.mapAd);

      return {
        data: ads,
        hasMore: !!json.paging?.next,
        configured: true,
      };
    } catch (error) {
      this.logger.error(`Ad Library fetch error: ${error}`);
      return { data: [], hasMore: false, configured: true };
    }
  }

  private mapAd(raw: any): AdLibraryAd {
    let impressionsMin = 0;
    let impressionsMax = 0;
    if (raw.impressions) {
      impressionsMin = parseInt(raw.impressions.lower_bound || '0', 10);
      impressionsMax = parseInt(raw.impressions.upper_bound || '0', 10);
    }

    let spendMin = 0;
    let spendMax = 0;
    if (raw.spend) {
      spendMin = parseInt(raw.spend.lower_bound || '0', 10);
      spendMax = parseInt(raw.spend.upper_bound || '0', 10);
    }

    const demographics = (raw.demographic_distribution || []).map(
      (d: any) => ({
        age: d.age,
        gender: d.gender,
        percentage: parseFloat(d.percentage || '0'),
      }),
    );

    return {
      id: raw.id,
      pageName: raw.page_name || 'Unknown',
      pageId: raw.page_id || '',
      creativeBody: raw.ad_creative_bodies?.[0] || '',
      headline: raw.ad_creative_link_titles?.[0] || '',
      linkCaption: raw.ad_creative_link_captions?.[0] || '',
      linkDescription: raw.ad_creative_link_descriptions?.[0] || '',
      snapshotUrl: raw.ad_snapshot_url || '',
      startDate: raw.ad_delivery_start_time || raw.ad_creation_time || '',
      platforms: raw.publisher_platforms || [],
      impressionsMin,
      impressionsMax,
      spendMin,
      spendMax,
      currency: raw.currency || 'EUR',
      demographics,
      languages: raw.languages || [],
      regions: (raw.delivery_by_region || []).map((r: any) => ({
        region: r.region,
        percentage: parseFloat(r.percentage || '0'),
      })),
    };
  }
}
