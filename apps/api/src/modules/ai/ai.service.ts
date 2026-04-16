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
    name: 'shopify_today_summary',
    description:
      'Returns today\'s Shopify revenue, order count and average order value compared to yesterday. Use for "how are we doing today" kind of questions.',
    input_schema: { type: 'object' as const, properties: {} },
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
        case 'list_team_members':
          return this.tool_listTeamMembers();
        case 'shopify_today_summary':
          return this.tool_shopifyToday();
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
      select: { id: true, name: true, platform: true, followerCount: true, status: true },
      take: Math.min(input?.limit || 20, 50),
      orderBy: { createdAt: 'desc' },
    });
    return { count: creators.length, creators };
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
}
