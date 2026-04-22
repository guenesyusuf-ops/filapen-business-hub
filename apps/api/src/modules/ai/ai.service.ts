import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderShipmentService } from '../shipping/order-shipment.service';
import { StorageService } from '../../common/storage/storage.service';

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
  {
    name: 'search_documents',
    description:
      'Searches the Dokumente module (file management system) for folders and files by name or tags. Use for "where is the file X", "find document Y", "which files are in folder Z".',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term (matches file/folder names and tags)' },
        folderId: { type: 'string', description: 'Restrict search to a specific folder' },
        fileType: { type: 'string', description: 'Filter by file type (image, video, pdf, document, spreadsheet)' },
      },
    },
  },
  {
    name: 'list_document_folders',
    description:
      'Lists folders in the Dokumente module, optionally within a parent folder. Shows folder structure, file counts, lock status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parentId: { type: 'string', description: 'Parent folder ID (omit for root folders)' },
      },
    },
  },
  {
    name: 'list_personal_notes',
    description:
      'Lists the current user\'s personal notes from the home dashboard. Use for "what did I note", "my notes".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_calendar_events',
    description:
      'Lists personal calendar events for the current user, optionally filtered by date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Start date ISO' },
        to: { type: 'string', description: 'End date ISO' },
      },
    },
  },
  // ==================== ACTION TOOLS (write) ====================
  {
    name: 'create_task',
    description:
      'Creates a new task in a work management project. Use when user says "erstelle Task", "neue Aufgabe", "trage ein". Requires projectId (ask user or pick most recent project).',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'Project ID to create the task in' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Optional description' },
        assigneeName: { type: 'string', description: 'Name of the person to assign (partial match)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
        dueDate: { type: 'string', description: 'Due date ISO (e.g. 2026-04-20)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description:
      'Marks a task as completed. Use when user says "erledigt", "abgehakt", "fertig".',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskTitle: { type: 'string', description: 'Task title (partial match) to find and complete' },
      },
      required: ['taskTitle'],
    },
  },
  {
    name: 'invite_creators',
    description:
      'Sends portal invitations to creators who have not been invited yet. Use when user says "lade Creators ein", "Portal-Einladung". Can invite all or specific creators by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        creatorName: { type: 'string', description: 'Specific creator name to invite (omit to invite ALL uninvited)' },
      },
    },
  },
  {
    name: 'create_note',
    description:
      'Creates a personal note on the user\'s home dashboard. Use when user says "notiere", "merke dir", "schreib auf".',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Note content' },
      },
      required: ['content'],
    },
  },
  {
    name: 'create_calendar_event',
    description:
      'Creates a personal calendar event. Use when user says "trage ein", "Termin", "erinnere mich".',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Event title' },
        date: { type: 'string', description: 'Date ISO (e.g. 2026-04-20)' },
        time: { type: 'string', description: 'Time (e.g. 10:00). Omit for all-day.' },
        reminderMinutes: { type: 'number', description: 'Reminder X minutes before (e.g. 15)' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'create_folder',
    description:
      'Creates a new folder in the Dokumente module. Can create in root or inside an existing folder. Use when user says "erstelle Ordner", "neuer Ordner", "Unterordner anlegen".',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Folder name' },
        parentFolderName: { type: 'string', description: 'Name of the parent folder (omit for root). Will be matched by partial name.' },
        color: { type: 'string', description: 'Optional color hex (e.g. #6366f1)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'move_file',
    description:
      'Moves a file to a different folder. Use when user says "verschiebe Datei", "Datei in Ordner legen".',
    input_schema: {
      type: 'object' as const,
      properties: {
        fileName: { type: 'string', description: 'File name (partial match)' },
        targetFolderName: { type: 'string', description: 'Target folder name (partial match). Use "root" for root level.' },
      },
      required: ['fileName', 'targetFolderName'],
    },
  },
  {
    name: 'lock_folder',
    description:
      'Locks or unlocks a folder (admin action). Locked folders are only accessible to admins. Use when user says "sperre Ordner", "Ordner sperren/entsperren".',
    input_schema: {
      type: 'object' as const,
      properties: {
        folderName: { type: 'string', description: 'Folder name (partial match)' },
        lock: { type: 'boolean', description: 'true to lock, false to unlock' },
      },
      required: ['folderName', 'lock'],
    },
  },
  {
    name: 'delete_file',
    description:
      'Moves a file to trash (soft delete). Use when user says "lösche Datei", "Datei entfernen".',
    input_schema: {
      type: 'object' as const,
      properties: {
        fileName: { type: 'string', description: 'File name (partial match)' },
      },
      required: ['fileName'],
    },
  },
  {
    name: 'send_direct_message',
    description:
      'Sends a direct message to a team member. Use when user says "schreib an", "nachricht an", "sag Peter".',
    input_schema: {
      type: 'object' as const,
      properties: {
        recipientName: { type: 'string', description: 'Name of the recipient (partial match)' },
        message: { type: 'string', description: 'Message content' },
      },
      required: ['recipientName', 'message'],
    },
  },

  // ==================== READ TOOLS (existing) ====================
  {
    name: 'list_approval_tasks',
    description:
      'Lists approval (Abnahme) tasks — pending approvals for the current user, or all approval tasks. Use for "what needs my approval", "which approvals are pending".',
    input_schema: {
      type: 'object' as const,
      properties: {
        pendingOnly: { type: 'boolean', description: 'Only show tasks waiting for my approval' },
      },
    },
  },

  // ==================== SHIPPING TOOLS ====================
  {
    name: 'list_unshipped_orders',
    description:
      'Lists offene Shopify-Bestellungen, die noch KEIN Versandetikett haben (open + unfulfilled, nicht storniert). Nutze für "welche Bestellungen müssen noch versendet werden", "nicht versendete Bestellungen", "versandfertig".',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Filter nach Bestellnr. oder Empfänger (partial match)' },
        country: { type: 'string', description: 'ISO-2 Ländercode (z.B. DE) — nur Bestellungen in dieses Land' },
        limit: { type: 'number', description: 'Max Ergebnisse (default 20)' },
      },
    },
  },
  {
    name: 'list_shipments',
    description:
      'Listet Sendungen (Versand-Records), optional gefiltert nach Status (label_created, handed_to_carrier, in_transit, delivered, delivery_failed, returned, exception) oder Carrier (dhl/ups/dpd/hermes/gls/custom). Nutze für "welche Pakete sind unterwegs", "wurden die zugestellt".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by shipment status' },
        carrier: { type: 'string', description: 'Filter by carrier key' },
        search: { type: 'string', description: 'Tracking-Nr. oder Empfänger' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_labels',
    description:
      'Listet generierte Versand-Labels, optional gefiltert nach Druck-Status (printed=erledigt / unprinted=noch offen). Nutze für "welche Labels wurden noch nicht gedruckt", "Druckstapel heute".',
    input_schema: {
      type: 'object' as const,
      properties: {
        printed: { type: 'string', enum: ['printed', 'unprinted', 'all'], description: 'Filter by print state' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'shipping_dashboard',
    description:
      'Versand-KPIs: offene Bestellungen ohne Label, Sendungen gesamt, in Transit, zugestellt, Fehler. Nutze für "Status Versand heute", "Überblick Versand".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_carrier_accounts',
    description:
      'Zeigt hinterlegte Carrier-Konten (DHL-API etc.) mit Status (API-ready, Stub, Sandbox/Production).',
    input_schema: { type: 'object' as const, properties: {} },
  },

  // ==================== PURCHASE (EINKAUF) TOOLS ====================
  {
    name: 'list_purchase_orders',
    description:
      'Listet Einkaufsbestellungen (POs), optional nach Status (draft/ordered/shipped/invoiced/partially_received/received/completed/cancelled) oder Zahlungsstatus (unpaid/partially_paid/paid/overpaid). Nutze für "offene Einkäufe", "welche Lieferungen stehen aus", "unbezahlte Rechnungen".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by PO status' },
        paymentStatus: { type: 'string', description: 'Filter by payment status' },
        supplierName: { type: 'string', description: 'Filter by supplier name (partial match)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_suppliers',
    description:
      'Listet Lieferanten mit Name, Kategorie, Zahlungsbedingungen. Nutze für "unsere Lieferanten", "welche Suppliers haben wir".',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Name oder Kategorie (partial match)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'purchase_dashboard',
    description:
      'Einkauf-KPIs: offene POs, unbezahlte Summe, erwartete Lieferungen nächste 30 Tage, Top-Lieferanten.',
    input_schema: { type: 'object' as const, properties: {} },
  },

  // ==================== EMAIL MARKETING TOOLS ====================
  {
    name: 'list_email_campaigns',
    description:
      'Listet Email-Kampagnen, optional gefiltert nach Status (draft/scheduled/sending/sent/paused/failed). Zeigt Name, Empfängerzahl, Sent/Open/Click-Stats. Nutze für "welche Kampagnen laufen", "Performance letzter Sends".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by campaign status' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_email_contacts',
    description:
      'Listet Email-Kontakte (Subscriber-Liste), optional nach Consent-Status (subscribed/unsubscribed/bounced) oder Suche. Zeigt Anzahl, Tags, Land.',
    input_schema: {
      type: 'object' as const,
      properties: {
        consent: { type: 'string', description: 'Marketing consent filter' },
        search: { type: 'string', description: 'Email/Name partial match' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'list_email_flows',
    description:
      'Listet Email-Flows (Automationen, z.B. Welcome-Serie, Abandoned-Cart). Zeigt Trigger, Status, Anzahl Schritte.',
    input_schema: { type: 'object' as const, properties: {} },
  },

  // ==================== INTEGRATIONS & ADMIN TOOLS ====================
  {
    name: 'list_integrations',
    description:
      'Listet verbundene externe Systeme (Shopify, Amazon, Meta Ads etc.) mit Status und letztem Sync-Zeitpunkt. Nutze für "welche Integrationen sind aktiv", "wann wurde zuletzt synchronisiert".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'download_shipping_labels',
    description:
      'Erstellt eine zusammengefügte PDF aus mehreren Versand-Labels und gibt einen Download-Link zurück. Nutze wenn User sagt "lade die X Labels herunter", "gib mir die ungedruckten Labels", "download labels".',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', enum: ['unprinted', 'printed', 'all'], description: 'Welche Labels (default unprinted)' },
        limit: { type: 'number', description: 'Max Labels (default alle passenden)' },
        markPrinted: { type: 'boolean', description: 'Nach Download als gedruckt markieren (default true)' },
      },
    },
  },
  {
    name: 'list_users',
    description:
      'Admin-Tool: Listet alle aktiven User im Workspace mit Rolle und Email. Nutze für "welche Mitarbeiter haben wir", "Team-Übersicht".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['active', 'pending', 'rejected', 'all'], description: 'Account status filter (default active)' },
        search: { type: 'string', description: 'Name/Email partial match' },
      },
    },
  },
];

const SYSTEM_PROMPT = `Du bist "Filapen Assistant", der KI-Copilot fuer die Filapen Business Hub Software. Du hast Admin-Einsicht in alle Module und Daten. Antworte immer auf Deutsch, knapp und handlungsorientiert.

Abgedeckte Module + passende Tools:
- Finanzen/Shopify: shopify_today_summary, dashboard_kpis, order_revenue_summary, list_products
- Versand: list_unshipped_orders, list_shipments, list_labels, shipping_dashboard, list_carrier_accounts
- Einkauf: list_purchase_orders, list_suppliers, purchase_dashboard
- Email-Marketing: list_email_campaigns, list_email_contacts, list_email_flows
- Aufgabenverwaltung: list_tasks, list_projects, list_approval_tasks, create_task, complete_task
- Creators/Influencer/Content: list_creators, list_creator_uploads, list_deals, list_briefings, list_influencers, list_content_pieces
- Dokumente: search_documents, list_document_folders, create_folder, move_file, lock_folder, delete_file
- Persoenlich: list_personal_notes, list_calendar_events, create_note, create_calendar_event
- Team/Admin: list_team_members, list_users, list_integrations, send_direct_message

Regeln:
- Nutze die bereitgestellten Tools, wenn du echte Daten brauchst — niemals Zahlen erfinden.
- Sag NIE "habe kein Tool dafuer", wenn es zum Thema ein Tool gibt. Frag lieber nach den Filtern, die dir fehlen, und ruf dann das passende Tool auf.
- Fragen wie "nicht versendete Bestellungen", "welche Labels sind offen", "Versandstatus" → IMMER list_unshipped_orders / list_shipments / shipping_dashboard aufrufen, nicht an Shopify verweisen.
- Wenn der User Labels downloaden/drucken will ("gib mir die 3 Labels", "download labels") → download_shipping_labels aufrufen und den Response-Link im Markdown einbetten: "[Label-PDF downloaden]({downloadUrl})". NIE an "Versand → Labels" verweisen wenn das Tool die Sache direkt erledigen kann.
- Wenn mehrere Tools noetig sind, rufe sie nacheinander auf.
- Formatiere Listen kompakt mit Bullet-Points.
- Halte Antworten unter 150 Woertern, ausser der User bittet explizit um Details.
- Destruktive System-Aktionen (User loeschen, Integration loeschen, ganze Tabellen leeren) NICHT ausfuehren, auch nicht wenn gefragt — stattdessen Verantwortliche verweisen.
- Verwende Icons/Emojis sparsam (max 1-2 pro Antwort).`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly shipments: OrderShipmentService,
    private readonly storage: StorageService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — Ask Filapen will return a configuration error.');
    }
  }

  async ask(
    userId: string,
    query: string,
    history?: { role: string; content: string }[],
  ): Promise<{ answer: string; steps?: string[] }> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Ask Filapen ist nicht konfiguriert. Bitte setze ANTHROPIC_API_KEY in den Server-Variablen.',
      );
    }
    if (!query.trim()) throw new BadRequestException('Frage darf nicht leer sein');

    // Build conversation context from history (if provided)
    const messages: Anthropic.MessageParam[] = [];

    if (history && history.length > 1) {
      // Include prior messages for context (skip the last one — that's the current query)
      for (const msg of history.slice(0, -1)) {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // Add the current query
    messages.push({ role: 'user', content: query });

    const steps: string[] = [];

    // Keyword-Routing: Nur die relevanten Tools an Claude schicken. Weniger Tools
    // → weniger Reasoning-Aufwand für das Modell, geringere Latenz, weniger Tokens.
    // Bei zweideutigen Fragen fallen wir auf alle Tools zurück.
    const routedTools = this.routeToolsForMessage(query);
    steps.push(`🎯 ${routedTools.length} Tool(s) geroutet aus ${TOOLS.length}`);

    for (let round = 0; round < 4; round++) {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        tools: routedTools,
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
  // Keyword-based tool router
  // -------------------------------------------------------------------------

  /**
   * Reduziert die Tool-Liste anhand von Keywords in der User-Frage.
   * Vorteile:
   *   - Claude muss weniger Tools vergleichen → schneller
   *   - Weniger Input-Tokens → günstiger
   *   - Fokus auf den richtigen Bereich → weniger Falschentscheidungen
   *
   * Fallback: Wenn kein Keyword matcht ODER die Frage sehr generell ist,
   * geben wir ALLE Tools zurück (keine Genauigkeit verloren).
   */
  private routeToolsForMessage(message: string): Anthropic.Tool[] {
    const msg = message.toLowerCase();

    // Keyword-Gruppen → Tool-Namen. Eine Nachricht kann mehrere Gruppen aktivieren.
    const groups: Array<{ patterns: string[]; tools: string[] }> = [
      {
        patterns: ['versand', 'versendet', 'versenden', 'versandt', 'liefer', 'paket', 'pakete', 'sendung', 'sendungen', 'tracking', 'dhl', 'ups', 'dpd', 'hermes', 'gls', 'label', 'labels'],
        tools: ['list_unshipped_orders', 'list_shipments', 'list_labels', 'shipping_dashboard', 'list_carrier_accounts', 'download_shipping_labels'],
      },
      {
        patterns: ['download', 'herunterlad', 'runterlad', 'pdf', 'drucken', 'druck'],
        tools: ['download_shipping_labels', 'list_labels'],
      },
      {
        patterns: ['bestellung', 'bestellungen', 'bestellt', 'order', 'orders', 'shopify', 'umsatz', 'revenue', 'einnahmen'],
        tools: ['list_unshipped_orders', 'shopify_today_summary', 'order_revenue_summary', 'list_products'],
      },
      {
        patterns: ['produkt', 'produkte', 'artikel', 'sortiment', 'katalog', 'variante'],
        tools: ['list_products', 'order_revenue_summary'],
      },
      {
        patterns: ['einkauf', 'einkäufe', 'einkaeufe', 'lieferant', 'supplier', 'po ', 'purchase', 'beschaffung', 'unbezahlt', 'rechnung'],
        tools: ['list_purchase_orders', 'list_suppliers', 'purchase_dashboard'],
      },
      {
        patterns: ['email', 'mail', 'kampagne', 'kampagnen', 'campaign', 'newsletter', 'subscriber', 'abonnent', 'kontakt', 'flow', 'flows'],
        tools: ['list_email_campaigns', 'list_email_contacts', 'list_email_flows'],
      },
      {
        patterns: ['aufgabe', 'aufgaben', 'task', 'tasks', 'todo', 'projekt', 'projekte', 'überfällig', 'ueberfaellig', 'fällig', 'faellig', 'erledigt'],
        tools: ['list_tasks', 'list_projects', 'list_approval_tasks', 'create_task', 'complete_task', 'dashboard_kpis'],
      },
      {
        patterns: ['abnahme', 'approval', 'freigabe', 'genehmig'],
        tools: ['list_approval_tasks', 'list_tasks'],
      },
      {
        patterns: ['creator', 'creatorin', 'ugc', 'content'],
        tools: ['list_creators', 'list_creator_uploads', 'list_deals', 'list_briefings'],
      },
      {
        patterns: ['influencer', 'reichweite', 'follower'],
        tools: ['list_influencers'],
      },
      {
        patterns: ['deal', 'deals', 'kooperation', 'kampagne'],
        tools: ['list_deals', 'list_creators'],
      },
      {
        patterns: ['briefing', 'brief'],
        tools: ['list_briefings'],
      },
      {
        patterns: ['dokument', 'dokumente', 'datei', 'dateien', 'ordner', 'file', 'folder', 'pdf'],
        tools: ['search_documents', 'list_document_folders', 'create_folder', 'move_file', 'lock_folder', 'delete_file'],
      },
      {
        patterns: ['notiz', 'notizen', 'merke', 'notieren'],
        tools: ['list_personal_notes', 'create_note'],
      },
      {
        patterns: ['kalender', 'termin', 'event', 'erinnerung'],
        tools: ['list_calendar_events', 'create_calendar_event'],
      },
      {
        patterns: ['team', 'mitarbeiter', 'kollege', 'kollegen', 'user', 'users'],
        tools: ['list_team_members', 'list_users', 'send_direct_message'],
      },
      {
        patterns: ['nachricht', 'schreib', 'sag ', 'dm '],
        tools: ['send_direct_message', 'list_team_members'],
      },
      {
        patterns: ['integration', 'integrationen', 'verbind', 'sync', 'synchroni'],
        tools: ['list_integrations', 'list_carrier_accounts'],
      },
      {
        patterns: ['heute', 'dashboard', 'überblick', 'ueberblick', 'status', 'kpi', 'kennzahlen'],
        tools: ['shopify_today_summary', 'dashboard_kpis', 'shipping_dashboard', 'purchase_dashboard'],
      },
    ];

    const matched = new Set<string>();
    for (const { patterns, tools } of groups) {
      if (patterns.some((p) => msg.includes(p))) {
        tools.forEach((t) => matched.add(t));
      }
    }

    // Heuristik: Sehr kurze Fragen (< 15 Zeichen) oder keine Treffer → alle Tools.
    // Damit verlieren wir bei unklaren Fragen keine Genauigkeit.
    if (matched.size === 0 || msg.trim().length < 15) return TOOLS;

    const filtered = TOOLS.filter((t) => matched.has(t.name));
    // Safety-Net: Mindestens 3 Tools, sonst fallback auf alle
    return filtered.length >= 3 ? filtered : TOOLS;
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
        case 'search_documents':
          return this.tool_searchDocuments(input);
        case 'list_document_folders':
          return this.tool_listDocumentFolders(input);
        case 'list_personal_notes':
          return this.tool_listPersonalNotes(userId);
        case 'list_calendar_events':
          return this.tool_listCalendarEvents(input, userId);
        case 'list_approval_tasks':
          return this.tool_listApprovalTasks(input, userId);
        // Shipping
        case 'list_unshipped_orders':
          return this.tool_listUnshippedOrders(input);
        case 'list_shipments':
          return this.tool_listShipments(input);
        case 'list_labels':
          return this.tool_listLabels(input);
        case 'shipping_dashboard':
          return this.tool_shippingDashboard();
        case 'list_carrier_accounts':
          return this.tool_listCarrierAccounts();
        case 'download_shipping_labels':
          return this.tool_downloadShippingLabels(input);
        // Purchase
        case 'list_purchase_orders':
          return this.tool_listPurchaseOrders(input);
        case 'list_suppliers':
          return this.tool_listSuppliers(input);
        case 'purchase_dashboard':
          return this.tool_purchaseDashboard();
        // Email Marketing
        case 'list_email_campaigns':
          return this.tool_listEmailCampaigns(input);
        case 'list_email_contacts':
          return this.tool_listEmailContacts(input);
        case 'list_email_flows':
          return this.tool_listEmailFlows();
        // Integrations & Admin
        case 'list_integrations':
          return this.tool_listIntegrations();
        case 'list_users':
          return this.tool_listUsers(input);
        // Action tools
        case 'create_task':
          return this.action_createTask(input, userId);
        case 'complete_task':
          return this.action_completeTask(input);
        case 'invite_creators':
          return this.action_inviteCreators(input);
        case 'create_note':
          return this.action_createNote(input, userId);
        case 'create_calendar_event':
          return this.action_createCalendarEvent(input, userId);
        case 'create_folder':
          return this.action_createFolder(input);
        case 'move_file':
          return this.action_moveFile(input);
        case 'lock_folder':
          return this.action_lockFolder(input, userId);
        case 'delete_file':
          return this.action_deleteFile(input);
        case 'send_direct_message':
          return this.action_sendDirectMessage(input, userId);
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

  // --- Documents ---
  private async tool_searchDocuments(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID, trashedAt: null };
    if (input?.folderId) where.folderId = input.folderId;
    if (input?.fileType) where.fileType = input.fileType;

    const [folders, files] = await Promise.all([
      input?.query ? this.prisma.docFolder.findMany({
        where: {
          orgId: DEV_ORG_ID,
          trashedAt: null,
          OR: [
            { name: { contains: input.query, mode: 'insensitive' as const } },
            { tags: { has: input.query } },
          ],
        },
        select: { id: true, name: true, parentId: true, locked: true },
        take: 15,
      }) : Promise.resolve([]),
      this.prisma.docFile.findMany({
        where: {
          ...where,
          ...(input?.query ? {
            OR: [
              { fileName: { contains: input.query, mode: 'insensitive' as const } },
              { tags: { has: input.query } },
            ],
          } : {}),
        },
        select: { id: true, fileName: true, fileType: true, fileSize: true, folderId: true, status: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      folders: folders.map((f) => ({ ...f })),
      files: files.map((f) => ({ ...f, fileSize: f.fileSize ? Number(f.fileSize) : null })),
      totalFound: folders.length + files.length,
    };
  }

  private async tool_listDocumentFolders(input: any): Promise<unknown> {
    const folders = await this.prisma.docFolder.findMany({
      where: { orgId: DEV_ORG_ID, parentId: input?.parentId || null, trashedAt: null },
      include: { _count: { select: { children: true, files: true } } },
      orderBy: { name: 'asc' },
    });
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      locked: f.locked,
      childFolders: f._count.children,
      fileCount: f._count.files,
    }));
  }

  // --- Personal Notes ---
  private async tool_listPersonalNotes(userId: string): Promise<unknown> {
    const notes = await this.prisma.personalNote.findMany({
      where: { userId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
    return { count: notes.length, notes: notes.map((n) => ({ id: n.id, content: n.content.slice(0, 200), pinned: n.pinned, createdAt: n.createdAt })) };
  }

  // --- Calendar Events ---
  private async tool_listCalendarEvents(input: any, userId: string): Promise<unknown> {
    const where: any = { userId };
    if (input?.from || input?.to) {
      where.startsAt = {};
      if (input.from) where.startsAt.gte = new Date(input.from);
      if (input.to) where.startsAt.lte = new Date(input.to);
    }
    const events = await this.prisma.personalCalendarEvent.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: 30,
    });
    return { count: events.length, events: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, allDay: e.allDay })) };
  }

  // ==========================================================================
  // ACTION TOOLS (write operations)
  // ==========================================================================

  private async action_createTask(input: any, userId: string): Promise<unknown> {
    // Find project — use provided ID or pick the most recent one
    let projectId = input.projectId;
    if (!projectId) {
      const latest = await this.prisma.wmProject.findFirst({
        where: { orgId: DEV_ORG_ID, projectType: 'kanban' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true },
      });
      if (!latest) return { error: 'Kein Projekt gefunden. Bitte zuerst ein Projekt erstellen.' };
      projectId = latest.id;
    }

    const project = await this.prisma.wmProject.findUnique({
      where: { id: projectId },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!project) return { error: 'Projekt nicht gefunden' };
    const firstCol = project.columns[0];
    if (!firstCol) return { error: 'Projekt hat keine Spalten' };

    // Resolve assignee by name
    let assigneeId: string | undefined;
    if (input.assigneeName) {
      const user = await this.prisma.user.findFirst({
        where: { orgId: DEV_ORG_ID, name: { contains: input.assigneeName, mode: 'insensitive' as const } },
        select: { id: true, name: true },
      });
      if (user) assigneeId = user.id;
    }

    const task = await this.prisma.wmTask.create({
      data: {
        orgId: DEV_ORG_ID,
        projectId,
        columnId: firstCol.id,
        title: input.title,
        description: input.description || null,
        assigneeId: assigneeId || null,
        createdById: userId,
        priority: input.priority || 'medium',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        position: 0,
      },
    });

    if (assigneeId) {
      await this.prisma.wmTaskAssignee.create({ data: { taskId: task.id, userId: assigneeId } });
    }

    return { success: true, taskId: task.id, title: task.title, project: project.name, assignee: input.assigneeName || 'nicht zugewiesen' };
  }

  private async action_completeTask(input: any): Promise<unknown> {
    const task = await this.prisma.wmTask.findFirst({
      where: {
        orgId: DEV_ORG_ID,
        title: { contains: input.taskTitle, mode: 'insensitive' as const },
        completed: false,
      },
      select: { id: true, title: true },
    });
    if (!task) return { error: `Keine offene Aufgabe mit "${input.taskTitle}" gefunden` };

    await this.prisma.wmTask.update({
      where: { id: task.id },
      data: { completed: true, completedAt: new Date() },
    });
    return { success: true, taskId: task.id, title: task.title, message: `"${task.title}" als erledigt markiert` };
  }

  private async action_inviteCreators(input: any): Promise<unknown> {
    const where: any = {
      orgId: DEV_ORG_ID,
      inviteCode: null, // not yet invited
    };
    if (input?.creatorName) {
      where.name = { contains: input.creatorName, mode: 'insensitive' as const };
    }

    const creators = await this.prisma.creator.findMany({
      where,
      select: { id: true, name: true, email: true },
    });

    if (creators.length === 0) {
      return { message: 'Keine uninvited Creators gefunden. Alle sind bereits eingeladen.' };
    }

    // Generate invite codes
    const invited: string[] = [];
    for (const c of creators) {
      if (!c.email) continue;
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      await this.prisma.creator.update({
        where: { id: c.id },
        data: { inviteCode: code },
      });
      invited.push(`${c.name} (${c.email}) → Code: ${code}`);
    }

    return {
      success: true,
      invitedCount: invited.length,
      skipped: creators.filter((c) => !c.email).length,
      invited,
      message: `${invited.length} Creator eingeladen`,
    };
  }

  private async action_createNote(input: any, userId: string): Promise<unknown> {
    const note = await this.prisma.personalNote.create({
      data: { userId, content: input.content, pinned: false },
    });
    return { success: true, noteId: note.id, message: 'Notiz gespeichert' };
  }

  private async action_createCalendarEvent(input: any, userId: string): Promise<unknown> {
    const startsAt = input.time
      ? new Date(`${input.date}T${input.time}`)
      : new Date(`${input.date}T00:00:00`);
    const allDay = !input.time;
    const reminderAt = input.reminderMinutes
      ? new Date(startsAt.getTime() - input.reminderMinutes * 60_000)
      : null;

    const event = await this.prisma.personalCalendarEvent.create({
      data: {
        userId,
        title: input.title,
        startsAt,
        allDay,
        reminderAt,
      },
    });
    return { success: true, eventId: event.id, title: input.title, date: input.date, time: input.time || 'ganztägig' };
  }

  private async action_sendDirectMessage(input: any, userId: string): Promise<unknown> {
    // Find recipient by name
    const recipient = await this.prisma.user.findFirst({
      where: {
        orgId: DEV_ORG_ID,
        name: { contains: input.recipientName, mode: 'insensitive' as const },
        id: { not: userId },
      },
      select: { id: true, name: true },
    });
    if (!recipient) return { error: `Kein Teammitglied "${input.recipientName}" gefunden` };

    await this.prisma.directMessage.create({
      data: { senderId: userId, recipientId: recipient.id, content: input.message },
    });
    return { success: true, to: recipient.name, message: input.message, info: 'Nachricht gesendet' };
  }

  // --- Document management actions ---

  private async action_createFolder(input: any): Promise<unknown> {
    let parentId: string | null = null;
    if (input.parentFolderName) {
      const parent = await this.prisma.docFolder.findFirst({
        where: { orgId: DEV_ORG_ID, name: { contains: input.parentFolderName, mode: 'insensitive' as const }, trashedAt: null },
        select: { id: true, name: true },
      });
      if (!parent) return { error: `Ordner "${input.parentFolderName}" nicht gefunden` };
      parentId = parent.id;
    }
    const folder = await this.prisma.docFolder.create({
      data: {
        orgId: DEV_ORG_ID,
        name: input.name,
        parentId,
        color: input.color || null,
        createdBy: DEV_ORG_ID, // system-created via AI
      },
    });
    return { success: true, folderId: folder.id, name: folder.name, parent: input.parentFolderName || 'Root' };
  }

  private async action_moveFile(input: any): Promise<unknown> {
    const file = await this.prisma.docFile.findFirst({
      where: { orgId: DEV_ORG_ID, fileName: { contains: input.fileName, mode: 'insensitive' as const }, trashedAt: null },
      select: { id: true, fileName: true },
    });
    if (!file) return { error: `Datei "${input.fileName}" nicht gefunden` };

    let folderId: string | null = null;
    if (input.targetFolderName && input.targetFolderName !== 'root') {
      const folder = await this.prisma.docFolder.findFirst({
        where: { orgId: DEV_ORG_ID, name: { contains: input.targetFolderName, mode: 'insensitive' as const }, trashedAt: null },
        select: { id: true, name: true },
      });
      if (!folder) return { error: `Ordner "${input.targetFolderName}" nicht gefunden` };
      folderId = folder.id;
    }

    await this.prisma.docFile.update({ where: { id: file.id }, data: { folderId } });
    return { success: true, file: file.fileName, movedTo: input.targetFolderName || 'Root' };
  }

  private async action_lockFolder(input: any, userId: string): Promise<unknown> {
    const folder = await this.prisma.docFolder.findFirst({
      where: { orgId: DEV_ORG_ID, name: { contains: input.folderName, mode: 'insensitive' as const }, trashedAt: null },
      select: { id: true, name: true, locked: true },
    });
    if (!folder) return { error: `Ordner "${input.folderName}" nicht gefunden` };

    await this.prisma.docFolder.update({
      where: { id: folder.id },
      data: { locked: input.lock, lockedBy: input.lock ? userId : null },
    });
    return { success: true, folder: folder.name, locked: input.lock };
  }

  private async action_deleteFile(input: any): Promise<unknown> {
    const file = await this.prisma.docFile.findFirst({
      where: { orgId: DEV_ORG_ID, fileName: { contains: input.fileName, mode: 'insensitive' as const }, trashedAt: null },
      select: { id: true, fileName: true },
    });
    if (!file) return { error: `Datei "${input.fileName}" nicht gefunden` };

    await this.prisma.docFile.update({ where: { id: file.id }, data: { trashedAt: new Date() } });
    return { success: true, file: file.fileName, message: 'In den Papierkorb verschoben' };
  }

  // ==========================================================================
  // READ TOOLS (continued)
  // ==========================================================================

  // --- Approval Tasks ---
  private async tool_listApprovalTasks(input: any, userId: string): Promise<unknown> {
    if (input?.pendingOnly) {
      const steps = await this.prisma.wmApprovalStep.findMany({
        where: { userId, status: 'pending' },
        select: { taskId: true },
      });
      const taskIds = steps.map((s) => s.taskId);
      if (taskIds.length === 0) return { count: 0, tasks: [] };
      const tasks = await this.prisma.wmTask.findMany({
        where: { id: { in: taskIds }, approvalStatus: 'in_review' },
        select: { id: true, title: true, approvalStatus: true, approvalVersion: true, projectId: true },
      });
      return { count: tasks.length, tasks };
    }
    // All approval tasks
    const tasks = await this.prisma.wmTask.findMany({
      where: { orgId: DEV_ORG_ID, approvalStatus: { not: null } },
      select: { id: true, title: true, approvalStatus: true, approvalVersion: true, projectId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { count: tasks.length, tasks };
  }

  // ==========================================================================
  // SHIPPING TOOLS
  // ==========================================================================

  private async tool_listUnshippedOrders(input: any): Promise<unknown> {
    const where: any = {
      orgId: DEV_ORG_ID,
      status: { not: 'cancelled' as const },
      fulfillmentStatus: { in: ['unfulfilled', 'partial'] as const },
      shipments: { none: {} },
    };
    if (input?.country) where.countryCode = input.country.toUpperCase();
    if (input?.search) {
      where.OR = [
        { orderNumber: { contains: input.search, mode: 'insensitive' as const } },
        { customerName: { contains: input.search, mode: 'insensitive' as const } },
        { customerEmail: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }
    const orders = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        countryCode: true,
        totalPrice: true,
        currency: true,
        placedAt: true,
      },
      orderBy: { placedAt: 'asc' },
      take: Math.min(input?.limit || 20, 50),
    });
    const total = await this.prisma.order.count({ where });
    return { total, shown: orders.length, orders };
  }

  private async tool_listShipments(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.status) where.status = input.status;
    if (input?.carrier) where.carrier = input.carrier;
    if (input?.search) {
      where.OR = [
        { trackingNumber: { contains: input.search, mode: 'insensitive' as const } },
        { recipientName: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }
    const shipments = await this.prisma.orderShipment.findMany({
      where,
      select: {
        id: true,
        trackingNumber: true,
        carrier: true,
        status: true,
        recipientName: true,
        cost: true,
        createdAt: true,
        handedOverAt: true,
        deliveredAt: true,
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: shipments.length, shipments };
  }

  private async tool_listLabels(input: any): Promise<unknown> {
    const filter = input?.printed || 'unprinted';
    const where: any = { shipment: { orgId: DEV_ORG_ID } };
    if (filter === 'printed') where.printedAt = { not: null };
    else if (filter === 'unprinted') where.printedAt = null;
    const labels = await this.prisma.orderShipmentLabel.findMany({
      where,
      select: {
        id: true,
        trackingNumber: true,
        format: true,
        printedAt: true,
        printCount: true,
        createdAt: true,
        shipment: { select: { carrier: true, recipientName: true, order: { select: { orderNumber: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: labels.length, filter, labels };
  }

  private async tool_shippingDashboard(): Promise<unknown> {
    const [unshipped, total, labelCreated, inTransit, delivered, failed] = await Promise.all([
      this.prisma.order.count({
        where: {
          orgId: DEV_ORG_ID,
          status: { not: 'cancelled' as const },
          fulfillmentStatus: { in: ['unfulfilled', 'partial'] as const },
          shipments: { none: {} },
        },
      }),
      this.prisma.orderShipment.count({ where: { orgId: DEV_ORG_ID } }),
      this.prisma.orderShipment.count({ where: { orgId: DEV_ORG_ID, status: 'label_created' } }),
      this.prisma.orderShipment.count({ where: { orgId: DEV_ORG_ID, status: { in: ['handed_to_carrier', 'in_transit', 'out_for_delivery'] as const } } }),
      this.prisma.orderShipment.count({ where: { orgId: DEV_ORG_ID, status: 'delivered' } }),
      this.prisma.orderShipment.count({ where: { orgId: DEV_ORG_ID, status: { in: ['delivery_failed', 'exception', 'returned'] as const } } }),
    ]);
    return {
      openOrdersToShip: unshipped,
      shipmentsTotal: total,
      labelCreated,
      inTransit,
      delivered,
      problems: failed,
    };
  }

  /**
   * Ruft den Bulk-Merge aus dem Shipping-Service auf, speichert das
   * resultierende PDF in R2 (mit "ai/"-Prefix), gibt dem Modell einen
   * Download-Link zurück, den es dem User in der Antwort einbetten kann.
   */
  private async tool_downloadShippingLabels(input: any): Promise<unknown> {
    const filter = input?.filter || 'unprinted';
    const limit = Math.min(input?.limit || 50, 100);
    const markPrinted = input?.markPrinted !== false;

    const where: any = { shipment: { orgId: DEV_ORG_ID } };
    if (filter === 'printed') where.printedAt = { not: null };
    else if (filter === 'unprinted') where.printedAt = null;

    const labels = await this.prisma.orderShipmentLabel.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (labels.length === 0) {
      return { success: false, message: `Keine ${filter}-Labels gefunden.` };
    }

    const result = await this.shipments.bulkDownloadLabels(
      DEV_ORG_ID,
      labels.map((l) => l.id),
      markPrinted,
    );

    // PDF in R2 ablegen, damit der User einen Link bekommt
    const key = `ai/labels-${Date.now()}.pdf`;
    const url = await this.storage.upload(key, result.buffer, 'application/pdf');

    return {
      success: true,
      labelCount: result.labelCount,
      skippedCount: labels.length - result.labelCount,
      downloadUrl: url,
      filter,
      markedAsPrinted: markPrinted,
      note: result.errors.length ? result.errors.join(' | ') : undefined,
    };
  }

  private async tool_listCarrierAccounts(): Promise<unknown> {
    const accounts = await this.prisma.carrierAccount.findMany({
      where: { orgId: DEV_ORG_ID },
      select: {
        id: true,
        carrier: true,
        accountName: true,
        isDefault: true,
        apiReady: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { count: accounts.length, accounts };
  }

  // ==========================================================================
  // PURCHASE TOOLS
  // ==========================================================================

  private async tool_listPurchaseOrders(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.status) where.status = input.status;
    if (input?.paymentStatus) where.paymentStatus = input.paymentStatus;
    if (input?.supplierName) {
      where.supplier = {
        companyName: { contains: input.supplierName, mode: 'insensitive' as const },
      };
    }
    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        orderDate: true,
        expectedDelivery: true,
        totalAmount: true,
        paidAmount: true,
        openAmount: true,
        currency: true,
        supplier: { select: { companyName: true } },
      },
      orderBy: { orderDate: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: orders.length, orders };
  }

  private async tool_listSuppliers(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.search) {
      where.OR = [
        { companyName: { contains: input.search, mode: 'insensitive' as const } },
        { contactName: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }
    const suppliers = await this.prisma.supplier.findMany({
      where,
      select: {
        id: true,
        supplierNumber: true,
        companyName: true,
        contactName: true,
        country: true,
        defaultCurrency: true,
        paymentTermDays: true,
        status: true,
      },
      orderBy: { companyName: 'asc' },
      take: Math.min(input?.limit || 20, 100),
    });
    return { count: suppliers.length, suppliers };
  }

  private async tool_purchaseDashboard(): Promise<unknown> {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const [open, unpaid, expectedSoon] = await Promise.all([
      this.prisma.purchaseOrder.count({
        where: { orgId: DEV_ORG_ID, status: { in: ['ordered', 'shipped', 'invoiced', 'partially_received'] as const } },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { orgId: DEV_ORG_ID, paymentStatus: { in: ['unpaid', 'partially_paid'] as const } },
        _sum: { openAmount: true },
        _count: true,
      }),
      this.prisma.purchaseOrder.count({
        where: {
          orgId: DEV_ORG_ID,
          expectedDelivery: { gte: now, lte: in30Days },
          status: { not: 'received' as const },
        },
      }),
    ]);

    return {
      openPurchaseOrders: open,
      unpaidOrderCount: unpaid._count,
      unpaidOpenAmount: Number(unpaid._sum.openAmount ?? 0),
      expectedDeliveriesNext30d: expectedSoon,
    };
  }

  // ==========================================================================
  // EMAIL MARKETING TOOLS
  // ==========================================================================

  private async tool_listEmailCampaigns(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.status) where.status = input.status;
    const campaigns = await this.prisma.emailCampaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        subjectSnapshot: true,
        scheduledAt: true,
        sentAt: true,
        recipientsCount: true,
        sentCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: campaigns.length, campaigns };
  }

  private async tool_listEmailContacts(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.consent) where.marketingConsent = input.consent;
    if (input?.search) {
      where.OR = [
        { email: { contains: input.search, mode: 'insensitive' as const } },
        { firstName: { contains: input.search, mode: 'insensitive' as const } },
        { lastName: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }
    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          country: true,
          marketingConsent: true,
          tags: true,
        },
        orderBy: { email: 'asc' },
        take: Math.min(input?.limit || 20, 50),
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { total, shown: contacts.length, contacts };
  }

  private async tool_listEmailFlows(): Promise<unknown> {
    // Best-effort: EmailFlow model may or may not exist in the schema
    try {
      const flows = await (this.prisma as any).emailFlow?.findMany({
        where: { orgId: DEV_ORG_ID },
        select: { id: true, name: true, triggerType: true, enabled: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }) ?? [];
      return { count: flows.length, flows };
    } catch (e: any) {
      return { count: 0, flows: [], note: 'Flow-Modul nicht verfügbar' };
    }
  }

  // ==========================================================================
  // INTEGRATIONS & ADMIN TOOLS
  // ==========================================================================

  private async tool_listIntegrations(): Promise<unknown> {
    const integrations = await this.prisma.integration.findMany({
      where: { orgId: DEV_ORG_ID },
      select: {
        id: true,
        type: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { count: integrations.length, integrations };
  }

  private async tool_listUsers(input: any): Promise<unknown> {
    const status = input?.status && input.status !== 'all' ? input.status : 'active';
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.status !== 'all') where.status = status;
    if (input?.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' as const } },
        { email: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastActiveAt: true,
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
    return { count: users.length, filter: { status }, users };
  }
}
