import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        createdById: true,
        lastEditedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows;
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

  async remove(id: string) {
    await this.get(id);
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
  // Liveblocks Auth (Phase 2)
  // ------------------------------------------------------------------
  /**
   * Erzeugt ein Liveblocks-Auth-Token fuer einen User um einem Room
   * beizutreten. Token enthaelt Permissions (room-scoped, time-limited).
   * Wenn LIVEBLOCKS_SECRET_KEY nicht gesetzt ist, fallback: Frontend
   * laeuft im Single-User-Modus (kein Multiplayer).
   */
  async createLiveblocksAuthToken(boardId: string, userInfo: {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string;
  }): Promise<{ token: string | null; reason?: string }> {
    const secretKey = this.config.get<string>('LIVEBLOCKS_SECRET_KEY');
    if (!secretKey) {
      return { token: null, reason: 'LIVEBLOCKS_SECRET_KEY not configured — single-user mode' };
    }
    const wb = await this.get(boardId);
    const roomId = wb.liveblocksRoomId || `wb-${wb.id}`;

    // Liveblocks Access-Token API (room-scoped):
    //   POST https://api.liveblocks.io/v2/rooms/{roomId}/authorize
    //   { userId, userInfo }
    // Funktioniert auf allen Plans inkl. Free-Tier. Der ID-Token-Endpoint
    // (/v2/authorize-user) ist Pro-only und liefert sonst 400.
    const url = `https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}/authorize`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userInfo.userId,
        userInfo: {
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.avatarUrl,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Liveblocks room-authorize ${res.status}: ${body.slice(0, 300)}`);
      throw new BadRequestException(`Liveblocks-Auth fehlgeschlagen (${res.status})`);
    }
    const data = await res.json() as { token?: string };
    if (!data.token) throw new BadRequestException('Liveblocks lieferte kein Token');
    return { token: data.token };
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
