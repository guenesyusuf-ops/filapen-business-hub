import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Tool definitions given to the model. The model picks one (or several),
 * we execute it, pipe results back, and let the model summarize.
 *
 * Keep these READ-ONLY for now — no actions. Adding createTask etc. later
 * needs write-scoped permissions + confirmation UI.
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_tasks',
    description:
      'Lists work management tasks, optionally filtered by status (open/completed/overdue), priority, or assignee name. Use this for questions like "what do I need to do", "show open tasks", "overdue tasks".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'completed', 'overdue', 'all'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
        assigneeId: { type: 'string', description: 'Filter to tasks assigned to this user id (use "me" for the caller)' },
        limit: { type: 'number', description: 'Max tasks to return (default 20)' },
      },
    },
  },
  {
    name: 'list_projects',
    description: 'Lists all work-management projects with their task count and status breakdown.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_creators',
    description: 'Lists creators in the Creator Hub, optionally filtered by name or status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Name or partial name to search for' },
        limit: { type: 'number', description: 'Max creators to return (default 20)' },
      },
    },
  },
  {
    name: 'list_team_members',
    description: 'Lists active team members in the organization with their role and last-seen timestamp.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_creator_uploads',
    description:
      'Lists recent creator uploads (photos, videos, etc.), optionally filtered by creator name, live status, or review status. Use for "who uploaded", "pending uploads", "live content".',
    input_schema: {
      type: 'object' as const,
      properties: {
        creatorName: { type: 'string', description: 'Filter by creator name (partial match)' },
        liveStatus: { type: 'string', enum: ['live', 'offline', 'pending'], description: 'Filter by live status' },
        unreviewed: { type: 'boolean', description: 'Only show uploads not yet reviewed by admin' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'shopify_today_summary',
    description:
      'Returns today\'s Shopify revenue, order count and average order value compared to yesterday. Use for "how are we doing today" kind of questions.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'dashboard_kpis',
    description:
      'Returns high-level KPIs: total open tasks, overdue tasks, completed last 7 days, due today. Use for "how are we doing", "what is the team workload".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_deals',
    description:
      'Lists creator deals (UGC, sponsoring, etc.), optionally filtered by creator name, stage (lead/negotiation/contracted/briefing_sent/content_received/live/completed/cancelled), or payment status. Use for deal pipeline questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        creatorName: { type: 'string', description: 'Filter by creator name (partial match)' },
        stage: { type: 'string', description: 'Filter by deal stage' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_products',
    description:
      'Lists Shopify products, optionally filtered by title/name or category. Shows title, status, vendor, variant count. Use for product-related questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Filter by product title (partial match)' },
        category: { type: 'string', description: 'Filter by category' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'order_revenue_summary',
    description:
      'Aggregated revenue and order stats for a custom date range, optionally grouped by product or top-N products. Use for "revenue this week", "top products by revenue", "how many orders this month".',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Start date ISO (e.g. 2026-04-01)' },
        to: { type: 'string', description: 'End date ISO (e.g. 2026-04-16)' },
        topProducts: { type: 'number', description: 'Return top N products by revenue' },
      },
    },
  },
  {
    name: 'list_influencers',
    description:
      'Lists influencer profiles from the Influencer Hub, optionally filtered by platform, niche, or min followers. Use for discovery or watchlist-related questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: { type: 'string', description: 'Filter by platform (instagram, tiktok, youtube...)' },
        niche: { type: 'string', description: 'Filter by niche (partial match)' },
        minFollowers: { type: 'number', description: 'Minimum follower count' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_content_pieces',
    description:
      'Lists content pieces from the Content Hub (blog posts, UGC scripts, hooks, etc.), optionally filtered by type, status (draft/published/archived), or tags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', description: 'Content type (headline, primary_text, ugc_script, hook, video_concept)' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], description: 'Filter by status' },
        search: { type: 'string', description: 'Search in title (partial match)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_briefings',
    description:
      'Lists creator briefings, optionally filtered by product name, status, or creator name. Use for questions about briefings, scripts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productName: { type: 'string', description: 'Filter by product name (partial match)' },
        status: { type: 'string', description: 'Filter by briefing status' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
];

const SYSTEM_PROMPT = `Du bist "Filapen Assistant", der KI-Copilot fuer die Filapen Business Hub Software. Antworte immer auf Deutsch, knapp und handlungsorientiert.

Regeln:
- Nutze die bereitgestellten Tools, wenn du echte Daten brauchst — niemals Zahlen erfinden.
- Wenn mehrere Tools noetig sind, rufe sie nacheinander auf.
- Formatiere Listen kompakt mit Bullet-Points.
- Wenn der User nach Zahlen/KPIs fragt und kein passendes Tool existiert, sag das ehrlich.
- Halte Antworten unter 150 Woertern, ausser der User bittet explizit um Details.
- Verwende Icons/Emojis sparsam (max 1-2 pro Antwort).`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — Ask Filapen will return a configuration error.');
    }
  }

  async ask(userId: string, query: string): Promise<{ answer: string; steps?: string[] }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Ask Filapen ist nicht konfiguriert. Bitte setze ANTHROPIC_API_KEY in den Server-Variablen.',
      );
    }
    if (!query.trim()) throw new BadRequestException('Frage darf nicht leer sein');

    // Max 5 agentic rounds to prevent runaway tool loops
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: query },
    ];
    const steps: string[] = [];

    for (let round = 0; round < 5; round++) {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // If the model wants to use tools, execute them and loop
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          steps.push(`🔧 ${toolUse.name}(${JSON.stringify(toolUse.input).slice(0, 80)})`);
          const result = await this.executeTool(toolUse.name, toolUse.input as any, userId);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result).slice(0, 8000), // keep context small
          });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Otherwise, the model is done — return the text answer
      const textBlocks = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      return { answer: textBlocks || 'Keine Antwort erzeugt.', steps };
    }

    return { answer: 'Anfrage zu komplex — bitte praeziser formulieren.', steps };
  }

  // -------------------------------------------------------------------------
  // Tool implementations
  // -------------------------------------------------------------------------

  private async executeTool(name: string, input: any, userId: string): Promise<unknown> {
    try {
      switch (name) {
        case 'list_tasks':
          return this.tool_listTasks(input, userId);
        case 'list_projects':
          return this.tool_listProjects();
        case 'list_creators':
          return this.tool_listCreators(input);
        case 'list_creator_uploads':
          return this.tool_listCreatorUploads(input);
        case 'list_team_members':
          return this.tool_listTeamMembers();
        case 'shopify_today_summary':
          return this.tool_shopifyToday();
        case 'dashboard_kpis':
          return this.tool_dashboardKpis();
        case 'list_deals':
          return this.tool_listDeals(input);
        case 'list_products':
          return this.tool_listProducts(input);
        case 'order_revenue_summary':
          return this.tool_orderRevenueSummary(input);
        case 'list_influencers':
          return this.tool_listInfluencers(input);
        case 'list_content_pieces':
          return this.tool_listContentPieces(input);
        case 'list_briefings':
          return this.tool_listBriefings(input);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: any) {
      this.logger.error(`Tool ${name} failed:`, err);
      return { error: err?.message || 'Tool execution failed' };
    }
  }

  private async tool_listTasks(input: any, userId: string): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID, parentTaskId: null };
    const assigneeId = input?.assigneeId === 'me' ? userId : input?.assigneeId;

    if (assigneeId) {
      const joins = await this.prisma.wmTaskAssignee.findMany({
        where: { userId: assigneeId },
        select: { taskId: true },
      });
      const ids = joins.map((j) => j.taskId);
      where.OR = [{ assigneeId }, ...(ids.length ? [{ id: { in: ids } }] : [])];
    }

    if (input?.priority) where.priority = input.priority;

    const today = new Date(new Date().toDateString());
    if (input?.status === 'open') where.completed = false;
    else if (input?.status === 'completed') where.completed = true;
    else if (input?.status === 'overdue') {
      where.completed = false;
      where.dueDate = { lt: today };
    }

    const tasks = await this.prisma.wmTask.findMany({
      where,
      select: {
        id: true,
        title: true,
        priority: true,
        completed: true,
        dueDate: true,
        assigneeId: true,
        projectId: true,
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }],
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: tasks.length, tasks };
  }

  private async tool_listProjects(): Promise<unknown> {
    const projects = await this.prisma.wmProject.findMany({
      where: { orgId: DEV_ORG_ID },
      include: { _count: { select: { tasks: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      taskCount: p._count.tasks,
      memberCount: p._count.members,
    }));
  }

  private async tool_listCreators(input: any): Promise<unknown> {
    const creators = await this.prisma.creator.findMany({
      where: {
        orgId: DEV_ORG_ID,
        ...(input?.search ? { name: { contains: input.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        platform: true,
        followerCount: true,
        status: true,
        totalDeals: true,
        totalSpend: true,
        _count: { select: { uploads: true } },
      },
      take: Math.min(input?.limit || 20, 50),
      orderBy: { createdAt: 'desc' },
    });
    return {
      count: creators.length,
      creators: creators.map((c) => ({
        ...c,
        uploadCount: c._count.uploads,
        _count: undefined,
      })),
    };
  }

  private async tool_listTeamMembers(): Promise<unknown> {
    const cutoff = new Date(Date.now() - 5 * 60_000);
    const users = await this.prisma.user.findMany({
      where: { orgId: DEV_ORG_ID, status: 'active' },
      select: { id: true, name: true, email: true, role: true, lastActiveAt: true },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name || u.email.split('@')[0],
      email: u.email,
      role: u.role,
      online: u.lastActiveAt ? u.lastActiveAt > cutoff : false,
      lastActiveAt: u.lastActiveAt,
    }));
  }

  private async tool_shopifyToday(): Promise<unknown> {
    const today = new Date();
    const startOfToday = new Date(today.toDateString());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const [todayOrders, yesterdayOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: { orgId: DEV_ORG_ID, placedAt: { gte: startOfToday } },
        select: { totalPrice: true },
      }),
      this.prisma.order.findMany({
        where: {
          orgId: DEV_ORG_ID,
          placedAt: { gte: startOfYesterday, lt: startOfToday },
        },
        select: { totalPrice: true },
      }),
    ]);

    const sum = (rows: { totalPrice: any }[]) =>
      rows.reduce((acc, r) => acc + Number(r.totalPrice ?? 0), 0);
    const todayRevenue = sum(todayOrders);
    const yesterdayRevenue = sum(yesterdayOrders);
    const delta = yesterdayRevenue ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

    return {
      todayRevenue: todayRevenue.toFixed(2),
      todayOrders: todayOrders.length,
      averageOrderValue: todayOrders.length ? (todayRevenue / todayOrders.length).toFixed(2) : '0',
      yesterdayRevenue: yesterdayRevenue.toFixed(2),
      deltaPercentVsYesterday: delta !== null ? delta.toFixed(1) : null,
      currency: 'EUR',
    };
  }

  private async tool_listCreatorUploads(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };

    if (input?.liveStatus) where.liveStatus = input.liveStatus;
    if (input?.unreviewed) where.seenByAdmin = false;

    // Filter by creator name via a sub-query
    if (input?.creatorName) {
      const creators = await this.prisma.creator.findMany({
        where: {
          orgId: DEV_ORG_ID,
          name: { contains: input.creatorName, mode: 'insensitive' as const },
        },
        select: { id: true },
      });
      where.creatorId = { in: creators.map((c) => c.id) };
    }

    const uploads = await this.prisma.creatorUpload.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        tab: true,
        liveStatus: true,
        seenByAdmin: true,
        createdAt: true,
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });

    return {
      count: uploads.length,
      uploads: uploads.map((u) => ({
        id: u.id,
        fileName: u.fileName,
        fileType: u.fileType,
        tab: u.tab,
        liveStatus: u.liveStatus,
        reviewed: u.seenByAdmin,
        creatorName: u.creator.name,
        createdAt: u.createdAt,
      })),
    };
  }

  private async tool_dashboardKpis(): Promise<unknown> {
    const today = new Date(new Date().toDateString());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalOpen, overdue, completedLast7, dueToday, totalCreators, totalUploads] =
      await Promise.all([
        this.prisma.wmTask.count({
          where: { orgId: DEV_ORG_ID, parentTaskId: null, completed: false },
        }),
        this.prisma.wmTask.count({
          where: {
            orgId: DEV_ORG_ID,
            parentTaskId: null,
            completed: false,
            dueDate: { lt: today },
          },
        }),
        this.prisma.wmTask.count({
          where: {
            orgId: DEV_ORG_ID,
            parentTaskId: null,
            completed: true,
            completedAt: { gte: sevenDaysAgo },
          },
        }),
        this.prisma.wmTask.count({
          where: {
            orgId: DEV_ORG_ID,
            parentTaskId: null,
            completed: false,
            dueDate: { gte: today, lt: new Date(today.getTime() + 86_400_000) },
          },
        }),
        this.prisma.creator.count({ where: { orgId: DEV_ORG_ID } }),
        this.prisma.creatorUpload.count({ where: { orgId: DEV_ORG_ID } }),
      ]);

    return {
      totalOpenTasks: totalOpen,
      overdueTasks: overdue,
      completedLast7Days: completedLast7,
      dueTodayTasks: dueToday,
      totalCreators,
      totalUploads,
    };
  }

  // --- Deals ---
  private async tool_listDeals(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.stage) where.stage = input.stage;
    if (input?.creatorName) {
      const creators = await this.prisma.creator.findMany({
        where: { orgId: DEV_ORG_ID, name: { contains: input.creatorName, mode: 'insensitive' as const } },
        select: { id: true },
      });
      where.creatorId = { in: creators.map((c) => c.id) };
    }
    const deals = await this.prisma.deal.findMany({
      where,
      select: {
        id: true, title: true, type: true, stage: true,
        amount: true, currency: true, paymentStatus: true,
        deadline: true,
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return {
      count: deals.length,
      deals: deals.map((d) => ({ ...d, creatorName: d.creator.name, creator: undefined })),
    };
  }

  // --- Products ---
  private async tool_listProducts(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.search) where.title = { contains: input.search, mode: 'insensitive' as const };
    if (input?.category) where.category = { contains: input.category, mode: 'insensitive' as const };

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true, title: true, status: true, vendor: true, category: true, sku: true,
        _count: { select: { variants: true } },
      },
      orderBy: { title: 'asc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return {
      count: products.length,
      products: products.map((p) => ({ ...p, variantCount: p._count.variants, _count: undefined })),
    };
  }

  // --- Order Revenue Summary ---
  private async tool_orderRevenueSummary(input: any): Promise<unknown> {
    const from = input?.from ? new Date(input.from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const to = input?.to ? new Date(input.to) : new Date();
    // Make `to` inclusive — set to end of day
    to.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: { orgId: DEV_ORG_ID, placedAt: { gte: from, lte: to } },
      select: { totalPrice: true },
    });
    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalPrice ?? 0), 0);
    const result: any = {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
      totalOrders: orders.length,
      totalRevenue: totalRevenue.toFixed(2),
      averageOrderValue: orders.length ? (totalRevenue / orders.length).toFixed(2) : '0',
      currency: 'EUR',
    };

    // Optional: top products by revenue
    if (input?.topProducts) {
      const items = await this.prisma.orderLineItem.findMany({
        where: { order: { orgId: DEV_ORG_ID, placedAt: { gte: from, lte: to } } },
        select: { title: true, lineTotal: true, quantity: true },
      });
      const map = new Map<string, { revenue: number; qty: number }>();
      for (const li of items) {
        const key = li.title;
        const prev = map.get(key) ?? { revenue: 0, qty: 0 };
        prev.revenue += Number(li.lineTotal ?? 0);
        prev.qty += li.quantity;
        map.set(key, prev);
      }
      const sorted = Array.from(map.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, Math.min(input.topProducts, 20));
      result.topProducts = sorted.map(([title, s]) => ({
        title,
        revenue: s.revenue.toFixed(2),
        quantity: s.qty,
      }));
    }
    return result;
  }

  // --- Influencers ---
  private async tool_listInfluencers(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.platform) where.platform = input.platform.toLowerCase();
    if (input?.niche) where.niche = { contains: input.niche, mode: 'insensitive' as const };
    if (input?.minFollowers) where.followerCount = { gte: input.minFollowers };

    const profiles = await this.prisma.influencerProfile.findMany({
      where,
      select: {
        id: true, displayName: true, handle: true, platform: true,
        followerCount: true, engagementRate: true, niche: true, isVerified: true,
      },
      orderBy: { followerCount: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: profiles.length, influencers: profiles };
  }

  // --- Content Pieces ---
  private async tool_listContentPieces(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.type) where.type = input.type;
    if (input?.status) where.status = input.status;
    if (input?.search) where.title = { contains: input.search, mode: 'insensitive' as const };

    const pieces = await this.prisma.contentPiece.findMany({
      where,
      select: {
        id: true, title: true, type: true, status: true, platform: true,
        aiGenerated: true, tags: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: pieces.length, contentPieces: pieces };
  }

  // --- Briefings ---
  private async tool_listBriefings(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.status) where.status = input.status;
    if (input?.productName) {
      const products = await this.prisma.product.findMany({
        where: { orgId: DEV_ORG_ID, title: { contains: input.productName, mode: 'insensitive' as const } },
        select: { id: true },
      });
      where.productId = { in: products.map((p) => p.id) };
    }

    const briefings = await this.prisma.briefing.findMany({
      where,
      select: {
        id: true, title: true, status: true, notes: true, createdAt: true,
        deal: { select: { title: true, creator: { select: { name: true } } } },
        product: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return {
      count: briefings.length,
      briefings: briefings.map((b) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        dealTitle: b.deal?.title,
        creatorName: b.deal?.creator?.name,
        productTitle: b.product?.title,
        createdAt: b.createdAt,
      })),
    };
  }
}
