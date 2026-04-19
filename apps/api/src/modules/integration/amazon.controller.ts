import { Controller, Get, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AmazonService } from './amazon.service';

@Controller('amazon')
export class AmazonController {
  private readonly logger = new Logger(AmazonController.name);

  constructor(private readonly amazon: AmazonService) {}

  @Get('status')
  async status() {
    return { configured: this.amazon.isConfigured };
  }

  @Get('dashboard')
  async dashboard() {
    if (!this.amazon.isConfigured) {
      throw new HttpException('Amazon SP-API nicht konfiguriert', HttpStatus.SERVICE_UNAVAILABLE);
    }
    try {
      return await this.amazon.getDashboardSummary();
    } catch (err) {
      this.logger.error('Amazon dashboard failed:', err);
      throw new HttpException('Amazon-Daten konnten nicht geladen werden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('orders')
  async orders(@Query('days') daysStr?: string) {
    if (!this.amazon.isConfigured) {
      throw new HttpException('Amazon SP-API nicht konfiguriert', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const days = parseInt(daysStr || '30', 10) || 30;
    try {
      return await this.amazon.getOrders(days);
    } catch (err) {
      this.logger.error('Amazon orders failed:', err);
      throw new HttpException('Amazon-Bestellungen konnten nicht geladen werden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('finance')
  async finance(@Query('days') daysStr?: string) {
    if (!this.amazon.isConfigured) {
      throw new HttpException('Amazon SP-API nicht konfiguriert', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const days = parseInt(daysStr || '30', 10) || 30;
    try {
      return await this.amazon.getFinancialEvents(days);
    } catch (err) {
      this.logger.error('Amazon finance failed:', err);
      throw new HttpException('Amazon-Finanzdaten konnten nicht geladen werden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('products')
  async products() {
    if (!this.amazon.isConfigured) {
      throw new HttpException('Amazon SP-API nicht konfiguriert', HttpStatus.SERVICE_UNAVAILABLE);
    }
    try {
      return await this.amazon.getProducts();
    } catch (err) {
      this.logger.error('Amazon products failed:', err);
      throw new HttpException('Amazon-Produkte konnten nicht geladen werden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
