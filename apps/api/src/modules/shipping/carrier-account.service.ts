import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CarrierRegistry } from './carriers/carrier-registry.service';
import { encryptCredentials, decryptCredentials } from './encryption.util';

export interface CarrierAccountInput {
  carrier: 'dhl' | 'ups' | 'dpd' | 'hermes' | 'gls' | 'custom';
  accountName: string;
  credentials: any; // Plain — will be encrypted at rest
  isDefault?: boolean;
  senderData?: {
    name: string;
    email?: string;
    phone?: string;
    address: { street: string; houseNumber?: string; zip: string; city: string; country: string };
  };
  notes?: string | null;
}

@Injectable()
export class CarrierAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly registry: CarrierRegistry,
  ) {}

  private get secret(): string {
    return (
      this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY') ||
      this.config.get<string>('ENCRYPTION_KEY') ||
      this.config.get<string>('API_SECRET') ||
      'filapen-shipping-fallback-must-rotate-in-production'
    );
  }

  async list(orgId: string) {
    const accounts = await this.prisma.carrierAccount.findMany({
      where: { orgId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    // Never expose raw credentials — indicate presence only
    return accounts.map((a) => ({
      ...a,
      credentials: undefined,
      credentialsSet: !!(a.credentials && Object.keys(a.credentials as any).length > 0),
    }));
  }

  async get(orgId: string, id: string, withCredentials = false) {
    const account = await this.prisma.carrierAccount.findFirst({ where: { id, orgId } });
    if (!account) throw new NotFoundException('Carrier-Konto nicht gefunden');
    if (!withCredentials) return { ...account, credentials: undefined };
    return { ...account, credentials: decryptCredentials(account.credentials, this.secret) };
  }

  /** Internal use by ShipmentService to call the carrier API */
  async loadForUse(orgId: string, accountId: string) {
    const account = await this.prisma.carrierAccount.findFirst({
      where: { id: accountId, orgId },
    });
    if (!account) return null;
    return {
      ...account,
      credentialsDecrypted: decryptCredentials(account.credentials, this.secret),
    };
  }

  async create(orgId: string, userId: string, data: CarrierAccountInput) {
    if (!data.carrier) throw new BadRequestException('Carrier fehlt');
    if (!data.accountName?.trim()) throw new BadRequestException('Kontoname fehlt');

    // Validate credentials via adapter (if provided)
    const adapter = this.registry.get(data.carrier);
    let apiReady = false;
    if (adapter.requiresCredentials && data.credentials && adapter.validateCredentials) {
      const v = adapter.validateCredentials(data.credentials);
      apiReady = v.ok;
      if (!v.ok) {
        // Allow saving incomplete credentials (stub mode) — but mark apiReady=false
      }
    }

    // Un-default all other accounts of same carrier if isDefault=true
    if (data.isDefault) {
      await this.prisma.carrierAccount.updateMany({
        where: { orgId, carrier: data.carrier, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.carrierAccount.create({
      data: {
        orgId,
        carrier: data.carrier,
        accountName: data.accountName.trim(),
        credentials: data.credentials
          ? encryptCredentials(data.credentials, this.secret)
          : {},
        isDefault: !!data.isDefault,
        senderData: data.senderData ? data.senderData as any : null,
        apiReady,
        notes: data.notes?.trim() || null,
        createdById: userId,
      },
    });
  }

  async update(orgId: string, id: string, data: Partial<CarrierAccountInput>) {
    const existing = await this.prisma.carrierAccount.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Carrier-Konto nicht gefunden');

    const patch: any = {};
    if (data.accountName !== undefined) patch.accountName = data.accountName.trim();
    if (data.isDefault !== undefined) patch.isDefault = data.isDefault;
    if (data.senderData !== undefined) patch.senderData = data.senderData as any;
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;

    if (data.credentials !== undefined) {
      // Validate via adapter
      const adapter = this.registry.get(existing.carrier);
      if (adapter.requiresCredentials && data.credentials && adapter.validateCredentials) {
        const v = adapter.validateCredentials(data.credentials);
        patch.apiReady = v.ok;
      } else {
        patch.apiReady = !adapter.requiresCredentials;
      }
      patch.credentials = data.credentials
        ? encryptCredentials(data.credentials, this.secret)
        : {};
    }

    if (patch.isDefault) {
      await this.prisma.carrierAccount.updateMany({
        where: { orgId, carrier: existing.carrier, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.carrierAccount.update({ where: { id }, data: patch });
  }

  async remove(orgId: string, id: string) {
    const existing = await this.prisma.carrierAccount.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Carrier-Konto nicht gefunden');
    await this.prisma.carrierAccount.delete({ where: { id } });
    return { deleted: true };
  }

  /** Find the default account for a carrier. Falls back to first active account. */
  async findDefault(orgId: string, carrier: string) {
    const def = await this.prisma.carrierAccount.findFirst({
      where: { orgId, carrier: carrier as any, status: 'active', isDefault: true },
    });
    if (def) return def;
    return this.prisma.carrierAccount.findFirst({
      where: { orgId, carrier: carrier as any, status: 'active' },
    });
  }
}
