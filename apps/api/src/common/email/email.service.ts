import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | null;
  private readonly fromEmail: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') || null;
    this.fromEmail = this.config.get<string>(
      'FROM_EMAIL',
      'Filapen <noreply@filapen.com>',
    );
  }

  async sendCreatorInvite(params: {
    to: string;
    creatorName: string;
    inviteCode: string;
    inviteLink: string;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `Email not sent (no RESEND_API_KEY): Invite for ${params.creatorName} -> ${params.to}`,
      );
      this.logger.log(`Invite link: ${params.inviteLink}`);
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `You've been invited to Filapen Creator Portal`,
          html: this.buildInviteHtml(params),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        this.logger.error(`Failed to send email: ${error}`);
        return false;
      }

      this.logger.log(`Invite email sent to ${params.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Email send error: ${error}`);
      return false;
    }
  }

  async sendTeamInvite(params: {
    to: string;
    inviterName: string;
    role: string;
    loginLink: string;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `Email not sent (no RESEND_API_KEY): Team invite -> ${params.to}`,
      );
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `You've been invited to Filapen Business Hub`,
          html: this.buildTeamInviteHtml(params),
        }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sends a team invitation with a temporary password.
   * The recipient uses the temp password to log in, then is forced to change it.
   */
  async sendTeamInviteWithTempPassword(params: {
    to: string;
    roleLabel: string;
    tempPassword: string;
    loginLink: string;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `Email not sent (no RESEND_API_KEY): Team invite with temp password -> ${params.to}`,
      );
      this.logger.log(`Temp password: ${params.tempPassword}`);
      this.logger.log(`Login link: ${params.loginLink}`);
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `Du wurdest zu Filapen Business Hub eingeladen`,
          html: this.buildTeamInviteWithPasswordHtml(params),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        this.logger.error(`Failed to send team invite email: ${error}`);
        return false;
      }

      this.logger.log(`Team invite with temp password sent to ${params.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Team invite email error: ${error}`);
      return false;
    }
  }

  /**
   * Erinnerungsmail fuer eine Eingangsrechnung — 7T/3T vor Faelligkeit,
   * am Faelligkeitstag oder bei Überschreitung.
   */
  async sendInvoiceReminder(params: {
    to: string;
    supplierName: string;
    invoiceNumber: string;
    grossAmount: string;
    dueDate: string;
    daysUntilDue: number; // negative = ueberfaellig
    detailLink: string;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`Email not sent (no RESEND_API_KEY): Invoice reminder ${params.invoiceNumber} -> ${params.to}`);
      return false;
    }
    let subject: string;
    if (params.daysUntilDue < 0) {
      subject = `Überfällig: ${params.supplierName} · ${params.grossAmount}`;
    } else if (params.daysUntilDue === 0) {
      subject = `Heute fällig: ${params.supplierName} · ${params.grossAmount}`;
    } else {
      subject = `In ${params.daysUntilDue} Tagen fällig: ${params.supplierName} · ${params.grossAmount}`;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject,
          html: this.buildInvoiceReminderHtml(params),
        }),
      });
      if (!res.ok) {
        this.logger.error(`Failed to send invoice reminder: ${await res.text()}`);
        return false;
      }
      this.logger.log(`Invoice reminder sent: ${params.invoiceNumber} → ${params.to}`);
      return true;
    } catch (err) {
      this.logger.error(`Invoice reminder error: ${err}`);
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // NFC4you Emails
  // ---------------------------------------------------------------------

  /** PIN-Reset Magic-Link (15 Min gueltig) */
  async sendNfcPinReset(params: { to: string; code: string; resetLink: string }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`Email not sent (no RESEND_API_KEY): NFC PIN-Reset ${params.code} → ${params.to}`);
      this.logger.log(`Reset-Link: ${params.resetLink}`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `NFC4you — PIN zurücksetzen (Code ${params.code})`,
          html: this.buildNfcPinResetHtml(params),
        }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(`NFC PIN-Reset error: ${err}`);
      return false;
    }
  }

  /** 24-Monats-Inaktivitaets-Reminder (DSGVO Aufbewahrung) */
  async sendNfcInactivityReminder(params: { to: string; code: string; profileLink: string }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`Email not sent: NFC Inactivity-Reminder ${params.code} → ${params.to}`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `NFC4you — Daten in 30 Tagen automatisch gelöscht`,
          html: this.buildNfcInactivityReminderHtml(params),
        }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(`NFC Inactivity-Reminder error: ${err}`);
      return false;
    }
  }

  /** Pre-Aktivierung: an Kaeufer mit Liste aller gekauften Codes */
  async sendNfcActivationLinks(params: {
    to: string;
    customerName?: string;
    bands: Array<{ code: string; url: string }>;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`Email not sent: NFC Activation-Links (${params.bands.length}) → ${params.to}`);
      params.bands.forEach((b) => this.logger.log(`  ${b.code}: ${b.url}`));
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `Deine NFC4you-Bänder sind bereit zur Aktivierung`,
          html: this.buildNfcActivationLinksHtml(params),
        }),
      });
      return res.ok;
    } catch (err) {
      this.logger.error(`NFC Activation-Links error: ${err}`);
      return false;
    }
  }

  private buildNfcPinResetHtml(params: { code: string; resetLink: string }): string {
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: #0ea5e9; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">🔑</div>
        </div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111; text-align: center; margin: 0 0 8px 0;">PIN zurücksetzen</h1>
        <p style="font-size: 14px; color: #555; text-align: center; line-height: 1.5; margin: 0 0 24px 0;">
          Du hast eine neue PIN für dein NFC-Band <strong>${params.code}</strong> angefordert.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.resetLink}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600;">
            Neue PIN festlegen
          </a>
        </div>
        <p style="font-size: 12px; color: #888; text-align: center; line-height: 1.5;">
          Der Link ist <strong>15 Minuten</strong> gültig. Wenn du diese Anfrage nicht gestellt hast, ignoriere diese Mail — deine alte PIN bleibt aktiv.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">NFC4you · Sicherheitsbänder für Kinder</p>
      </div>`;
  }

  private buildNfcInactivityReminderHtml(params: { code: string; profileLink: string }): string {
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; background: #f59e0b; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 22px;">⚠️</div>
        </div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111; text-align: center; margin: 0 0 8px 0;">Deine NFC-Daten werden bald gelöscht</h1>
        <p style="font-size: 14px; color: #555; text-align: center; line-height: 1.6; margin: 0 0 16px 0;">
          Dein NFC-Band <strong>${params.code}</strong> wurde seit 24 Monaten nicht mehr aktualisiert.
          Aus DSGVO-Gründen werden die Daten in <strong>30 Tagen automatisch gelöscht</strong>.
        </p>
        <p style="font-size: 14px; color: #555; text-align: center; line-height: 1.6;">
          Möchtest du die Daten behalten? Besuche dein Profil und ändere ggf. einen Wert oder verlängere damit die Aufbewahrung.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${params.profileLink}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600;">
            Profil ansehen
          </a>
        </div>
        <p style="font-size: 12px; color: #888; text-align: center;">
          Wenn du nichts tust, werden die Daten in 30 Tagen automatisch gelöscht. Das Band kann danach jederzeit neu aktiviert werden.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">NFC4you · Sicherheitsbänder für Kinder</p>
      </div>`;
  }

  private buildNfcActivationLinksHtml(params: {
    customerName?: string;
    bands: Array<{ code: string; url: string }>;
  }): string {
    const rows = params.bands.map((b) => `
      <li style="margin-bottom: 10px; list-style: none;">
        <a href="${b.url}" style="display: inline-block; padding: 12px 18px; background: #f0f9ff; border: 1.5px solid #0ea5e9; border-radius: 10px; color: #0369a1; text-decoration: none; font-family: monospace; font-weight: 600; font-size: 15px;">
          ${b.code} →
        </a>
      </li>
    `).join('');

    const greeting = params.customerName ? `Hallo ${params.customerName},` : 'Hallo,';
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 56px; height: 56px; background: #0ea5e9; border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 24px;">📲</div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; text-align: center; margin: 0 0 12px 0;">
          Deine NFC4you-Bänder sind bereit
        </h1>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px 0;">${greeting}</p>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px 0;">
          Vielen Dank für deinen Kauf! Du hast <strong>${params.bands.length} NFC-Band${params.bands.length === 1 ? '' : 'er'}</strong> erhalten.
          Klicke auf einen der Codes unten, um die Daten für dieses Band einzutragen.
        </p>
        <p style="font-size: 13px; color: #777; line-height: 1.6; margin: 0 0 20px 0;">
          Alle Felder sind freiwillig. Wir empfehlen, eine <strong>PIN</strong> festzulegen, damit du später ändern kannst.
        </p>
        <ul style="padding: 0; margin: 24px 0;">
          ${rows}
        </ul>
        <div style="background: #f9fafb; border-radius: 10px; padding: 16px; margin-top: 24px;">
          <strong style="font-size: 13px; color: #111;">So funktioniert es:</strong>
          <ol style="font-size: 13px; color: #555; line-height: 1.7; margin: 8px 0 0 16px;">
            <li>Klicke auf einen Code-Link oben.</li>
            <li>Trage Kontakt-Daten und ggf. PIN ein.</li>
            <li>Halte das physische Band ans Kinder-Outfit.</li>
            <li>Wenn jemand das Band scannt, sieht er sofort einen Anruf-Button mit deiner Nummer.</li>
          </ol>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">NFC4you · Sicherheitsbänder für Kinder</p>
      </div>`;
  }

  private buildInvoiceReminderHtml(params: {
    supplierName: string;
    invoiceNumber: string;
    grossAmount: string;
    dueDate: string;
    daysUntilDue: number;
    detailLink: string;
  }): string {
    const isOverdue = params.daysUntilDue < 0;
    const isToday = params.daysUntilDue === 0;
    const color = isOverdue ? '#dc2626' : isToday ? '#d97706' : '#ea580c';
    const banner = isOverdue
      ? `Überfällig seit ${Math.abs(params.daysUntilDue)} Tag(en)`
      : isToday
        ? 'Heute fällig'
        : `In ${params.daysUntilDue} Tagen fällig`;
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 40px; height: 40px; background: ${color}; border-radius: 10px; line-height: 40px; color: white; font-weight: bold; font-size: 18px;">€</div>
        </div>
        <div style="background: ${color}10; border: 1px solid ${color}40; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
          <div style="font-size: 12px; color: ${color}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 4px;">${banner}</div>
          <div style="font-size: 14px; color: #444;">Fällig am <strong>${params.dueDate}</strong></div>
        </div>
        <h1 style="font-size: 18px; font-weight: 600; color: #111; margin: 0 0 4px 0;">${params.supplierName}</h1>
        <p style="font-size: 13px; color: #888; margin: 0 0 16px 0;">Rechnung Nr. ${params.invoiceNumber || '—'}</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; color: #666;">Brutto-Betrag</span>
          <strong style="font-size: 20px; color: #111;">${params.grossAmount}</strong>
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${params.detailLink}" style="display: inline-block; background: ${color}; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Rechnung öffnen
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          Filapen Business Hub — Automatische Erinnerung
        </p>
      </div>
    `;
  }

  private buildTeamInviteWithPasswordHtml(params: {
    to: string;
    roleLabel: string;
    tempPassword: string;
    loginLink: string;
  }): string {
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 40px; height: 40px; background: #7C3AED; border-radius: 10px; line-height: 40px; color: white; font-weight: bold; font-size: 18px;">F</div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; text-align: center; margin-bottom: 12px;">
          Willkommen bei Filapen Business Hub
        </h1>
        <p style="font-size: 15px; color: #444; text-align: center; margin-bottom: 24px; line-height: 1.5;">
          Du wurdest als <strong>${params.roleLabel}</strong> eingeladen.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
          <p style="font-size: 13px; color: #666; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
            Dein temporaeres Passwort
          </p>
          <p style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #111; margin: 0; letter-spacing: 0.05em;">
            ${params.tempPassword}
          </p>
          <p style="font-size: 12px; color: #999; margin: 12px 0 0 0;">
            Login mit deiner E-Mail-Adresse: <strong>${params.to}</strong>
          </p>
        </div>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${params.loginLink}" style="display: inline-block; background: #7C3AED; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Jetzt anmelden
          </a>
        </div>
        <p style="font-size: 13px; color: #666; text-align: center; line-height: 1.5;">
          Aus Sicherheitsgruenden wirst du beim ersten Login aufgefordert, dein Passwort zu aendern.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          Filapen Business Hub
        </p>
      </div>
    `;
  }

  async sendProjectInvitationEmail(params: {
    to: string;
    creatorName: string;
    projectName: string;
    portalLink: string;
  }): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `Email not sent (no RESEND_API_KEY): Project invite '${params.projectName}' -> ${params.to}`,
      );
      this.logger.log(`Portal link: ${params.portalLink}`);
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [params.to],
          subject: `Du wurdest zu '${params.projectName}' eingeladen`,
          html: this.buildProjectInvitationHtml(params),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        this.logger.error(`Failed to send project invitation email: ${error}`);
        return false;
      }

      this.logger.log(
        `Project invitation email sent to ${params.to} for '${params.projectName}'`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Project invitation email error: ${error}`);
      return false;
    }
  }

  private buildProjectInvitationHtml(params: {
    creatorName: string;
    projectName: string;
    portalLink: string;
  }): string {
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 40px; height: 40px; background: #7C3AED; border-radius: 10px; line-height: 40px; color: white; font-weight: bold; font-size: 18px;">F</div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; text-align: center; margin-bottom: 12px;">
          Hi ${params.creatorName},
        </h1>
        <p style="font-size: 15px; color: #444; text-align: center; margin-bottom: 8px; line-height: 1.5;">
          du wurdest zum neuen Projekt eingeladen:
        </p>
        <p style="font-size: 18px; font-weight: 600; color: #111; text-align: center; margin-bottom: 28px;">
          ${params.projectName}
        </p>
        <p style="font-size: 14px; color: #666; text-align: center; margin-bottom: 28px; line-height: 1.5;">
          Logge dich ins Creator Portal ein, um die Details zu sehen und zu entscheiden, ob du mitmachen moechtest.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${params.portalLink}" style="display: inline-block; background: #7C3AED; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Einladung ansehen
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          Filapen Business Hub - Creator Portal
        </p>
      </div>
    `;
  }

  private buildInviteHtml(params: {
    creatorName: string;
    inviteCode: string;
    inviteLink: string;
  }): string {
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; width: 40px; height: 40px; background: #7C3AED; border-radius: 10px; line-height: 40px; color: white; font-weight: bold; font-size: 18px;">F</div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; text-align: center; margin-bottom: 8px;">
          Welcome to Filapen, ${params.creatorName}!
        </h1>
        <p style="font-size: 15px; color: #666; text-align: center; margin-bottom: 32px; line-height: 1.5;">
          You've been invited to the Creator Portal. Use the link below to access your dashboard.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${params.inviteLink}" style="display: inline-block; background: #7C3AED; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Access Creator Portal
          </a>
        </div>
        <p style="font-size: 13px; color: #999; text-align: center;">
          Your invite code: <strong style="color: #333;">${params.inviteCode}</strong>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          Filapen Business Hub - Creator Portal
        </p>
      </div>
    `;
  }

  private buildTeamInviteHtml(params: {
    inviterName: string;
    role: string;
    loginLink: string;
  }): string {
    return `
      <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 22px; font-weight: 600; color: #111; text-align: center;">
          You've been invited to Filapen
        </h1>
        <p style="font-size: 15px; color: #666; text-align: center; line-height: 1.5;">
          ${params.inviterName} invited you as <strong>${params.role}</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.loginLink}" style="display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Accept Invitation
          </a>
        </div>
      </div>
    `;
  }
}
