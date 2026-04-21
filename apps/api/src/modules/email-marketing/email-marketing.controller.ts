import { Controller, Get, Headers, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { extractAuthContext } from './auth-context';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('email-marketing')
export class EmailMarketingController {
  private readonly logger = new Logger(EmailMarketingController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('ping')
  async ping(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    return { ok: true, orgId };
  }

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader: string) {
    const { orgId } = extractAuthContext(authHeader, this.auth);
    const [contacts, subscribed, campaigns, flows] = await Promise.all([
      this.prisma.contact.count({ where: { orgId } }),
      this.prisma.contact.count({ where: { orgId, marketingConsent: { in: ['subscribed', 'confirmed'] } } }),
      this.prisma.emailCampaign.count({ where: { orgId } }),
      this.prisma.flow.count({ where: { orgId } }),
    ]);
    return {
      counts: { contacts, subscribed, campaigns, flows },
    };
  }
}
