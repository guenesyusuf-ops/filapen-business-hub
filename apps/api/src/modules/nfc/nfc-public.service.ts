import { Injectable, BadRequestException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { NfcService } from './nfc.service';

const PIN_HASH_ROUNDS = 10;
const PIN_MIN = 4;
const PIN_MAX = 6;
const PIN_MAX_ATTEMPTS = 10;
const PIN_LOCK_MINUTES = 60;
const RESET_TOKEN_TTL_MIN = 15;
const CONSENT_VERSION = '2026-06-15-v1';

export interface ActivationInput {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  phone2?: string | null;
  notes?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  email?: string | null;
  pin?: string | null;        // optional bei Aktivierung
  consent: boolean;
}

@Injectable()
export class NfcPublicService {
  private readonly logger = new Logger(NfcPublicService.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly nfc: NfcService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {
    this.publicBaseUrl = (this.config.get<string>('NFC_PUBLIC_URL') ?? 'https://nfc4you.de').replace(/\/$/, '');
  }

  // ---------------------------------------------------------------------
  // STATUS / SCAN — was rendert das Frontend
  // ---------------------------------------------------------------------

  /**
   * Anonyme Status-Abfrage fuer den Browser. Gibt nur das zurueck was
   * der Browser darstellen darf:
   *   - status: inactive → Frontend zeigt Activate-Formular
   *   - status: active → Frontend zeigt Profil mit Anruf-Button
   *   - status: notfound → Code unbekannt
   *
   * NIEMALS PIN-Hash oder Audit-Daten zurueckgeben.
   */
  async getPublicStatus(code: string, ip?: string, userAgent?: string) {
    const band = await this.nfc.findBandByCode(code);
    if (!band) return { status: 'notfound' as const };

    // Scan tracken (best effort)
    await this.prisma.nfcBand.update({
      where: { id: band.id },
      data: { lastScanAt: new Date(), scanCount: { increment: 1 } },
    }).catch(() => undefined);
    // Audit fire-and-forget — internes try/catch in audit()
    void this.nfc.audit(band.orgId, band.id, null, 'public_scan', { code }, ip, userAgent);

    if (band.status === 'inactive' || !band.activation) {
      return { status: 'inactive' as const, code: band.code };
    }
    if (band.status === 'deleted') {
      // Wenn Eltern ihre Daten geloescht haben — wieder zur Aktivierung
      return { status: 'inactive' as const, code: band.code };
    }

    const a = band.activation;
    return {
      status: 'active' as const,
      code: band.code,
      data: {
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        phone2: a.phone2,
        notes: a.notes,
        street: a.street,
        zip: a.zip,
        city: a.city,
        // editEnabled: zeigt das Frontend einen "Daten aendern"-Button an
        editEnabled: !!a.editPinHash,
      },
    };
  }

  // ---------------------------------------------------------------------
  // ACTIVATE
  // ---------------------------------------------------------------------

  async activate(code: string, input: ActivationInput, ip?: string, userAgent?: string) {
    const band = await this.nfc.findBandByCode(code);
    if (!band) throw new NotFoundException('Code nicht bekannt');
    if (band.activation && band.status === 'active') {
      throw new BadRequestException('Dieses Band ist bereits aktiviert');
    }

    if (!input.consent) {
      throw new BadRequestException('Bitte Datenschutzerklärung bestätigen');
    }

    // PIN validieren (wenn angegeben)
    let editPinHash: string | null = null;
    if (input.pin && input.pin.trim()) {
      const pin = input.pin.trim();
      if (!/^[0-9]+$/.test(pin)) throw new BadRequestException('PIN nur Ziffern');
      if (pin.length < PIN_MIN || pin.length > PIN_MAX) {
        throw new BadRequestException(`PIN muss ${PIN_MIN}-${PIN_MAX} Ziffern haben`);
      }
      editPinHash = await bcrypt.hash(pin, PIN_HASH_ROUNDS);
    }

    // Email validieren (wenn angegeben)
    const email = input.email?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-Mail ungültig');
    }

    const data: any = {
      bandId: band.id,
      orgId: band.orgId,
      firstName: clean(input.firstName, 120),
      lastName:  clean(input.lastName, 120),
      phone:     clean(input.phone, 64),
      phone2:    clean(input.phone2, 64),
      notes:     input.notes?.trim() || null,
      street:    clean(input.street, 255),
      zip:       clean(input.zip, 32),
      city:      clean(input.city, 120),
      email,
      editPinHash,
      editPinSetAt: editPinHash ? new Date() : null,
      consentGivenAt: new Date(),
      consentVersion: CONSENT_VERSION,
      activationIp: ip ?? null,
      activationUa: userAgent?.slice(0, 500) ?? null,
    };

    // Wenn bereits eine Activation existiert (Kunde hatte deletet vorher und aktiviert neu) → upsert
    if (band.activation) {
      await this.prisma.nfcActivation.update({
        where: { id: band.activation.id },
        data: {
          ...data,
          editPinFailedAttempts: 0,
          editPinLockedUntil: null,
        },
      });
    } else {
      await this.prisma.nfcActivation.create({ data });
    }

    await this.prisma.nfcBand.update({
      where: { id: band.id },
      data: { status: 'active', activatedAt: band.activatedAt ?? new Date() },
    });

    await this.nfc.audit(band.orgId, band.id, null, 'band_activated', { code, pinSet: !!editPinHash, hasEmail: !!email }, ip, userAgent);

    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // EDIT — mit PIN-Auth
  // ---------------------------------------------------------------------

  /** Prueft PIN und gibt die aktuellen Daten zurueck. Wird vor /edit aufgerufen. */
  async authenticate(code: string, pin: string, ip?: string, userAgent?: string) {
    const band = await this.nfc.findBandByCode(code);
    if (!band || !band.activation) throw new NotFoundException('Band nicht aktiviert');
    const a = band.activation;
    if (!a.editPinHash) {
      throw new BadRequestException('Für dieses Band wurde keine PIN festgelegt — Self-Service-Edit nicht möglich');
    }

    // Lock-Check
    if (a.editPinLockedUntil && a.editPinLockedUntil > new Date()) {
      const remainingMin = Math.ceil((a.editPinLockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Zu viele Fehlversuche — gesperrt für noch ~${remainingMin} Minuten`);
    }

    const ok = await bcrypt.compare(pin, a.editPinHash);
    if (!ok) {
      const nextAttempts = a.editPinFailedAttempts + 1;
      const update: any = { editPinFailedAttempts: nextAttempts };
      if (nextAttempts >= PIN_MAX_ATTEMPTS) {
        const lock = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000);
        update.editPinLockedUntil = lock;
        update.editPinFailedAttempts = 0;
      }
      await this.prisma.nfcActivation.update({ where: { id: a.id }, data: update });
      await this.nfc.audit(band.orgId, band.id, null, 'edit_pin_failed', { attempts: nextAttempts }, ip, userAgent);
      throw new UnauthorizedException('PIN falsch');
    }

    // Reset auf Erfolg
    if (a.editPinFailedAttempts > 0 || a.editPinLockedUntil) {
      await this.prisma.nfcActivation.update({
        where: { id: a.id },
        data: { editPinFailedAttempts: 0, editPinLockedUntil: null },
      });
    }
    await this.nfc.audit(band.orgId, band.id, null, 'edit_pin_success', null, ip, userAgent);

    return {
      ok: true,
      data: {
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        phone2: a.phone2,
        notes: a.notes,
        street: a.street,
        zip: a.zip,
        city: a.city,
        email: a.email,
        hasPin: true,
      },
    };
  }

  async updateData(code: string, pin: string, input: ActivationInput, ip?: string, userAgent?: string) {
    // Re-Auth
    const auth = await this.authenticate(code, pin, ip, userAgent);
    if (!auth.ok) throw new UnauthorizedException();
    const band = await this.nfc.findBandByCode(code);
    if (!band || !band.activation) throw new NotFoundException();

    // Email validieren
    const email = input.email?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-Mail ungültig');
    }

    // Optional PIN neu setzen
    let pinUpdate: any = {};
    if (input.pin && input.pin.trim() && input.pin.trim() !== pin) {
      const newPin = input.pin.trim();
      if (!/^[0-9]+$/.test(newPin)) throw new BadRequestException('PIN nur Ziffern');
      if (newPin.length < PIN_MIN || newPin.length > PIN_MAX) {
        throw new BadRequestException(`PIN muss ${PIN_MIN}-${PIN_MAX} Ziffern haben`);
      }
      pinUpdate = {
        editPinHash: await bcrypt.hash(newPin, PIN_HASH_ROUNDS),
        editPinSetAt: new Date(),
      };
    }

    await this.prisma.nfcActivation.update({
      where: { id: band.activation.id },
      data: {
        firstName: clean(input.firstName, 120),
        lastName:  clean(input.lastName, 120),
        phone:     clean(input.phone, 64),
        phone2:    clean(input.phone2, 64),
        notes:     input.notes?.trim() || null,
        street:    clean(input.street, 255),
        zip:       clean(input.zip, 32),
        city:      clean(input.city, 120),
        email,
        ...pinUpdate,
      },
    });

    await this.nfc.audit(band.orgId, band.id, null, 'customer_edit', { hasNewPin: !!pinUpdate.editPinHash }, ip, userAgent);
    return { ok: true };
  }

  async deleteData(code: string, pin: string, ip?: string, userAgent?: string) {
    await this.authenticate(code, pin, ip, userAgent);
    const band = await this.nfc.findBandByCode(code);
    if (!band || !band.activation) throw new NotFoundException();

    await this.prisma.$transaction([
      this.prisma.nfcActivation.delete({ where: { id: band.activation.id } }),
      this.prisma.nfcBand.update({
        where: { id: band.id },
        data: { status: 'deleted' },
      }),
    ]);
    await this.nfc.audit(band.orgId, band.id, null, 'customer_delete', null, ip, userAgent);
    return { ok: true };
  }

  // ---------------------------------------------------------------------
  // PIN-Reset via Magic-Link (wenn User PIN vergessen hat)
  // ---------------------------------------------------------------------

  /** Schritt 1: User gibt seine Email an, wir senden Magic-Link mit Token */
  async requestPinReset(code: string, email: string, ip?: string, userAgent?: string) {
    const band = await this.nfc.findBandByCode(code);
    if (!band || !band.activation) {
      // Nicht enthuellen ob Band existiert (Privacy)
      return { ok: true };
    }
    const a = band.activation;
    if (!a.email || a.email.toLowerCase() !== email.trim().toLowerCase()) {
      // Email passt nicht — wir geben aber TROTZDEM ok zurueck (User-Enumeration verhindern)
      return { ok: true };
    }

    // Token generieren + Hash speichern
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, PIN_HASH_ROUNDS);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);

    await this.prisma.nfcActivation.update({
      where: { id: a.id },
      data: {
        pinResetTokenHash: tokenHash,
        pinResetTokenExpiresAt: expiresAt,
      },
    });

    // Magic-Link senden
    const resetLink = `${this.publicBaseUrl}/${code}/reset?token=${token}`;
    const sent = await this.email.sendNfcPinReset({ to: a.email, code, resetLink });
    await this.nfc.audit(band.orgId, band.id, null, 'pin_reset_requested', { emailSent: sent }, ip, userAgent);

    return { ok: true };
  }

  /** Schritt 2: User folgt Link, gibt neue PIN ein. Token wird verbraucht. */
  async resetPin(code: string, token: string, newPin: string, ip?: string, userAgent?: string) {
    if (!token) throw new BadRequestException('Token fehlt');
    if (!/^[0-9]+$/.test(newPin)) throw new BadRequestException('PIN nur Ziffern');
    if (newPin.length < PIN_MIN || newPin.length > PIN_MAX) {
      throw new BadRequestException(`PIN muss ${PIN_MIN}-${PIN_MAX} Ziffern haben`);
    }

    const band = await this.nfc.findBandByCode(code);
    if (!band || !band.activation) throw new NotFoundException();
    const a = band.activation;

    if (!a.pinResetTokenHash || !a.pinResetTokenExpiresAt) {
      throw new BadRequestException('Kein Reset angefordert');
    }
    if (a.pinResetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Reset-Link abgelaufen — bitte neu anfordern');
    }
    const ok = await bcrypt.compare(token, a.pinResetTokenHash);
    if (!ok) {
      await this.nfc.audit(band.orgId, band.id, null, 'pin_reset_invalid_token', null, ip, userAgent);
      throw new UnauthorizedException('Ungültiger Token');
    }

    const newHash = await bcrypt.hash(newPin, PIN_HASH_ROUNDS);
    await this.prisma.nfcActivation.update({
      where: { id: a.id },
      data: {
        editPinHash: newHash,
        editPinSetAt: new Date(),
        editPinFailedAttempts: 0,
        editPinLockedUntil: null,
        // Token verbrauchen
        pinResetTokenHash: null,
        pinResetTokenExpiresAt: null,
      },
    });
    await this.nfc.audit(band.orgId, band.id, null, 'pin_reset_success', null, ip, userAgent);
    return { ok: true };
  }
}

function clean(v: string | null | undefined, max: number): string | null {
  if (!v) return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}
