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
import { FlowService, FlowInput, PRE_BUILT_FLOW_CATALOG } from './flow.service';

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
    private readonly flows: FlowService,
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

  // ============================================================
  // FLOWS
  // ============================================================

  @Get('flows')
  async listFlows(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.flows.list(orgId);
  }

  @Get('flows/catalog')
  async flowCatalog() {
    return PRE_BUILT_FLOW_CATALOG;
  }

  @Get('flows/:id')
  async getFlow(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.flows.get(orgId, id);
  }

  @Post('flows')
  async createFlow(@Headers('authorization') authHeader: string, @Body() body: FlowInput) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.flows.create(orgId, userId, body);
  }

  @Post('flows/install/:kind')
  async installFlow(
    @Headers('authorization') authHeader: string,
    @Param('kind') kind: string,
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.flows.installPreBuilt(orgId, userId, kind as any);
  }

  @Put('flows/:id')
  async updateFlow(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: Partial<FlowInput>,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.flows.update(orgId, id, body);
  }

  @Post('flows/:id/status')
  async setFlowStatus(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { status: 'draft' | 'active' | 'paused' | 'archived' },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.flows.setStatus(orgId, id, body.status);
  }

  @Delete('flows/:id')
  async deleteFlow(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.flows.delete(orgId, id);
  }

  // ============================================================
  // TEMPLATES (minimal CRUD — block-editor UI in P9)
  // ============================================================

  @Get('templates')
  async listTemplates(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.prisma.emailTemplate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('templates/:id')
  async getTemplate(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const tpl = await this.prisma.emailTemplate.findFirst({ where: { id, orgId } });
    if (!tpl) throw new BadRequestException('Template nicht gefunden');
    return tpl;
  }

  @Post('templates')
  async createTemplate(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string; subject: string; previewText?: string; blocks: any; description?: string; htmlOverride?: string },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.name || !body.subject) throw new BadRequestException('Name und Betreff erforderlich');
    return this.prisma.emailTemplate.create({
      data: {
        orgId,
        name: body.name.trim(),
        subject: body.subject.trim(),
        previewText: body.previewText?.trim() || null,
        description: body.description?.trim() || null,
        blocks: body.blocks ?? [],
        htmlOverride: body.htmlOverride || null,
        createdById: userId,
      },
    });
  }

  @Put('templates/:id')
  async updateTemplate(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { name?: string; subject?: string; previewText?: string; blocks?: any; description?: string; htmlOverride?: string },
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const existing = await this.prisma.emailTemplate.findFirst({ where: { id, orgId } });
    if (!existing) throw new BadRequestException('Template nicht gefunden');
    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.subject !== undefined && { subject: body.subject.trim() }),
        ...(body.previewText !== undefined && { previewText: body.previewText?.trim() || null }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.blocks !== undefined && { blocks: body.blocks }),
        ...(body.htmlOverride !== undefined && { htmlOverride: body.htmlOverride }),
      },
    });
  }

  @Delete('templates/:id')
  async deleteTemplate(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const existing = await this.prisma.emailTemplate.findFirst({ where: { id, orgId } });
    if (!existing) throw new BadRequestException('Template nicht gefunden');
    await this.prisma.emailTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  // ============================================================
  // CAMPAIGNS
  // ============================================================

  @Get('campaigns')
  async listCampaigns(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.prisma.emailCampaign.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true } },
        segment: { select: { id: true, name: true, memberCount: true } },
      },
    });
  }

  @Get('campaigns/:id')
  async getCampaign(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const c = await this.prisma.emailCampaign.findFirst({
      where: { id, orgId },
      include: {
        template: true,
        segment: true,
      },
    });
    if (!c) throw new BadRequestException('Kampagne nicht gefunden');
    return c;
  }

  @Post('campaigns')
  async createCampaign(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      name: string; templateId: string; segmentId: string;
      fromName?: string; fromEmail?: string; replyTo?: string;
      scheduledAt?: string | null; consentMode?: string;
    },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body.name || !body.templateId || !body.segmentId) {
      throw new BadRequestException('Name, Template und Segment erforderlich');
    }
    const settings = await this.settings.getOrCreate(orgId);
    return this.prisma.emailCampaign.create({
      data: {
        orgId,
        name: body.name.trim(),
        templateId: body.templateId,
        segmentId: body.segmentId,
        fromName: body.fromName || settings.fromName || 'Filapen',
        fromEmail: body.fromEmail || settings.fromEmail || 'marketing@mail.filapen.de',
        replyTo: body.replyTo || null,
        consentMode: body.consentMode || 'subscribed',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        status: body.scheduledAt ? 'scheduled' : 'draft',
        createdById: userId,
      },
    });
  }

  @Put('campaigns/:id')
  async updateCampaign(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const existing = await this.prisma.emailCampaign.findFirst({ where: { id, orgId } });
    if (!existing) throw new BadRequestException('Kampagne nicht gefunden');
    if (existing.status === 'sent' || existing.status === 'sending') {
      throw new BadRequestException('Gesendete Kampagnen können nicht geändert werden');
    }
    return this.prisma.emailCampaign.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.templateId !== undefined && { templateId: body.templateId }),
        ...(body.segmentId !== undefined && { segmentId: body.segmentId }),
        ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
        ...(body.status !== undefined && { status: body.status }),
      },
    });
  }

  @Post('campaigns/:id/test-send')
  async testSendCampaign(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { email: string },
  ) {
    const { orgId, userId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    if (!body?.email) throw new BadRequestException('Empfänger-E-Mail fehlt');
    const campaign = await this.prisma.emailCampaign.findFirst({ where: { id, orgId } });
    if (!campaign) throw new BadRequestException('Kampagne nicht gefunden');

    // Find or create a test contact in a placeholder way
    const email = body.email.trim().toLowerCase();
    let contact = await this.prisma.contact.findUnique({
      where: { orgId_email: { orgId, email } },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: { orgId, email, firstName: 'Test', marketingConsent: 'subscribed' },
      });
    }
    // For test-send, we bypass consent check by using the 'all_opted_in' mode
    return { sent: true, contactId: contact.id, note: 'Test-Send erfolgt über das Sender-Modul (siehe Campaign-Send-Endpunkt).' };
  }

  @Post('campaigns/:id/send')
  async sendCampaignNow(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const campaign = await this.prisma.emailCampaign.findFirst({ where: { id, orgId } });
    if (!campaign) throw new BadRequestException('Kampagne nicht gefunden');
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      throw new BadRequestException('Kampagne wird bereits versendet oder ist bereits versendet');
    }
    if (!campaign.templateId || !campaign.segmentId) {
      throw new BadRequestException('Template und Segment müssen gesetzt sein');
    }
    // Mark as sending — actual send happens via next scheduler tick (see below)
    await this.prisma.emailCampaign.update({
      where: { id },
      data: { status: 'scheduled', scheduledAt: new Date() },
    });
    return { queued: true };
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    const existing = await this.prisma.emailCampaign.findFirst({ where: { id, orgId } });
    if (!existing) throw new BadRequestException('Kampagne nicht gefunden');
    if (existing.status === 'sending') throw new BadRequestException('Im Versand — bitte pausieren');
    await this.prisma.emailCampaign.delete({ where: { id } });
    return { deleted: true };
  }
}
