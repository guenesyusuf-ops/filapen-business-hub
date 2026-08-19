import { Controller, Get, Post, Put, Delete, Body, Headers, Param, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext, assertCanWrite } from './auth-context';
import { OverheadService, OverheadTemplateInput, OverheadEntryInputDto } from './overhead.service';

@Controller('profit-analysis/overhead')
export class OverheadController {
  constructor(
    private readonly auth: AuthService,
    private readonly overhead: OverheadService,
  ) {}

  @Get('categories')
  categories() { return { items: this.overhead.categories() }; }

  // Templates ------------------------------------------------------------

  @Get('templates')
  async listTemplates(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { items: await this.overhead.listTemplates(orgId) };
  }

  @Post('templates')
  async createTemplate(@Headers('authorization') authHeader: string, @Body() body: OverheadTemplateInput) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.createTemplate(orgId, body);
  }

  @Put('templates/:id')
  async updateTemplate(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: Partial<OverheadTemplateInput>) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.updateTemplate(orgId, id, body);
  }

  @Delete('templates/:id')
  async deleteTemplate(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.deleteTemplate(orgId, id);
  }

  // Entries pro Monat ----------------------------------------------------

  @Get('months/:year/:month/entries')
  async listEntries(@Headers('authorization') authHeader: string, @Param('year') y: string, @Param('month') m: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return this.overhead.listEntries(orgId, this.n(y), this.n(m));
  }

  @Post('months/:year/:month/entries')
  async createEntry(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
    @Body() body: OverheadEntryInputDto,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.createEntry(orgId, this.n(y), this.n(m), body);
  }

  @Put('entries/:id')
  async updateEntry(@Headers('authorization') authHeader: string, @Param('id') id: string, @Body() body: Partial<OverheadEntryInputDto>) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.updateEntry(orgId, id, body);
  }

  @Delete('entries/:id')
  async deleteEntry(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.deleteEntry(orgId, id);
  }

  @Post('months/:year/:month/apply-templates')
  async applyTemplates(
    @Headers('authorization') authHeader: string,
    @Param('year') y: string, @Param('month') m: string,
  ) {
    const { orgId, role } = extractAuthContext(authHeader, this.auth);
    assertCanWrite(role);
    return this.overhead.applyTemplatesToMonth(orgId, this.n(y), this.n(m));
  }

  private n(s: string) { const v = parseInt(s, 10); if (!Number.isInteger(v)) throw new BadRequestException('Ungueltig'); return v; }
}
