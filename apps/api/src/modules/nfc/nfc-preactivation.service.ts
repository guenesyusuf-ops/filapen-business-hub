import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { NfcService } from './nfc.service';

export interface PreActivateInput {
  customerEmail: string;
  customerName?: string;
  count: number;
  batchId?: string; // optional — sonst aus jeder unassigned Band gepickt
  note?: string;
}

@Injectable()
export class NfcPreActivationService {
  private readonly logger = new Logger(NfcPreActivationService.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly nfc: NfcService,
    private readonly config: ConfigService,
  ) {
    this.publicBaseUrl = (this.config.get<string>('NFC_PUBLIC_URL') ?? 'https://nfc4you.de').replace(/\/$/, '');
  }

  /**
   * Weist `count` Baender einer Kunden-E-Mail zu und versendet die Bulk-Mail
   * mit den Aktivierungs-Links.
   *
   * Quellen:
   *  - Wenn batchId gesetzt: aus diesem Batch picken
   *  - Sonst: aus allen unassigned + inactive Baendern picken (FIFO)
   */
  async assignAndSend(orgId: string, userId: string, input: PreActivateInput) {
    const email = input.customerEmail?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-Mail ungueltig');
    }
    if (!Number.isFinite(input.count) || input.count <= 0 || input.count > 1000) {
      throw new BadRequestException('Anzahl muss zwischen 1 und 1000 sein');
    }

    const where: any = {
      orgId,
      status: 'inactive',
      assignedEmail: null,
    };
    if (input.batchId) where.batchId = input.batchId;

    const bands = await this.prisma.nfcBand.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: input.count,
    });

    if (bands.length === 0) {
      throw new BadRequestException('Keine verfuegbaren Baender (alle bereits zugewiesen oder aktiviert)');
    }
    if (bands.length < input.count) {
      throw new BadRequestException(`Nur ${bands.length} freie Baender verfuegbar (angefragt: ${input.count})`);
    }

    const now = new Date();
    const ids = bands.map((b) => b.id);
    await this.prisma.nfcBand.updateMany({
      where: { id: { in: ids } },
      data: {
        assignedEmail: email,
        assignedAt: now,
        assignmentNote: input.note?.trim().slice(0, 255) || null,
      },
    });

    // Email mit allen Codes versenden
    const sentOk = await this.email.sendNfcActivationLinks({
      to: email,
      customerName: input.customerName?.trim() || undefined,
      bands: bands.map((b) => ({ code: b.code, url: `${this.publicBaseUrl}/${b.code}` })),
    });

    await this.nfc.audit(orgId, null, userId, 'pre_activation_assigned', {
      email, count: bands.length, batchId: input.batchId, emailSent: sentOk,
    });

    return {
      ok: true,
      assignedCount: bands.length,
      emailSent: sentOk,
      codes: bands.map((b) => b.code),
    };
  }

  /** Stats fuer das Hub: Anzahl unassigned + assigned + zuletzt versandte Listen. */
  async stats(orgId: string) {
    const [unassigned, assigned, recentAssignments] = await Promise.all([
      this.prisma.nfcBand.count({
        where: { orgId, status: 'inactive', assignedEmail: null },
      }),
      this.prisma.nfcBand.count({
        where: { orgId, status: 'inactive', assignedEmail: { not: null } },
      }),
      this.prisma.nfcBand.groupBy({
        by: ['assignedEmail'],
        where: { orgId, assignedEmail: { not: null } },
        _count: { _all: true },
        _max: { assignedAt: true },
        orderBy: { _max: { assignedAt: 'desc' } },
        take: 20,
      }),
    ]);
    return {
      unassigned,
      assigned,
      recentAssignments: recentAssignments.map((r) => ({
        email: r.assignedEmail,
        count: r._count._all,
        assignedAt: r._max.assignedAt,
      })),
    };
  }
}
