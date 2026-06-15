import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NfcService } from './nfc.service';

export interface CustomerListQuery {
  search?: string;
  limit?: string;
  offset?: string;
}

/**
 * Service fuer Zugriff auf Kundendaten der aktivierten Baender.
 *
 * DSGVO-Zugriffsschutz:
 *   - Nur User mit Permission 'nfc-customer-data' (Owner/Admin)
 *   - JEDER Zugriff wird im Audit-Log gespeichert (customer_view)
 *   - Loeschungen sind irreversibel
 */
@Injectable()
export class NfcCustomerDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nfc: NfcService,
  ) {}

  async list(orgId: string, userId: string, q: CustomerListQuery) {
    const where: any = { orgId };
    const search = q.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { phone2: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { band: { code: { contains: search.toLowerCase(), mode: 'insensitive' } } },
      ];
    }

    const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const offset = Math.max(0, parseInt(q.offset ?? '0', 10));

    const [items, total] = await Promise.all([
      this.prisma.nfcActivation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          band: { select: { code: true, status: true, lastScanAt: true, scanCount: true } },
        },
      }),
      this.prisma.nfcActivation.count({ where }),
    ]);

    // Audit: listing (kein Detail)
    await this.nfc.audit(orgId, null, userId, 'customer_list_view', { count: items.length, search });

    // Sensible Felder bei Listenansicht maskiert: vollstaendige Namen + Telefon
    // werden erst im Detail angezeigt. Hier nur Identifiers.
    return {
      items: items.map((a) => ({
        id: a.id,
        bandCode: a.band.code,
        bandStatus: a.band.status,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone ? maskPhone(a.phone) : null,
        email: a.email ? maskEmail(a.email) : null,
        city: a.city,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        lastScanAt: a.band.lastScanAt,
        scanCount: a.band.scanCount,
        hasPin: !!a.editPinHash,
      })),
      total,
      limit,
      offset,
    };
  }

  async get(orgId: string, userId: string, activationId: string) {
    const activation = await this.prisma.nfcActivation.findFirst({
      where: { id: activationId, orgId },
      include: { band: true },
    });
    if (!activation) throw new NotFoundException('Datensatz nicht gefunden');

    // Vollzugriff = audit log
    await this.nfc.audit(orgId, activation.bandId, userId, 'customer_view', { activationId });

    return {
      id: activation.id,
      bandCode: activation.band.code,
      bandStatus: activation.band.status,
      firstName: activation.firstName,
      lastName: activation.lastName,
      phone: activation.phone,
      phone2: activation.phone2,
      notes: activation.notes,
      street: activation.street,
      zip: activation.zip,
      city: activation.city,
      email: activation.email,
      hasPin: !!activation.editPinHash,
      consentGivenAt: activation.consentGivenAt,
      consentVersion: activation.consentVersion,
      createdAt: activation.createdAt,
      updatedAt: activation.updatedAt,
      lastScanAt: activation.band.lastScanAt,
      scanCount: activation.band.scanCount,
      activationIp: activation.activationIp,
    };
  }

  /** Admin-Loeschung — z.B. wenn Kunde anruft und Loeschung wuenscht aber keine PIN hat. */
  async deleteByAdmin(orgId: string, userId: string, activationId: string, reason?: string) {
    const activation = await this.prisma.nfcActivation.findFirst({
      where: { id: activationId, orgId },
      select: { id: true, bandId: true },
    });
    if (!activation) throw new NotFoundException('Datensatz nicht gefunden');

    await this.prisma.$transaction([
      this.prisma.nfcActivation.delete({ where: { id: activation.id } }),
      this.prisma.nfcBand.update({
        where: { id: activation.bandId },
        data: { status: 'deleted' },
      }),
    ]);
    await this.nfc.audit(orgId, activation.bandId, userId, 'admin_customer_delete', { reason });
    return { ok: true };
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 5) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-2);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}
