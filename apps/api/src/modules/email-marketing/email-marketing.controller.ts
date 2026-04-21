import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, Logger, BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSettingsService, EmailSettingsInput } from './email-settings.service';
import { MarketingEventService } from './marketing-event.service';
import { ContactSyncService } from './contact-sync.service';
import { SegmentService, SegmentInput, RuleTree } from './segment.service';

@Controller('email-marketing')
export class EmailMarketingController {
  private readonly logger = new Logger(EmailMarketingController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly settings: EmailSettingsService,
    private readonly events: MarketingEventService,
    private readonly contactSync: ContactSyncService,
    private readonly segments: SegmentService,
  ) {}

  // ============================================================
  // DASHBOARD
  // ============================================================

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const [contacts, subscribed, campaigns, flows, segments, templates, suppressed] = await Promise.all([
      this.prisma.contact.count({ where: { orgId } }),
      this.prisma.contact.count({ where: { orgId, marketingConsent: { in: ['subscribed', 'confirmed'] } } }),
      this.prisma.emailCampaign.count({ where: { orgId } }),
      this.prisma.flow.count({ where: { orgId } }),
      this.prisma.segment.count({ where: { orgId } }),
      this.prisma.emailTemplate.count({ where: { orgId } }),
      this.prisma.emailSuppression.count({ where: { orgId } }),
    ]);
    return {
      counts: { contacts, subscribed, campaigns, flows, segments, templates, suppressed },
    };
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  @Get('settings')
  async getSettings(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.settings.getOrCreate(orgId);
  }

  @Put('settings')
  async updateSettings(
    @Headers('authorization') authHeader: string,
    @Body() body: EmailSettingsInput,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.settings.update(orgId, body);
  }

  @Post('settings/rotate-tracking-key')
  async rotateKey(@Headers('authorization') authHeader: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.settings.rotateTrackingKey(orgId);
  }

  // ============================================================
  // CONTACTS
  // ============================================================

  @Get('contacts')
  async listContacts(
    @Headers('authorization') authHeader: string,
    @Query('search') search?: string,
    @Query('consent') consent?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const where: any = { orgId };
    if (consent) where.marketingConsent = consent;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const lim = Math.min(parseInt(limit || '50', 10), 500);
    const off = parseInt(offset || '0', 10);
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: off, take: lim,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { items, total };
  }

  @Get('contacts/:id')
  async getContact(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const contact = await this.prisma.contact.findFirst({
      where: { id, orgId },
      include: {
        shop: { select: { id: true, name: true, domain: true } },
      },
    });
    if (!contact) throw new BadRequestException('Kontakt nicht gefunden');
    const recentEvents = await this.events.listForContact(orgId, id, 100);
    const recentMessages = await this.prisma.emailMessage.findMany({
      where: { orgId, contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { contact, events: recentEvents, messages: recentMessages };
  }

  @Put('contacts/:id/consent')
  async updateContactConsent(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { consent: 'subscribed' | 'confirmed' | 'unsubscribed' },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const contact = await this.prisma.contact.findFirst({ where: { id, orgId } });
    if (!contact) throw new BadRequestException('Kontakt nicht gefunden');
    return this.prisma.contact.update({
      where: { id },
      data: {
        marketingConsent: body.consent,
        ...(body.consent === 'unsubscribed' && { unsubscribedAt: new Date() }),
        ...(body.consent !== 'unsubscribed' && { consentedAt: new Date() }),
      },
    });
  }

  @Post('contacts/:id/resync-stats')
  async resyncStats(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    await this.contactSync.recomputeStatsForContact(orgId, id);
    return { ok: true };
  }

  // ============================================================
  // EVENTS (Read-only, Live-Feed + per contact)
  // ============================================================

  @Get('events/recent')
  async recentEvents(
    @Headers('authorization') authHeader: string,
    @Query('limit') limit?: string,
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const lim = Math.min(parseInt(limit || '100', 10), 500);
    return this.events.recentForOrg(orgId, lim);
  }

  // ============================================================
  // SUPPRESSIONS
  // ============================================================

  @Get('suppressions')
  async listSuppressions(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.prisma.emailSuppression.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Post('suppressions')
  async addSuppression(
    @Headers('authorization') authHeader: string,
    @Body() body: { email: string; reason?: 'unsubscribed' | 'manual'; note?: string },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.email) throw new BadRequestException('Email fehlt');
    const email = body.email.trim().toLowerCase();
    try {
      return await this.prisma.emailSuppression.create({
        data: { orgId, email, reason: body.reason || 'manual', note: body.note?.trim() || null },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException('Email bereits in der Suppression-Liste');
      }
      throw err;
    }
  }

  @Delete('suppressions/:id')
  async removeSuppression(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const existing = await this.prisma.emailSuppression.findFirst({ where: { id, orgId } });
    if (!existing) throw new BadRequestException('Nicht gefunden');
    await this.prisma.emailSuppression.delete({ where: { id } });
    return { deleted: true };
  }

  // ============================================================
  // SEGMENTS
  // ============================================================

  @Get('segments')
  async listSegments(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.segments.list(orgId);
  }

  @Get('segments/:id')
  async getSegment(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.segments.get(orgId, id);
  }

  @Post('segments')
  async createSegment(@Headers('authorization') authHeader: string, @Body() body: SegmentInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.segments.create(orgId, userId, body);
  }

  @Put('segments/:id')
  async updateSegment(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<SegmentInput>,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.segments.update(orgId, id, body);
  }

  @Delete('segments/:id')
  async deleteSegment(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.segments.delete(orgId, id);
  }

  @Post('segments/preview')
  async previewSegment(
    @Headers('authorization') authHeader: string,
    @Body() body: { rules: RuleTree },
  ) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    if (!body?.rules) throw new BadRequestException('Regeln fehlen');
    return this.segments.preview(orgId, body.rules);
  }

  @Post('segments/:id/refresh')
  async refreshSegment(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const count = await this.segments.refreshMemberCount(orgId, id);
    return { count };
  }
}
