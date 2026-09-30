import {
  Controller,
  Get,
  Query,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ShopifyAnalyticsService } from './shopify-analytics.service';
import { AuthService } from '../../auth/auth.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

@Controller('finance/shopify-analytics')
export class ShopifyAnalyticsController {
  private readonly logger = new Logger(ShopifyAnalyticsController.name);

  constructor(
    private readonly service: ShopifyAnalyticsService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Authentifizierung (AUTHENTICATED) — gleiches Muster wie finance/profitability
   * und der Dashboard-Controller: gueltiger Bearer-JWT Pflicht, sonst 401.
   * Keine neue Rollen-/Org-Logik, DEV_ORG_ID unveraendert.
   */
  private requireAuth(authHeader?: string): void {
    if (!authHeader) {
      throw new HttpException('Kein gueltiger Token', HttpStatus.UNAUTHORIZED);
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException('Kein gueltiger Token', HttpStatus.UNAUTHORIZED);
    }
    try {
      this.auth.validateToken(parts[1]);
    } catch {
      throw new HttpException('Kein gueltiger Token', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * GET /api/finance/shopify-analytics/overview?start=YYYY-MM-DD&end=YYYY-MM-DD
   *
   * Returns all DB-backed data for the Shopify Analytics dashboard
   * (18 cards, 6 sections) in a single payload. Defaults to "today".
   * All day boundaries are anchored to Europe/Berlin.
   */
  @Get('overview')
  async getOverview(
    @Query('start') startParam?: string,
    @Query('end') endParam?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    this.requireAuth(authHeader);
    const today = new Date().toISOString().slice(0, 10);
    const start = startParam ?? today;
    const end = endParam ?? start;

    if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
      throw new HttpException(
        'Invalid date format. Expected YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (start > end) {
      throw new HttpException(
        'start must be <= end',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.service.getOverview(DEV_ORG_ID, start, end);
    } catch (error) {
      this.logger.error('Failed to get Shopify analytics overview', error);
      throw new HttpException(
        'Failed to load Shopify analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
