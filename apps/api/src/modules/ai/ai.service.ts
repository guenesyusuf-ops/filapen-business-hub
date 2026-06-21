import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderShipmentService } from '../shipping/order-shipment.service';
import { StorageService } from '../../common/storage/storage.service';
import { InvoiceService } from '../invoice/invoice.service';
import { InvoiceStatsService } from '../invoice/invoice-stats.service';

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
  // ============================================================
  // SALES (Verkauf) — vorher komplett ohne AI-Zugriff
  // ============================================================
  {
    name: 'list_sales_orders',
    description:
      'Listet Verkaufs-/B2B-Bestellungen (an Kunden, NICHT Einkaufs-Bestellungen). Filtert nach Status, Kunde oder Zeitraum. Nutze für "welche Verkäufe", "offene Kundenbestellungen", "B2B Pipeline".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['draft', 'confirmed', 'shipped', 'invoiced', 'completed', 'cancelled'] },
        customerSearch: { type: 'string', description: 'Filter nach Kunden-Firmenname (partial match)' },
        urgency: { type: 'string', enum: ['urgent', 'overdue'], description: 'urgent = Liefertermin ≤3 Tage, overdue = überfällig' },
        archived: { type: 'boolean', description: 'true = nur abgeschlossene, false = nur offene (default false)' },
        limit: { type: 'number', description: 'Max Treffer (default 20)' },
      },
    },
  },
  {
    name: 'get_sales_order',
    description: 'Details einer einzelnen Verkaufsbestellung inkl. Positionen, Status-Flags und Notizen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderNumber: { type: 'string', description: 'Bestellnummer (z.B. "VK-2026-00042") oder ID' },
      },
      required: ['orderNumber'],
    },
  },
  {
    name: 'list_sales_customers',
    description: 'Listet B2B-Kunden mit Firmenname, Customer-Nummer und Adresse. Nutze für "welche Kunden", "Kunde X suchen".',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Firmenname oder Kunden-Nr partial match' },
        limit: { type: 'number', description: 'Max (default 20)' },
      },
    },
  },
  {
    name: 'sales_dashboard',
    description: 'KPIs für Verkauf-Modul: offene/dringende/überfällige Bestellungen, Monatsumsatz.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  // ============================================================
  // EDIT-TOOLS — Bearbeitung über die KI
  // ============================================================
  {
    name: 'mark_purchase_order_received',
    description: 'Setzt das Ankunftsdatum auf einer Einkaufsbestellung (receivedAt). Nutze für "Bestellung X ist heute angekommen", "ist gestern geliefert worden". Datum im YYYY-MM-DD Format.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderNumber: { type: 'string', description: 'Bestellnummer der Einkaufsbestellung (z.B. "PO-2026-0042")' },
        receivedAt: { type: 'string', description: 'Ankunftsdatum YYYY-MM-DD. null oder weglassen = heute.' },
      },
      required: ['orderNumber'],
    },
  },
  {
    name: 'update_purchase_order_notes',
    description: 'Aktualisiert die "Wichtige Infos"-Notiz (notes) auf einer Einkaufsbestellung. Erscheint als Kommentar-Icon in der Bestell-Übersicht.',
    input_schema: {
      type: 'object' as const,
      properties: {
        orderNumber: { type: 'string', description: 'Bestellnummer' },
        notes: { type: 'string', description: 'Neuer Notiz-Text. Leerstring entfernt die Notiz.' },
      },
      required: ['orderNumber', 'notes'],
    },
  },
  {
    name: 'rename_folder',
    description: 'Benennt einen Dokumenten-Ordner um (Edit-Funktion auf der Documents-Page).',
    input_schema: {
      type: 'object' as const,
      properties: {
        folderId: { type: 'string', description: 'Ordner-ID (UUID)' },
        currentName: { type: 'string', description: 'Aktueller Name als Such-Hilfe falls ID nicht bekannt' },
        newName: { type: 'string', description: 'Neuer Ordnername' },
      },
      required: ['newName'],
    },
  },
  {
    name: 'update_task',
    description: 'Aktualisiert eine Aufgabe (Title, Description, Priority, Due-Date oder Assignee). Nutze für "ändere Task X auf hoch", "verschiebe Deadline", "Beschreibung anpassen".',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string', description: 'Task-ID' },
        title: { type: 'string', description: 'Neuer Titel' },
        description: { type: 'string', description: 'Neue Beschreibung' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        dueDate: { type: 'string', description: 'Neues Fälligkeitsdatum YYYY-MM-DD oder null zum Entfernen' },
        completed: { type: 'boolean', description: 'Erledigt-Status setzen' },
      },
      required: ['taskId'],
    },
  },
  // ============================================================
  // RECHNUNGEN (Eingangsrechnungen) — vollstaendiger Admin-Zugriff
  // ============================================================
  {
    name: 'list_invoices',
    description:
      'Listet Eingangsrechnungen mit OCR-extrahierten Daten. Filter: status (open/due_soon/due_today/overdue/paid), Lieferant, Kategorie, Zeitraum, Betragsspanne, Volltextsuche. Nutze fuer "welche Rechnungen sind faellig", "ueberfaellige Rechnungen", "Rechnungen von DHL", "unbezahlte Rechnungen ueber 1000 EUR".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'due_soon', 'due_today', 'overdue', 'paid', 'unpaid', 'all'], description: 'Status-Filter. unpaid = alles ausser paid.' },
        supplier: { type: 'string', description: 'Lieferantenname (partial match)' },
        category: { type: 'string', description: 'Kategorie (marketing/software/office/vehicles/rent/personnel/insurance/other)' },
        search: { type: 'string', description: 'Volltextsuche in Lieferant/Rechnungsnr/Verwendungszweck/Datei' },
        from: { type: 'string', description: 'Rechnungsdatum >= YYYY-MM-DD' },
        to: { type: 'string', description: 'Rechnungsdatum <= YYYY-MM-DD' },
        amountMin: { type: 'number', description: 'Brutto-Betrag >= X' },
        amountMax: { type: 'number', description: 'Brutto-Betrag <= X' },
        archived: { type: 'boolean', description: 'true = nur Archiv, false/omit = nicht-archivierte' },
        limit: { type: 'number', description: 'Max Treffer (default 20)' },
      },
    },
  },
  {
    name: 'get_invoice',
    description:
      'Liefert eine einzelne Eingangsrechnung mit Lieferantendaten, Betraegen, IBAN, Status, Faelligkeit und Historie (inkl. Bearbeiter-Namen). Identifikation via Rechnungsnummer oder Invoice-UUID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer (z.B. "RE-2026-042") ODER Invoice-UUID' },
      },
      required: ['invoiceNumber'],
    },
  },
  {
    name: 'invoice_dashboard',
    description:
      'Rechnungs-KPIs: Anzahl offen/bald/heute/ueberfaellig/bezahlt, Summen offen/bezahlt, Liquiditaets-Widget (faellig in 7T/30T, Ueberfaellig gesamt, dieser Monat), Top 5 Lieferanten, Monatsausgaben. Nutze fuer "Ueberblick Rechnungen", "wieviel muss ich diesen Monat zahlen".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_invoice_suppliers',
    description:
      'Listet Lieferanten der Eingangsrechnungen mit Anzahl, Gesamtausgaben, Offen-/Bezahlt-Summen, durchschnittlicher Rechnungsbetrag, letzte Rechnung + letzte Zahlung. Nutze fuer "Top Lieferanten", "wieviel haben wir bei Lieferant X ausgegeben".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'mark_invoice_paid',
    description:
      'Markiert eine Eingangsrechnung als bezahlt. Identifikation via Rechnungsnummer ODER Lieferantenname. paidAt default heute, Notiz optional. Nutze fuer "Rechnung X bezahlt", "habe gerade ueberwiesen", "DHL-Rechnung bezahlt gestern".',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer ODER Invoice-UUID' },
        supplierName: { type: 'string', description: 'Alternativ: Lieferant — nimmt die einzige unbezahlte Rechnung von dem Lieferanten (wenn eindeutig)' },
        paidAt: { type: 'string', description: 'Zahlungsdatum YYYY-MM-DD. Weglassen = heute.' },
        note: { type: 'string', description: 'Optionale Notiz, z.B. "SEPA-Ueberweisung"' },
      },
    },
  },
  {
    name: 'mark_invoice_unpaid',
    description: 'Setzt eine bereits bezahlte Eingangsrechnung zurueck auf offen (paidAt + paidById werden geleert).',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer oder UUID' },
      },
      required: ['invoiceNumber'],
    },
  },
  {
    name: 'archive_invoice',
    description: 'Archiviert eine Eingangsrechnung (verschwindet aus der Standardliste, im Archiv weiter abrufbar). Nutze wenn der User eine Rechnung "ablegen" oder "aus der Liste raushaben" will.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer oder UUID' },
      },
      required: ['invoiceNumber'],
    },
  },
  {
    name: 'restore_invoice',
    description: 'Holt eine archivierte Eingangsrechnung zurueck in die aktive Liste.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer oder UUID' },
      },
      required: ['invoiceNumber'],
    },
  },
  {
    name: 'update_invoice',
    description:
      'Aktualisiert Felder einer Eingangsrechnung: Lieferant, Faelligkeit, Betraege, Kategorie, Notizen, IBAN, Verwendungszweck. Nutze fuer "aendere Faelligkeit auf X", "Lieferant heisst eigentlich Y", "der Betrag stimmt nicht, ist 540 statt 450", "Kategorie ist Marketing".',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer oder UUID' },
        supplierName: { type: 'string' },
        supplierEmail: { type: 'string' },
        supplierAddress: { type: 'string' },
        invoiceDate: { type: 'string', description: 'YYYY-MM-DD' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
        netAmount: { type: 'number' },
        vatAmount: { type: 'number' },
        grossAmount: { type: 'number' },
        taxRate: { type: 'number', description: 'MwSt-Satz in Prozent (z.B. 19)' },
        iban: { type: 'string' },
        bic: { type: 'string' },
        paymentReference: { type: 'string', description: 'Verwendungszweck' },
        category: { type: 'string', description: 'marketing/software/office/vehicles/rent/personnel/insurance/other' },
        notes: { type: 'string' },
      },
      required: ['invoiceNumber'],
    },
  },
  {
    name: 'categorize_invoice',
    description: 'Aendert nur die Kategorie einer Rechnung. Schneller als update_invoice wenn nur die Kategorie betroffen ist.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer oder UUID' },
        category: { type: 'string', enum: ['marketing', 'software', 'office', 'vehicles', 'rent', 'personnel', 'insurance', 'other'] },
      },
      required: ['invoiceNumber', 'category'],
    },
  },
  {
    name: 'delete_invoice',
    description:
      'Loescht eine Eingangsrechnung DAUERHAFT. NICHT umkehrbar — File aus R2 wird ebenfalls geloescht. Nur ausfuehren wenn der User explizit "loeschen" oder "endgueltig entfernen" sagt. Sonst archive_invoice nutzen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceNumber: { type: 'string', description: 'Rechnungsnummer oder UUID' },
      },
      required: ['invoiceNumber'],
    },
  },
];

const SYSTEM_PROMPT = `Du bist "Filapen Assistant", der KI-Copilot fuer die Filapen Business Hub Software UND ein allgemeiner Gespraechspartner. Du hast volle ADMIN-Rechte in ALLEN Modulen — Lesen, Anlegen, Aendern, Loeschen wie ein Owner/Admin der Organisation. Antworte immer auf Deutsch, knapp und handlungsorientiert.

DEINE ZWEI ROLLEN:
1. Software-Operator: Bei allem was mit den Filapen-Modulen zu tun hat, nutzt du Tools und fuehrst Aktionen aus.
2. Allgemeiner Assistent: Bei Fragen ausserhalb der Software (Allgemeinwissen, Recherche, Erklaerungen, Brainstorming, Mathe, Sprache, Recht, Steuern, Marketing-Konzepte, Persoenliches, Smalltalk usw.) antwortest du wie ein normaler hilfreicher Chat-Assistent — ohne Tools.

Wenn unklar ist welche Rolle gerade aktiv ist: erst pruefen ob ein Tool exakt passt, sonst direkt aus Wissen antworten. NIEMALS "ich kann das nicht" sagen — entweder Tool nutzen oder aus Wissen beantworten.

GESPRAECHSGEDAECHTNIS:
- Du bekommst die letzten ~20 Nachrichten als History. Beziehe dich darauf wenn relevant — "wie eben besprochen", "wie du gesagt hast", Kontext der vorherigen Anfragen.
- Wenn der User in Folge-Fragen "den ersten", "dieser", "der von gerade" sagt → auf vorherige Antworten beziehen.
- Du darfst klaerende Rueckfragen stellen wenn die Anfrage unklar ist — dann auf die Antwort des Users in der naechsten Runde reagieren.

ABGEDECKTE MODULE + TOOLS:
- Verkauf (B2B-Bestellungen): list_sales_orders, get_sales_order, list_sales_customers, sales_dashboard
- Finanzen/Shopify: shopify_today_summary, dashboard_kpis, order_revenue_summary, list_products
- Versand: list_unshipped_orders, list_shipments, list_labels, shipping_dashboard, list_carrier_accounts, download_shipping_labels
- Einkauf: list_purchase_orders, list_suppliers, purchase_dashboard, mark_purchase_order_received, update_purchase_order_notes
- Rechnungen (Eingangsrechnungen, separat von Einkauf!): list_invoices, get_invoice, invoice_dashboard, list_invoice_suppliers, mark_invoice_paid, mark_invoice_unpaid, archive_invoice, restore_invoice, update_invoice, categorize_invoice, delete_invoice
- Email-Marketing: list_email_campaigns, list_email_contacts, list_email_flows
- Aufgabenverwaltung: list_tasks, list_projects, list_approval_tasks, create_task, complete_task, update_task
- Creators/Influencer/Content: list_creators, list_creator_uploads, list_deals, list_briefings, list_influencers, list_content_pieces, invite_creators
- Dokumente: search_documents, list_document_folders, create_folder, rename_folder, move_file, lock_folder, delete_file
- Persoenlich: list_personal_notes, list_calendar_events, create_note, create_calendar_event
- Team/Admin: list_team_members, list_users, list_integrations, send_direct_message

NICHT abgedeckt (kein Tool — bei Anfragen dazu Hinweis aufs Modul):
- NFC-Baender (Sicherheits-kritisch — physische Hardware, manuelle Verwaltung im Hub-Menue "NFC")
- Retouren (Modul existiert, aktuell ohne KI-Tool)
- Whiteboard / Screen-Share (UI-only)

REGELN:
- Nutze Tools wenn du echte Daten brauchst — nie Zahlen erfinden.
- Bei Bearbeitungs-Wuenschen ("setze X auf Y", "aendere Z", "Task umbenennen") fuehre die Aenderung direkt aus, statt zu sagen "geh in das Modul".
- Eingangsrechnungen → invoice-Tools, nicht purchase-Tools. Einkauf = ausgehende Bestellungen, Rechnungen = eingehende Lieferantenrechnungen.
- Versand-Fragen → list_unshipped_orders / list_shipments / shipping_dashboard.
- B2B-Verkauf → list_sales_orders / get_sales_order / sales_dashboard.
- Labels downloaden → download_shipping_labels.
- Mehrere Tools nacheinander aufrufen wenn noetig.
- Antworten unter 150 Woerter, ausser explizit Details gewuenscht.
- Listen kompakt mit Bullet-Points.
- Sehr destruktive System-Aktionen (User permanent loeschen, Integration entfernen) erst Bestaetigung einholen.
- Icons/Emojis sparsam (max 1-2 pro Antwort).
- Bei NFC-Anfragen: auf den NFC-Bereich verweisen, KEINE Aenderungen vorschlagen die existierende Baender betreffen.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly shipments: OrderShipmentService,
    private readonly storage: StorageService,
    private readonly invoices: InvoiceService,
    private readonly invoiceStats: InvoiceStatsService,
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
  ): Promise<{
    answer: string;
    steps?: string[];
    downloads?: Array<{ url: string; filename: string; autoTrigger: boolean }>;
  }> {
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
    // Side-Channel für Downloads/Actions die das Frontend automatisch auslösen soll
    const downloads: Array<{ url: string; filename: string; autoTrigger: boolean }> = [];

    // Keyword-Routing: Nur die relevanten Tools an Claude schicken. Weniger Tools
    // → weniger Reasoning-Aufwand für das Modell, geringere Latenz, weniger Tokens.
    // Bei zweideutigen Fragen fallen wir auf alle Tools zurück.
    const routedTools = this.routeToolsForMessage(query);
    steps.push(`🎯 ${routedTools.length} Tool(s) geroutet aus ${TOOLS.length}`);

    for (let round = 0; round < 4; round++) {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        // 1200 Tokens lassen Raum fuer detailliertere General-Knowledge-
        // Antworten ohne Abschneiden, bleibt aber wirtschaftlich.
        max_tokens: 1200,
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
          // Harvest downloads so the frontend can auto-trigger them after rendering.
          // Any tool that returns { downloadUrl, ... } is eligible; we also auto-name
          // the file from the URL.
          const r: any = result;
          if (r && typeof r === 'object' && typeof r.downloadUrl === 'string') {
            const filename =
              r.filename || r.downloadUrl.split('/').pop() || `filapen-${Date.now()}.pdf`;
            downloads.push({
              url: r.downloadUrl,
              filename,
              autoTrigger: r.autoTrigger !== false,
            });
          }
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

      return {
        answer: textBlocks || 'Keine Antwort erzeugt.',
        steps,
        ...(downloads.length ? { downloads } : {}),
      };
    }

    return {
      answer: 'Anfrage zu komplex — bitte praeziser formulieren.',
      steps,
      ...(downloads.length ? { downloads } : {}),
    };
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
        patterns: ['verkauf', 'verkäufe', 'verkaeufe', 'kunde', 'kunden', 'b2b', 'kundenbestellung', 'auftrag', 'sales', 'rechnungsempfänger', 'angekommen', 'ankunftsdatum'],
        tools: ['list_sales_orders', 'get_sales_order', 'list_sales_customers', 'sales_dashboard', 'mark_purchase_order_received'],
      },
      {
        patterns: ['einkauf', 'einkäufe', 'einkaeufe', 'lieferant', 'supplier', 'po ', 'purchase', 'beschaffung', 'unbezahlt', 'rechnung'],
        tools: ['list_purchase_orders', 'list_suppliers', 'purchase_dashboard', 'mark_purchase_order_received', 'update_purchase_order_notes'],
      },
      {
        // Eingangsrechnungen — separat von Einkauf
        patterns: ['rechnung', 'rechnungen', 'eingangsrechnung', 'lieferantenrechnung', 'fällig', 'faellig', 'überfällig', 'ueberfaellig', 'bezahlt', 'unbezahlt', 'iban', 'mwst', 'brutto', 'netto', 'skonto', 'zahlungsziel', 'bezahlen', 'überwiesen', 'ueberwiesen'],
        tools: ['list_invoices', 'get_invoice', 'invoice_dashboard', 'list_invoice_suppliers', 'mark_invoice_paid', 'mark_invoice_unpaid', 'archive_invoice', 'restore_invoice', 'update_invoice', 'categorize_invoice', 'delete_invoice'],
      },
      {
        patterns: ['email', 'mail', 'kampagne', 'kampagnen', 'campaign', 'newsletter', 'subscriber', 'abonnent', 'kontakt', 'flow', 'flows'],
        tools: ['list_email_campaigns', 'list_email_contacts', 'list_email_flows'],
      },
      {
        patterns: ['aufgabe', 'aufgaben', 'task', 'tasks', 'todo', 'projekt', 'projekte', 'überfällig', 'ueberfaellig', 'fällig', 'faellig', 'erledigt'],
        tools: ['list_tasks', 'list_projects', 'list_approval_tasks', 'create_task', 'complete_task', 'update_task', 'dashboard_kpis'],
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
        tools: ['search_documents', 'list_document_folders', 'create_folder', 'rename_folder', 'move_file', 'lock_folder', 'delete_file'],
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
        // Sales (Verkauf)
        case 'list_sales_orders':
          return this.tool_listSalesOrders(input);
        case 'get_sales_order':
          return this.tool_getSalesOrder(input);
        case 'list_sales_customers':
          return this.tool_listSalesCustomers(input);
        case 'sales_dashboard':
          return this.tool_salesDashboard();
        // Edit/Update tools
        case 'mark_purchase_order_received':
          return this.action_markPurchaseOrderReceived(input, userId);
        case 'update_purchase_order_notes':
          return this.action_updatePurchaseOrderNotes(input, userId);
        case 'rename_folder':
          return this.action_renameFolder(input);
        case 'update_task':
          return this.action_updateTask(input, userId);
        // Invoices
        case 'list_invoices':
          return this.tool_listInvoices(input);
        case 'get_invoice':
          return this.tool_getInvoice(input);
        case 'invoice_dashboard':
          return this.tool_invoiceDashboard();
        case 'list_invoice_suppliers':
          return this.tool_listInvoiceSuppliers();
        case 'mark_invoice_paid':
          return this.action_markInvoicePaid(input, userId);
        case 'mark_invoice_unpaid':
          return this.action_markInvoiceUnpaid(input, userId);
        case 'archive_invoice':
          return this.action_archiveInvoice(input, userId);
        case 'restore_invoice':
          return this.action_restoreInvoice(input, userId);
        case 'update_invoice':
          return this.action_updateInvoice(input, userId);
        case 'categorize_invoice':
          return this.action_categorizeInvoice(input, userId);
        case 'delete_invoice':
          return this.action_deleteInvoice(input);
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

  // ==========================================================================
  // SALES (Verkauf) — B2B-Kundenbestellungen
  // ==========================================================================

  private async tool_listSalesOrders(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.status) where.status = input.status;
    if (input?.archived === true) where.shippedAt = { not: null };
    else if (input?.archived === false) where.shippedAt = null;
    if (input?.customerSearch) {
      where.customer = { companyName: { contains: input.customerSearch, mode: 'insensitive' as const } };
    }
    if (input?.urgency === 'overdue') {
      where.shippedAt = null;
      where.requiredDeliveryDate = { lt: new Date() };
    } else if (input?.urgency === 'urgent') {
      const in3 = new Date(); in3.setDate(in3.getDate() + 3);
      where.shippedAt = null;
      where.requiredDeliveryDate = { gte: new Date(), lte: in3 };
    }
    const orders = await this.prisma.salesOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        externalOrderNumber: true,
        status: true,
        orderDate: true,
        requiredDeliveryDate: true,
        shippedAt: true,
        invoiceSentAt: true,
        paidAt: true,
        totalNet: true,
        currency: true,
        customer: { select: { companyName: true, customerNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input?.limit || 20, 50),
    });
    return { count: orders.length, orders };
  }

  private async tool_getSalesOrder(input: any): Promise<unknown> {
    const idOrNumber = String(input?.orderNumber ?? '').trim();
    if (!idOrNumber) return { error: 'orderNumber required' };
    const where = idOrNumber.startsWith('VK-')
      ? { orgId: DEV_ORG_ID, orderNumber: idOrNumber }
      : { id: idOrNumber, orgId: DEV_ORG_ID };
    const order = await this.prisma.salesOrder.findFirst({
      where,
      include: {
        customer: { select: { companyName: true, customerNumber: true, email: true } },
        lineItems: {
          select: { id: true, title: true, quantity: true, unitPriceNet: true, lineNet: true, ean: true, supplierArticleNumber: true },
        },
      },
    });
    return order ?? { error: `Bestellung ${idOrNumber} nicht gefunden` };
  }

  private async tool_listSalesCustomers(input: any): Promise<unknown> {
    const where: any = { orgId: DEV_ORG_ID };
    if (input?.search) {
      where.OR = [
        { companyName: { contains: input.search, mode: 'insensitive' as const } },
        { customerNumber: { contains: input.search, mode: 'insensitive' as const } },
        { externalCustomerNumber: { contains: input.search, mode: 'insensitive' as const } },
      ];
    }
    const customers = await this.prisma.salesCustomer.findMany({
      where,
      select: {
        id: true, companyName: true, customerNumber: true, externalCustomerNumber: true,
        contactPerson: true, email: true, phone: true,
      },
      orderBy: { companyName: 'asc' },
      take: Math.min(input?.limit || 20, 100),
    });
    return { count: customers.length, customers };
  }

  private async tool_salesDashboard(): Promise<unknown> {
    const now = new Date();
    const in3 = new Date(); in3.setDate(in3.getDate() + 3);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [open, urgent, overdue, monthRevenueRaw] = await Promise.all([
      this.prisma.salesOrder.count({ where: { orgId: DEV_ORG_ID, shippedAt: null, status: { notIn: ['cancelled', 'completed'] } } }),
      this.prisma.salesOrder.count({
        where: { orgId: DEV_ORG_ID, shippedAt: null, requiredDeliveryDate: { gte: now, lte: in3 } },
      }),
      this.prisma.salesOrder.count({
        where: { orgId: DEV_ORG_ID, shippedAt: null, requiredDeliveryDate: { lt: now } },
      }),
      this.prisma.salesOrder.aggregate({
        where: { orgId: DEV_ORG_ID, createdAt: { gte: monthStart } },
        _sum: { totalNet: true },
      }),
    ]);
    return {
      openOrders: open,
      urgent: urgent,
      overdue: overdue,
      monthRevenueEur: Number(monthRevenueRaw._sum.totalNet ?? 0),
    };
  }

  // ==========================================================================
  // EDIT/UPDATE TOOLS
  // ==========================================================================

  private async action_markPurchaseOrderReceived(input: any, userId: string): Promise<unknown> {
    const orderNumber = String(input?.orderNumber ?? '').trim();
    if (!orderNumber) return { error: 'orderNumber required' };
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { orgId: DEV_ORG_ID, orderNumber },
    });
    if (!order) return { error: `Bestellung ${orderNumber} nicht gefunden` };
    const dateStr = input?.receivedAt as string | undefined;
    const receivedAt = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(receivedAt.getTime())) return { error: 'Ungültiges Datum' };
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { receivedAt },
      select: { id: true, orderNumber: true, receivedAt: true },
    });
    this.logger.log(`AI: ${userId} markierte ${orderNumber} angekommen am ${updated.receivedAt?.toISOString()}`);
    return { ok: true, orderNumber: updated.orderNumber, receivedAt: updated.receivedAt };
  }

  private async action_updatePurchaseOrderNotes(input: any, userId: string): Promise<unknown> {
    const orderNumber = String(input?.orderNumber ?? '').trim();
    if (!orderNumber) return { error: 'orderNumber required' };
    const newNotes = String(input?.notes ?? '').trim();
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { orgId: DEV_ORG_ID, orderNumber },
    });
    if (!order) return { error: `Bestellung ${orderNumber} nicht gefunden` };
    await this.prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { notes: newNotes || null },
    });
    this.logger.log(`AI: ${userId} aktualisierte Notes auf ${orderNumber}: "${newNotes.slice(0, 50)}…"`);
    return { ok: true, orderNumber, notes: newNotes };
  }

  private async action_renameFolder(input: any): Promise<unknown> {
    const newName = String(input?.newName ?? '').trim();
    if (!newName) return { error: 'newName required' };
    let folderId = input?.folderId as string | undefined;

    // Wenn keine ID, suche nach Name (currentName-Hint)
    if (!folderId && input?.currentName) {
      const found = await this.prisma.docFolder.findFirst({
        where: { orgId: DEV_ORG_ID, name: input.currentName, trashedAt: null },
        select: { id: true },
      });
      folderId = found?.id;
    }
    if (!folderId) return { error: 'Ordner nicht gefunden — bitte folderId oder currentName angeben' };

    const updated = await this.prisma.docFolder.update({
      where: { id: folderId },
      data: { name: newName },
      select: { id: true, name: true },
    });
    return { ok: true, folder: updated };
  }

  private async action_updateTask(input: any, userId: string): Promise<unknown> {
    const taskId = String(input?.taskId ?? '').trim();
    if (!taskId) return { error: 'taskId required' };
    const data: any = {};
    if (input?.title !== undefined) data.title = String(input.title);
    if (input?.description !== undefined) data.description = input.description ? String(input.description) : null;
    if (input?.priority) data.priority = input.priority;
    if (input?.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input?.completed !== undefined) {
      data.completed = !!input.completed;
      if (input.completed) data.completedAt = new Date();
    }
    if (Object.keys(data).length === 0) return { error: 'Mindestens ein Feld zum Ändern erforderlich' };
    const updated = await this.prisma.wmTask.update({
      where: { id: taskId },
      data,
      select: { id: true, title: true, priority: true, dueDate: true, completed: true },
    });
    this.logger.log(`AI: ${userId} updated task ${taskId} fields=${Object.keys(data).join(',')}`);
    return { ok: true, task: updated };
  }

  // ============================================================
  // INVOICES (Eingangsrechnungen) — Volle Admin-Rechte
  // ============================================================

  /** Resolved invoice by ID (UUID) ODER Rechnungsnummer (auch partial match) */
  private async resolveInvoice(query: { invoiceNumber?: string; supplierName?: string }): Promise<{ id: string; orgId: string } | { error: string }> {
    const orgId = DEV_ORG_ID;
    const q = (query.invoiceNumber ?? '').trim();
    // UUID?
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
      const inv = await this.prisma.invoice.findFirst({ where: { id: q, orgId }, select: { id: true, orgId: true } });
      if (!inv) return { error: `Keine Rechnung mit ID ${q} gefunden` };
      return inv;
    }
    // Rechnungsnummer — exakt, sonst partial
    if (q) {
      const exact = await this.prisma.invoice.findFirst({
        where: { orgId, invoiceNumber: q },
        select: { id: true, orgId: true },
      });
      if (exact) return exact;
      const partial = await this.prisma.invoice.findMany({
        where: { orgId, invoiceNumber: { contains: q, mode: 'insensitive' } },
        select: { id: true, invoiceNumber: true },
        take: 3,
      });
      if (partial.length === 1) return { id: partial[0].id, orgId };
      if (partial.length > 1) {
        return { error: `Mehrere Rechnungen passen zu "${q}": ${partial.map((p) => p.invoiceNumber).join(', ')}. Bitte spezifischer.` };
      }
    }
    // Fallback: ueber Lieferant — fuer "DHL-Rechnung bezahlt"
    if (query.supplierName) {
      const matches = await this.prisma.invoice.findMany({
        where: {
          orgId,
          supplierName: { contains: query.supplierName, mode: 'insensitive' },
          archived: false,
        },
        select: { id: true, invoiceNumber: true, status: true },
        orderBy: { dueDate: 'asc' },
        take: 5,
      });
      const unpaid = matches.filter((m) => m.status !== 'paid');
      if (unpaid.length === 1) return { id: unpaid[0].id, orgId };
      if (unpaid.length > 1) {
        return { error: `Mehrere offene Rechnungen von "${query.supplierName}": ${unpaid.map((m) => m.invoiceNumber ?? '(ohne Nr)').join(', ')}. Bitte Rechnungsnummer angeben.` };
      }
    }
    return { error: 'Rechnung nicht gefunden' };
  }

  private async tool_listInvoices(input: any) {
    const orgId = DEV_ORG_ID;
    const result = await this.invoices.list(orgId, {
      status: input?.status,
      supplier: input?.supplier,
      category: input?.category,
      search: input?.search,
      from: input?.from,
      to: input?.to,
      amountMin: input?.amountMin != null ? String(input.amountMin) : undefined,
      amountMax: input?.amountMax != null ? String(input.amountMax) : undefined,
      archived: input?.archived === true ? 'true' : undefined,
      limit: String(Math.min(20, input?.limit ?? 20)),
    });
    return {
      total: result.total,
      items: result.items.map((i: any) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        supplier: i.supplierName,
        invoiceDate: i.invoiceDate?.toISOString?.()?.slice(0, 10) ?? null,
        dueDate: i.dueDate?.toISOString?.()?.slice(0, 10) ?? null,
        grossAmount: i.grossAmount ? Number(i.grossAmount.toString()) : null,
        status: i.status,
        category: i.category,
        paidAt: i.paidAt?.toISOString?.()?.slice(0, 10) ?? null,
      })),
    };
  }

  private async tool_getInvoice(input: any) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    const inv: any = await this.invoices.get(r.orgId, r.id);
    return {
      id: inv.id,
      supplier: { name: inv.supplierName, email: inv.supplierEmail, vatId: inv.supplierVatId },
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      paidBy: inv.paidBy?.name ?? null,
      currency: inv.currency,
      amounts: {
        net: inv.netAmount ? Number(inv.netAmount.toString()) : null,
        vat: inv.vatAmount ? Number(inv.vatAmount.toString()) : null,
        gross: inv.grossAmount ? Number(inv.grossAmount.toString()) : null,
        taxRate: inv.taxRate ? Number(inv.taxRate.toString()) : null,
      },
      payment: { iban: inv.iban, bic: inv.bic, bankName: inv.bankName, reference: inv.paymentReference },
      category: inv.category,
      status: inv.status,
      notes: inv.notes,
      reviewed: inv.reviewed,
      historyCount: (inv.events ?? []).length,
    };
  }

  private async tool_invoiceDashboard() {
    return this.invoiceStats.dashboard(DEV_ORG_ID);
  }

  private async tool_listInvoiceSuppliers() {
    return this.invoices.suppliersDetailed(DEV_ORG_ID);
  }

  private async action_markInvoicePaid(input: any, userId: string) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber, supplierName: input?.supplierName });
    if ('error' in r) return r;
    const inv: any = await this.invoices.markPaid(r.orgId, r.id, userId, {
      paidAt: input?.paidAt,
      note: input?.note,
    });
    this.logger.log(`AI: ${userId} marked invoice ${r.id} as paid`);
    return { ok: true, id: r.id, invoiceNumber: inv.invoiceNumber, status: inv.status, paidAt: inv.paidAt };
  }

  private async action_markInvoiceUnpaid(input: any, userId: string) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    const inv: any = await this.invoices.markUnpaid(r.orgId, r.id, userId);
    return { ok: true, id: r.id, invoiceNumber: inv.invoiceNumber, status: inv.status };
  }

  private async action_archiveInvoice(input: any, userId: string) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    await this.invoices.archive(r.orgId, r.id, userId);
    return { ok: true, id: r.id, archived: true };
  }

  private async action_restoreInvoice(input: any, userId: string) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    await this.invoices.restore(r.orgId, r.id, userId);
    return { ok: true, id: r.id, archived: false };
  }

  private async action_updateInvoice(input: any, userId: string) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    const body: any = {};
    const fields = ['supplierName', 'supplierEmail', 'supplierAddress', 'invoiceDate', 'dueDate',
      'netAmount', 'vatAmount', 'grossAmount', 'taxRate',
      'iban', 'bic', 'paymentReference', 'category', 'notes'];
    for (const f of fields) if (input?.[f] !== undefined) body[f] = input[f];
    if (Object.keys(body).length === 0) return { error: 'Keine Aenderungen angegeben' };
    const inv: any = await this.invoices.update(r.orgId, r.id, userId, body);
    return { ok: true, id: r.id, updated: Object.keys(body), invoiceNumber: inv.invoiceNumber };
  }

  private async action_categorizeInvoice(input: any, userId: string) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    const inv: any = await this.invoices.update(r.orgId, r.id, userId, { category: input.category });
    return { ok: true, id: r.id, category: inv.category };
  }

  private async action_deleteInvoice(input: any) {
    const r = await this.resolveInvoice({ invoiceNumber: input?.invoiceNumber });
    if ('error' in r) return r;
    await this.invoices.remove(r.orgId, r.id);
    this.logger.warn(`AI: deleted invoice ${r.id}`);
    return { ok: true, id: r.id, deleted: true };
  }
}
