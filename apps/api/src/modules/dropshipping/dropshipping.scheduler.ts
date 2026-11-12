import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { DropshippingSyncService } from './dropshipping-sync.service';

/**
 * Stuendlicher Dropshipping-Sync (Master-Entscheidung: 1h).
 * Pro Org wird der lokale Bestellbestand nach Dropship-SKUs durchsucht und den
 * Partnern bereitgestellt. Fehler einer Org brechen die anderen nicht ab.
 */
@Injectable()
export class DropshippingScheduler {
  private readonly logger = new Logger(DropshippingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: DropshippingSyncService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'ds-order-sync' })
  async handleHourlySync() {
    const start = Date.now();
    try {
      const orgs = await this.prisma.organization.findMany({ select: { id: true } });
      let created = 0;
      let updated = 0;
      for (const org of orgs) {
        try {
          const r = await this.sync.syncOrg(org.id, 'cron');
          created += r.created;
          updated += r.updated;
        } catch (err) {
          this.logger.warn(`Dropshipping-Sync fuer Org ${org.id} fehlgeschlagen: ${err}`);
        }
      }
      this.logger.log(
        `Dropshipping hourly sync done in ${Date.now() - start}ms — ${orgs.length} Orgs, ${created} neu, ${updated} aktualisiert`,
      );
    } catch (err) {
      this.logger.error('Dropshipping hourly sync failed', err);
    }
  }
}
