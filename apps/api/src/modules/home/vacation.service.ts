import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { ConfigService } from '@nestjs/config';

/**
 * Urlaubs-Antrag Service.
 *
 * Flow:
 *   1. Mitarbeiter erstellt Antrag → Status 'pending'
 *      → Email an alle Owner/Admin der Org
 *   2. Owner/Admin entscheidet via approve()/reject() mit optionaler Notiz
 *      → Email an Mitarbeiter mit Entscheidung
 *      → Bei approve: Antrag taucht in Kalender aller Org-User auf
 */

export interface CreateVacationRequestInput {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
}

export interface ReviewVacationInput {
  note?: string;
}

@Injectable()
export class VacationService {
  private readonly logger = new Logger(VacationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ---------------- LISTEN ----------------

  /** Eigene Antraege des Users (Historie + Pending). */
  async myRequests(orgId: string, userId: string) {
    return this.prisma.vacationRequest.findMany({
      where: { orgId, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /** Pending Antraege fuer Owner/Admin-Inbox. */
  async pendingRequests(orgId: string) {
    return this.prisma.vacationRequest.findMany({
      where: { orgId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Genehmigte Urlaube in einem Datumsbereich — fuer Kalender-Overlay.
   * "Ueberschneidet sich mit Range" Logik.
   */
  async approvedInRange(orgId: string, from: Date, to: Date) {
    return this.prisma.vacationRequest.findMany({
      where: {
        orgId,
        status: 'approved',
        startDate: { lte: to },
        endDate: { gte: from },
      },
      orderBy: { startDate: 'asc' },
      include: {
        user: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  // ---------------- CREATE ----------------

  async create(orgId: string, userId: string, data: CreateVacationRequestInput) {
    if (!data.startDate || !data.endDate) throw new BadRequestException('Start- und End-Datum erforderlich');
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Datum ungueltig');
    }
    if (end < start) throw new BadRequestException('End-Datum vor Start-Datum');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Benutzer nicht gefunden');

    const created = await this.prisma.vacationRequest.create({
      data: {
        orgId,
        userId,
        startDate: start,
        endDate: end,
        reason: data.reason?.trim() || null,
        status: 'pending',
      },
      include: {
        user: { select: { id: true, name: true, email: true, firstName: true, lastName: true } },
      },
    });

    // Email an Owner/Admin Inbox
    const reviewers = await this.prisma.user.findMany({
      where: { orgId, role: { in: ['owner', 'admin'] as any }, status: 'active' as any },
      select: { id: true, email: true, name: true, firstName: true },
    });

    const requesterName = this.userDisplayName(user);
    await Promise.all(reviewers.map((r) =>
      this.sendRequestEmail(r.email, requesterName, start, end, data.reason)
        .catch((err) => this.logger.warn(`Email an ${r.email} fehlgeschlagen: ${err.message}`)),
    ));

    return created;
  }

  // ---------------- REVIEW (approve / reject) ----------------

  async approve(orgId: string, reviewerId: string, requestId: string, data: ReviewVacationInput) {
    return this.review(orgId, reviewerId, requestId, 'approved', data.note);
  }

  async reject(orgId: string, reviewerId: string, requestId: string, data: ReviewVacationInput) {
    return this.review(orgId, reviewerId, requestId, 'rejected', data.note);
  }

  private async review(orgId: string, reviewerId: string, requestId: string, status: 'approved' | 'rejected', note?: string) {
    const reviewer = await this.prisma.user.findUnique({ where: { id: reviewerId } });
    if (!reviewer || (reviewer.role !== 'owner' && reviewer.role !== 'admin')) {
      throw new ForbiddenException('Nur Owner oder Admin darf Urlaubsantraege entscheiden');
    }
    const existing = await this.prisma.vacationRequest.findFirst({
      where: { id: requestId, orgId },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Antrag nicht gefunden');
    if (existing.status !== 'pending') {
      throw new BadRequestException('Antrag wurde bereits entschieden');
    }

    const updated = await this.prisma.vacationRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note?.trim() || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Mail an Antragsteller
    if (existing.user?.email) {
      const reviewerName = this.userDisplayName(reviewer);
      this.sendDecisionEmail(existing.user.email, this.userDisplayName(existing.user), status, existing.startDate, existing.endDate, reviewerName, note)
        .catch((err) => this.logger.warn(`Decision-Email fehlgeschlagen: ${err.message}`));
    }

    return updated;
  }

  // ---------------- DELETE / CANCEL ----------------

  async cancel(orgId: string, userId: string, requestId: string) {
    const existing = await this.prisma.vacationRequest.findFirst({ where: { id: requestId, orgId } });
    if (!existing) throw new NotFoundException('Antrag nicht gefunden');
    if (existing.userId !== userId) {
      // Owner/Admin darf alles loeschen
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        throw new ForbiddenException('Nur eigener Antrag oder Owner/Admin');
      }
    }
    await this.prisma.vacationRequest.delete({ where: { id: requestId } });
    return { deleted: true };
  }

  // ---------------- INTERNALS ----------------

  private userDisplayName(u: { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string }): string {
    return (
      u.name ||
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
      u.email?.split('@')[0] ||
      'Mitarbeiter'
    );
  }

  private async sendRequestEmail(to: string, requesterName: string, start: Date, end: Date, reason?: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const fromEmail = this.config.get<string>('FROM_EMAIL', 'Filapen <noreply@filapen.com>');
    const appUrl = this.config.get<string>('APP_URL', 'https://app.filapen.com');
    if (!apiKey) {
      this.logger.warn(`Kein RESEND_API_KEY — Urlaubs-Antrag-Email an ${to} skipped`);
      return;
    }
    const fmtDate = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
        <h2 style="color:#7c3aed;margin:0 0 12px">Neuer Urlaubsantrag</h2>
        <p>Hallo,</p>
        <p><strong>${escapeHtml(requesterName)}</strong> hat einen Urlaubsantrag eingereicht:</p>
        <table style="margin:16px 0;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Zeitraum</td><td>${fmtDate(start)} bis ${fmtDate(end)}</td></tr>
          ${reason ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">Grund</td><td>${escapeHtml(reason)}</td></tr>` : ''}
        </table>
        <p>Bitte im Dashboard genehmigen oder ablehnen:</p>
        <p><a href="${appUrl}/home" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Zum Dashboard</a></p>
      </div>
    `;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [to], subject: `Urlaubsantrag von ${requesterName}`, html }),
    });
  }

  private async sendDecisionEmail(
    to: string,
    requesterName: string,
    status: 'approved' | 'rejected',
    start: Date,
    end: Date,
    reviewerName: string,
    note?: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const fromEmail = this.config.get<string>('FROM_EMAIL', 'Filapen <noreply@filapen.com>');
    const appUrl = this.config.get<string>('APP_URL', 'https://app.filapen.com');
    if (!apiKey) {
      this.logger.warn(`Kein RESEND_API_KEY — Decision-Email an ${to} skipped`);
      return;
    }
    const fmtDate = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const approved = status === 'approved';
    const headline = approved ? 'Dein Urlaub wurde genehmigt 🌴' : 'Dein Urlaubsantrag wurde abgelehnt';
    const color = approved ? '#10b981' : '#ef4444';
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
        <h2 style="color:${color};margin:0 0 12px">${headline}</h2>
        <p>Hi ${escapeHtml(requesterName)},</p>
        <p>${escapeHtml(reviewerName)} hat deinen Urlaubsantrag <strong>${approved ? 'genehmigt' : 'abgelehnt'}</strong>:</p>
        <table style="margin:16px 0;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Zeitraum</td><td>${fmtDate(start)} bis ${fmtDate(end)}</td></tr>
          ${note ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">Notiz</td><td>${escapeHtml(note)}</td></tr>` : ''}
        </table>
        <p><a href="${appUrl}/home" style="display:inline-block;background:${color};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Zum Dashboard</a></p>
      </div>
    `;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [to], subject: headline, html }),
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
