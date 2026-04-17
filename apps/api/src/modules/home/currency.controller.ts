import { Controller, Get, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('home/currency')
export class CurrencyController {
  private readonly logger = new Logger(CurrencyController.name);
  private readonly apiKey: string | null;
  private cache: { rates: Record<string, number>; base: string; fetchedAt: number } | null = null;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('EXCHANGE_API_KEY') || null;
    if (!this.apiKey) {
      this.logger.warn('EXCHANGE_API_KEY not set — currency conversion disabled');
    }
  }

  /**
   * GET /api/home/currency/rates?base=EUR
   * Returns all rates relative to base currency. Cached for 1 hour.
   */
  @Get('rates')
  async getRates(@Query('base') base = 'EUR') {
    if (!this.apiKey) {
      throw new HttpException('EXCHANGE_API_KEY nicht konfiguriert', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // Return cached if < 1 hour old and same base
    if (this.cache && this.cache.base === base && Date.now() - this.cache.fetchedAt < 3_600_000) {
      return { base: this.cache.base, rates: this.cache.rates, cached: true };
    }

    try {
      const url = `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/${base}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Exchange API error: ${res.status} ${body}`);
        throw new HttpException('Wechselkurse konnten nicht geladen werden', HttpStatus.BAD_GATEWAY);
      }

      const data = await res.json();
      if (data.result !== 'success') {
        throw new HttpException(data['error-type'] || 'API Fehler', HttpStatus.BAD_GATEWAY);
      }

      this.cache = { rates: data.conversion_rates, base, fetchedAt: Date.now() };
      return { base, rates: data.conversion_rates, cached: false };
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error('Currency fetch failed', err);
      throw new HttpException('Wechselkurse nicht verfuegbar', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/home/currency/convert?from=EUR&to=USD&amount=100
   */
  @Get('convert')
  async convert(
    @Query('from') from = 'EUR',
    @Query('to') to = 'USD',
    @Query('amount') amountStr = '1',
  ) {
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) throw new HttpException('Ungueltiger Betrag', HttpStatus.BAD_REQUEST);

    const { rates } = await this.getRates(from);
    const rate = rates[to];
    if (!rate) throw new HttpException(`Waehrung "${to}" nicht gefunden`, HttpStatus.BAD_REQUEST);

    return {
      from,
      to,
      amount,
      rate,
      result: Math.round(amount * rate * 100) / 100,
    };
  }
}
