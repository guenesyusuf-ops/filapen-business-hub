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
