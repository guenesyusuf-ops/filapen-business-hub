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
