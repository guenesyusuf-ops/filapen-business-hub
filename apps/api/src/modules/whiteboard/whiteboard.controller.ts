import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Headers, Query, Logger,
  HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { WhiteboardService } from './whiteboard.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';

@Controller('whiteboard')
export class WhiteboardController {
  private readonly logger = new Logger(WhiteboardController.name);

  constructor(
    private readonly service: WhiteboardService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private extractUserId(authHeader: string | undefined): string {
    if (!authHeader) return DEV_USER_ID;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return DEV_USER_ID;
    try { return this.auth.validateToken(parts[1]).sub; } catch { return DEV_USER_ID; }
  }

  // CRUD --------------------------------------------------------------

  @Get('boards')
  async list() {
    try {
      return await this.service.list();
    } catch (err: any) {
      this.logger.error(`list failed: ${err?.message ?? err}`);
      throw new HttpException('Whiteboards konnten nicht geladen werden', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('boards/:id')
  async get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('boards')
  async create(
    @Headers('authorization') authHeader: string,
    @Body() body: { title: string; description?: string; template?: any },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.create(userId, body);
  }

  @Put('boards/:id')
  async update(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; state?: any; thumbnailUrl?: string | null },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.update(id, userId, body);
  }

  @Delete('boards/:id')
  async remove(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.remove(id, userId);
  }

  @Patch('boards/:id/move')
  async moveBoard(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { folderId: string | null },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.moveBoard(id, userId, body.folderId ?? null);
  }

  // Ordner -----------------------------------------------------------

  @Get('folders')
  async listFolders() {
    return this.service.listFolders();
  }

  @Post('folders')
  async createFolder(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.createFolder(userId, body.name);
  }

  @Patch('folders/:id')
  async renameFolder(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.renameFolder(id, userId, body.name);
  }

  @Delete('folders/:id')
  async removeFolder(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.removeFolder(id, userId);
  }

  // Snapshots --------------------------------------------------------

  @Get('boards/:id/snapshots')
  async listSnapshots(@Param('id') id: string) {
    return this.service.listSnapshots(id);
  }

  @Post('boards/:id/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    const userId = this.extractUserId(authHeader);
    return this.service.restoreSnapshot(id, snapshotId, userId);
  }

  // Liveblocks Auth --------------------------------------------------

  /**
   * Frontend ruft diesen Endpoint vor Connect zum Liveblocks-Room auf.
   * Liefert ein zeitlich begrenztes Token mit room-scoped Permissions.
   * Wenn LIVEBLOCKS_SECRET_KEY nicht gesetzt → token=null, Frontend faellt
   * automatisch auf Single-User zurueck.
   */
  @Post('boards/:id/liveblocks-auth')
  async liveblocksAuth(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const userId = this.extractUserId(authHeader);
    // User-Daten holen damit andere Cursors einen Namen + Avatar sehen
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User nicht gefunden');
    const name = user.name
      || [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || user.email.split('@')[0];
    return this.service.createLiveblocksAuthToken(id, {
      userId,
      name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? undefined,
    });
  }

  // -----------------------------------------------------------------
  // Filapen-Integration (Phase 3): Suche fuer Task/Order/Product Cards
  // -----------------------------------------------------------------
  /**
   * Schlanke Such-API fuer den Drag-Panel im Whiteboard. Liefert minimal
   * benoetigte Felder fuer die Custom-Shapes — voller Zugriff bleibt im
   * jeweiligen Modul. Limit 20 Treffer pro Call damit das UI schnell ist.
   */
  @Get('search/tasks')
  async searchTasks(@Query('q') q?: string) {
    const where: any = { orgId: '00000000-0000-0000-0000-000000000001' };
    if (q?.trim()) where.title = { contains: q.trim(), mode: 'insensitive' };
    const rows = await this.prisma.wmTask.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, priority: true, completed: true, dueDate: true,
        column: { select: { name: true } },
        project: { select: { id: true, name: true, color: true } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      completed: t.completed,
      dueDate: t.dueDate?.toISOString() ?? null,
      columnName: t.column?.name ?? null,
      projectId: t.project?.id ?? null,
      projectName: t.project?.name ?? null,
      projectColor: t.project?.color ?? null,
    }));
  }

  @Get('search/orders')
  async searchOrders(@Query('q') q?: string) {
    const where: any = { orgId: '00000000-0000-0000-0000-000000000001', status: { not: 'cancelled' } };
    if (q?.trim()) {
      where.OR = [
        { orderNumber: { contains: q.trim(), mode: 'insensitive' } },
        { customer: { companyName: { contains: q.trim(), mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, orderNumber: true, status: true, totalNet: true, currency: true,
        paidAt: true, shippedAt: true,
        customer: { select: { companyName: true } },
      },
    });
    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalNet: Number(o.totalNet),
      currency: o.currency,
      paidAt: o.paidAt?.toISOString() ?? null,
      shippedAt: o.shippedAt?.toISOString() ?? null,
      customerName: o.customer?.companyName ?? null,
    }));
  }

  @Get('search/products')
  async searchProducts(@Query('q') q?: string) {
    const where: any = { orgId: '00000000-0000-0000-0000-000000000001' };
    if (q?.trim()) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { sku: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.productVariant.findMany({
      where,
      orderBy: { title: 'asc' },
      take: 20,
      select: {
        id: true, sku: true, title: true, price: true, cogs: true,
        product: { select: { id: true, title: true, imageUrl: true } },
      },
    });
    return rows.map((v) => ({
      id: v.id,
      sku: v.sku,
      productTitle: v.product?.title ?? '—',
      variantTitle: v.title,
      imageUrl: v.product?.imageUrl ?? null,
      price: v.price ? Number(v.price) : null,
      cogs: v.cogs ? Number(v.cogs) : null,
    }));
  }
}
