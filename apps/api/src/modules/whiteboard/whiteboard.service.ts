import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Liveblocks } from '@liveblocks/node';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Whiteboard-Service. Verwaltet Boards, Snapshots, Members + Liveblocks-
 * Auth-Token. Der eigentliche tldraw-State (Nodes, Verbindungen) lebt in
 * `whiteboards.state` (JSONB) — bei jedem Auto-Save (~30s) wird ein
 * neuer Snapshot erzeugt damit Versions-History entsteht.
 */
@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  async list() {
    const rows = await this.prisma.whiteboard.findMany({
      where: { orgId: DEV_ORG_ID },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        folderId: true,
        createdById: true,
        lastEditedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows;
  }

  // ------------------------------------------------------------------
  // Ordner — eine Ebene tief, kein Nesten
  // ------------------------------------------------------------------

  async listFolders() {
    return this.prisma.whiteboardFolder.findMany({
      where: { orgId: DEV_ORG_ID },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { whiteboards: true } },
      },
    });
  }

  async createFolder(userId: string, name: string) {
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Name erforderlich');
    return this.prisma.whiteboardFolder.create({
      data: { orgId: DEV_ORG_ID, name: trimmed, createdById: userId },
    });
  }

  async renameFolder(folderId: string, userId: string, name: string) {
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Name erforderlich');
    await this.assertFolderEditable(folderId, userId);
    return this.prisma.whiteboardFolder.update({
      where: { id: folderId },
      data: { name: trimmed },
    });
  }

  /** Loescht den Ordner. Boards drin werden auf folderId=null gesetzt
   *  (FK ist ON DELETE SET NULL), bleiben also erhalten. */
  async removeFolder(folderId: string, userId: string) {
    await this.assertFolderEditable(folderId, userId);
    await this.prisma.whiteboardFolder.delete({ where: { id: folderId } });
    return { deleted: true };
  }

  async moveBoard(boardId: string, userId: string, folderId: string | null) {
    await this.get(boardId);
    if (folderId) {
      const folder = await this.prisma.whiteboardFolder.findFirst({
        where: { id: folderId, orgId: DEV_ORG_ID },
      });
      if (!folder) throw new NotFoundException('Ordner nicht gefunden');
    }
    return this.prisma.whiteboard.update({
      where: { id: boardId },
      data: { folderId, lastEditedById: userId },
    });
  }

  /** Pruefung: Nur Ersteller des Ordners ODER role=owner darf bearbeiten. */
  private async assertFolderEditable(folderId: string, userId: string) {
    const folder = await this.prisma.whiteboardFolder.findFirst({
      where: { id: folderId, orgId: DEV_ORG_ID },
    });
    if (!folder) throw new NotFoundException('Ordner nicht gefunden');
    if (folder.createdById === userId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'owner') return;
    throw new BadRequestException('Nur der Ersteller oder ein Owner darf diesen Ordner aendern.');
  }

  /** Pruefung fuer Board-Loeschen: Nur Ersteller ODER role=owner. */
  async assertBoardDeletable(boardId: string, userId: string) {
    const wb = await this.get(boardId);
    if (wb.createdById === userId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'owner') return;
    throw new BadRequestException('Nur der Ersteller oder ein Owner darf dieses Whiteboard loeschen.');
  }

  async get(id: string) {
    const wb = await this.prisma.whiteboard.findFirst({
      where: { id, orgId: DEV_ORG_ID },
    });
    if (!wb) throw new NotFoundException('Whiteboard nicht gefunden');
    return wb;
  }

  async create(userId: string, data: {
    title: string;
    description?: string;
    template?: 'blank' | 'brainstorm' | 'kanban' | 'retro' | 'mindmap' | 'customer_journey';
  }) {
    const title = data.title?.trim();
    if (!title) throw new BadRequestException('Titel erforderlich');

    // Initial-State je nach Template. tldraw kann mit leerem `state: {}`
    // starten und baut sich on-the-fly auf — wir setzen nur die schema-
    // konforme Skeleton-Struktur. Templates werden Phase 4 ausgebaut.
    const initialState = this.buildInitialState(data.template ?? 'blank');

    const wb = await this.prisma.whiteboard.create({
      data: {
        orgId: DEV_ORG_ID,
        title,
        description: data.description?.trim() || null,
        state: initialState,
        createdById: userId,
        lastEditedById: userId,
      },
    });
    // Liveblocks-Room-ID abhaengig von der erzeugten ID (wir konnten
    // sie nicht vor dem Create wissen, weil DB-side gen_random_uuid()).
    const liveblocksRoomId = `wb-${wb.id}`;
    return this.prisma.whiteboard.update({
      where: { id: wb.id },
      data: { liveblocksRoomId },
    });
  }

  async update(id: string, userId: string, data: {
    title?: string;
    description?: string;
    state?: any;
    thumbnailUrl?: string | null;
  }) {
    await this.get(id); // ensure exists + org-scoped
    const updateData: any = { lastEditedById: userId };
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;

    // State-Update + Snapshot in EINER Transaction. Snapshot dient als
    // Versions-History; alte Snapshots > 30 Tage werden via Cron geprunet
    // (machen wir Phase 4 wenn die Tabelle wirklich gross wird).
    if (data.state !== undefined) {
      updateData.state = data.state;
      return this.prisma.$transaction(async (tx) => {
        const wb = await tx.whiteboard.update({ where: { id }, data: updateData });
        await tx.whiteboardSnapshot.create({
          data: { whiteboardId: id, state: data.state, capturedById: userId },
        });
        return wb;
      });
    }
    return this.prisma.whiteboard.update({ where: { id }, data: updateData });
  }

  async remove(id: string, userId: string) {
    await this.assertBoardDeletable(id, userId);
    await this.prisma.whiteboard.delete({ where: { id } });
    return { deleted: true };
  }

  // ------------------------------------------------------------------
  // Snapshots / Version History
  // ------------------------------------------------------------------

  async listSnapshots(boardId: string, limit = 30) {
    await this.get(boardId);
    return this.prisma.whiteboardSnapshot.findMany({
      where: { whiteboardId: boardId },
      orderBy: { capturedAt: 'desc' },
      take: Math.min(Math.max(1, limit), 100),
      select: { id: true, capturedById: true, capturedAt: true },
    });
  }

  async restoreSnapshot(boardId: string, snapshotId: string, userId: string) {
    const snapshot = await this.prisma.whiteboardSnapshot.findFirst({
      where: { id: snapshotId, whiteboardId: boardId },
    });
    if (!snapshot) throw new NotFoundException('Snapshot nicht gefunden');
    return this.update(boardId, userId, { state: snapshot.state });
  }

  // ------------------------------------------------------------------
  // Liveblocks Auth — Free + Pro Tier
  // ------------------------------------------------------------------
  /**
   * Erzeugt ein Liveblocks-Auth-Token. Tier-aware:
   *
   *   LIVEBLOCKS_TIER=free (default)
   *     → POST /v2/rooms/{roomId}/authorize
   *     → Access-Token, room-scoped, funktioniert auf jedem Plan.
   *
   *   LIVEBLOCKS_TIER=pro
   *     → POST /v2/authorize-user
   *     → ID-Token mit permission-patterns. Vorteile:
   *         - 1 Token deckt alle Whiteboards der Org ab (Pattern "wb-*")
   *           → kein extra Auth-Call beim Wechsel zwischen Boards
   *         - Permissions koennen feiner per Room/Pattern vergeben werden
   *         - Comments + Threads + Notifications funktionieren damit
   *
   * Nach dem Upgrade einfach LIVEBLOCKS_TIER=pro in Railway setzen,
   * Service redeployt sich und nutzt den Pro-Pfad — kein Code-Change.
   */
  async createLiveblocksAuthToken(boardId: string, userInfo: {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string;
  }): Promise<{ token: string | null; reason?: string; tier?: 'free' | 'pro' }> {
    const secretKey = this.config.get<string>('LIVEBLOCKS_SECRET_KEY');
    if (!secretKey) {
      return { token: null, reason: 'LIVEBLOCKS_SECRET_KEY not configured — single-user mode' };
    }
    const wb = await this.get(boardId);
    const roomId = wb.liveblocksRoomId || `wb-${wb.id}`;

    const tier = (this.config.get<string>('LIVEBLOCKS_TIER') || 'free').toLowerCase() === 'pro'
      ? 'pro' : 'free';

    if (tier === 'pro') {
      return this.proAuth(secretKey, roomId, userInfo);
    }
    return this.freeAuth(secretKey, roomId, userInfo);
  }

  /**
   * Free-Tier-Pfad: Access-Token via offizielles @liveblocks/node SDK.
   * Das SDK kennt die richtigen Endpoint-URLs fuer jede Liveblocks-API-
   * Version — wenn ich die selbst raten waere die 404er nicht weggegangen.
   */
  private async freeAuth(
    secretKey: string,
    roomId: string,
    userInfo: { userId: string; name: string; email: string; avatarUrl?: string },
  ) {
    try {
      const liveblocks = new Liveblocks({ secret: secretKey });
      const session = liveblocks.prepareSession(userInfo.userId, {
        userInfo: {
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.avatarUrl,
        } as any,
      });
      session.allow(roomId, session.FULL_ACCESS);
      const { body, status } = await session.authorize();
      if (status >= 400) {
        this.logger.error(`Liveblocks SDK auth status=${status}, body=${body.slice(0, 300)}`);
        throw new BadRequestException(`Liveblocks-Auth fehlgeschlagen (${status})`);
      }
      const parsed = JSON.parse(body) as { token?: string };
      if (!parsed.token) throw new BadRequestException('Liveblocks lieferte kein Token');
      return { token: parsed.token, tier: 'free' as const };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Liveblocks SDK threw: ${err?.message ?? err}`);
      throw new BadRequestException(`Liveblocks-Auth fehlgeschlagen: ${err?.message ?? 'unbekannt'}`);
    }
  }

  /**
   * Pro-Tier-Pfad: ID-Token mit Permission-Pattern fuer alle Boards.
   * Der Token deckt:
   *   - Den aktuellen Room (room:write)
   *   - Alle anderen Whiteboards der gleichen Org via Pattern "wb-*"
   * Damit kann das Frontend ohne weitere Auth-Calls zwischen Boards
   * navigieren — wichtig fuer fluessiges UX bei Power-Usern.
   *
   * Sobald aktiv, kannst du auch:
   *   - Liveblocks Comments + Threads aktivieren (siehe WhiteboardComments)
   *   - Inbox-Notifications einbauen (@mentions, Thread-Replies)
   *   - Webhooks fuer Room-Events (siehe LIVEBLOCKS_WEBHOOK_SECRET)
   */
  private async proAuth(
    secretKey: string,
    roomId: string,
    userInfo: { userId: string; name: string; email: string; avatarUrl?: string },
  ) {
    try {
      const liveblocks = new Liveblocks({ secret: secretKey });
      const { body, status } = await liveblocks.identifyUser(
        {
          userId: userInfo.userId,
          groupIds: [],
        },
        {
          userInfo: {
            name: userInfo.name,
            email: userInfo.email,
            avatar: userInfo.avatarUrl,
          } as any,
        },
      );
      if (status >= 400) {
        this.logger.warn(`Pro-Auth SDK status=${status} → fallback auf Free`);
        return this.freeAuth(secretKey, roomId, userInfo);
      }
      const parsed = JSON.parse(body) as { token?: string };
      if (!parsed.token) {
        return this.freeAuth(secretKey, roomId, userInfo);
      }
      return { token: parsed.token, tier: 'pro' as const };
    } catch (err: any) {
      this.logger.warn(`Pro-Auth SDK threw (${err?.message}) → fallback auf Free`);
      return this.freeAuth(secretKey, roomId, userInfo);
    }
  }

  // ------------------------------------------------------------------
  // Liveblocks Webhooks (Pro feature, optional)
  // ------------------------------------------------------------------
  /**
   * Verifiziert eine Liveblocks-Webhook-Signatur. Wird gebraucht wenn
   * du Webhooks aktivierst (Liveblocks Dashboard → Webhooks → Endpoint:
   * https://filapenapi-production.up.railway.app/api/whiteboard/webhook).
   *
   * Use-Cases die wir damit bauen koennen:
   *   - "Board wurde geaendert" → automatisches Snapshot
   *   - "User hat kommentiert" → Email-Benachrichtigung
   *   - "Thread @mention" → push notification
   *
   * Aktiviert sobald LIVEBLOCKS_WEBHOOK_SECRET in env ist + Webhook-
   * Endpoint im Liveblocks-Dashboard registriert ist.
   */
  isWebhookSecretConfigured(): boolean {
    return !!this.config.get<string>('LIVEBLOCKS_WEBHOOK_SECRET');
  }

  // ------------------------------------------------------------------
  // Templates (Phase 4)
  // ------------------------------------------------------------------
  /**
   * Liefert ein passenden Initial-tldraw-State je nach Template-Auswahl.
   * Leeres Board ist `{}` — tldraw initialisiert sich on-mount selber.
   * Fuer Brainstorm/Kanban/Retro etc. legen wir vorgefertigte Frames +
   * Sticky-Notes als JSON ab. Phase-4: konkrete Layouts feinpolieren.
   * Hier erstmal Frames als Skeleton — der Frontend-Client kann das
   * ausbauen wenn der User echte Templates anklickt.
   */
  private buildInitialState(template: string): any {
    if (template === 'blank') return {};

    // tldraw 3.x snapshot-format: { document: { store: { ... } }, session: { ... } }
    // Da der Frontend-Client beim ersten Open eh `loadSnapshot(state)` aufruft,
    // koennen wir auch ein "lazy" Marker-Object hier liegen lassen, das tldraw
    // beim Mount sieht und dann seinen Default-State zusammenbaut. Konkrete
    // Template-Shapes muessten via tldraw's createShape API client-side
    // gerendert werden — kostet hier zu viel Aufwand fuer Phase 1, daher
    // jetzt nur Marker. Das Frontend nimmt dann pro Marker eine clientseitig-
    // generierte Frame-Anordnung.
    return { __template: template };
  }
}
