import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret, decryptSecret, scorePasswordStrength } from './password.util';

export interface CreateEntryInput {
  title: string;
  url?: string | null;
  username?: string | null;
  password: string;
  notes?: string | null;
  totpSeed?: string | null;
  categoryId?: string | null;
  faviconUrl?: string | null;
  sharedWithUserIds?: string[];
}

export interface UpdateEntryInput {
  title?: string;
  url?: string | null;
  username?: string | null;
  password?: string;
  notes?: string | null;
  totpSeed?: string | null;
  categoryId?: string | null;
  faviconUrl?: string | null;
}

interface AuditContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Einfacher Sliding-Window-Rate-Limiter im Prozess (Map<key, timestamps[]>).
 * OK bei 1 Replika. Bei Multi-Replika braucht es Redis o.ae.
 */
class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  hit(key: string, maxPerWindow: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= maxPerWindow) {
      const oldest = arr[0];
      return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true, retryAfterMs: 0 };
  }

  gc(): void {
    const now = Date.now();
    for (const [k, arr] of this.hits) {
      const filtered = arr.filter((t) => now - t < 60_000);
      if (filtered.length === 0) this.hits.delete(k);
      else this.hits.set(k, filtered);
    }
  }
}

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly secret: string;
  private readonly revealLimiter = new RateLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Reuse des bestehenden Shipping-Encryption-Secrets — kein neuer Env-Slot.
    // Bei Bedarf spaeter auf eigenes PASSWORD_MANAGER_SECRET umschalten.
    this.secret =
      this.config.get<string>('PASSWORD_MANAGER_SECRET') ||
      this.config.get<string>('SHIPPING_ENCRYPTION_SECRET') ||
      this.config.get<string>('ENCRYPTION_SECRET') ||
      'dev-fallback-do-not-use-in-prod';
    if (this.secret.startsWith('dev-fallback')) {
      this.logger.warn(
        'PASSWORD_MANAGER_SECRET / SHIPPING_ENCRYPTION_SECRET nicht gesetzt — Fallback ist NUR fuer lokale Entwicklung.',
      );
    }
  }

  // ------------------------------------------------------------
  // Access-Helfer
  // ------------------------------------------------------------

  /**
   * True wenn der User Zugriff auf den Eintrag hat.
   * Owner (createdBy) haben immer Zugriff. Admin-Rolle: hat Owner-Rechte org-weit.
   */
  private async userCanRead(
    orgId: string,
    userId: string,
    userRole: string,
    entryId: string,
  ): Promise<{ ok: boolean; entry: any; isOwner: boolean; permission: string }> {
    const entry = await this.prisma.passwordEntry.findFirst({
      where: { id: entryId, orgId },
    });
    if (!entry) return { ok: false, entry: null, isOwner: false, permission: 'none' };

    if (entry.createdById === userId) {
      return { ok: true, entry, isOwner: true, permission: 'manage' };
    }
    if (userRole === 'owner' || userRole === 'admin') {
      return { ok: true, entry, isOwner: false, permission: 'manage' };
    }
    const access = await this.prisma.passwordAccess.findFirst({
      where: { entryId, userId },
    });
    if (!access) return { ok: false, entry, isOwner: false, permission: 'none' };
    return { ok: true, entry, isOwner: false, permission: access.permission };
  }

  private async recordAudit(
    orgId: string,
    userId: string,
    action: string,
    entryId?: string | null,
    ctx?: AuditContext,
  ): Promise<void> {
    try {
      await this.prisma.passwordAuditLog.create({
        data: {
          orgId,
          userId,
          action,
          entryId: entryId ?? null,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`audit log write failed: ${err?.message}`);
    }
  }

  // ------------------------------------------------------------
  // Categories
  // ------------------------------------------------------------

  async listCategories(orgId: string) {
    return this.prisma.passwordCategory.findMany({
      where: { orgId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(orgId: string, data: { name: string; color?: string; icon?: string | null }) {
    if (!data.name?.trim()) throw new BadRequestException('Name erforderlich');
    return this.prisma.passwordCategory.create({
      data: {
        orgId,
        name: data.name.trim(),
        color: data.color?.trim() || '#6366f1',
        icon: data.icon?.trim() || null,
      },
    });
  }

  async updateCategory(orgId: string, id: string, data: { name?: string; color?: string; icon?: string | null; sortOrder?: number }) {
    const cat = await this.prisma.passwordCategory.findFirst({ where: { id, orgId } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden');
    return this.prisma.passwordCategory.update({
      where: { id },
      data: {
        name: data.name?.trim() ?? undefined,
        color: data.color?.trim() ?? undefined,
        icon: data.icon !== undefined ? (data.icon?.trim() || null) : undefined,
        sortOrder: data.sortOrder ?? undefined,
      },
    });
  }

  async deleteCategory(orgId: string, id: string) {
    const cat = await this.prisma.passwordCategory.findFirst({ where: { id, orgId } });
    if (!cat) throw new NotFoundException('Kategorie nicht gefunden');
    // Entries in dieser Kategorie werden per SET NULL auf categoryId=null gesetzt (DB-Constraint)
    await this.prisma.passwordCategory.delete({ where: { id } });
    return { ok: true };
  }

  // ------------------------------------------------------------
  // Entries
  // ------------------------------------------------------------

  /**
   * Listet alle Entries die der User sehen darf (Owner + explizit freigegeben).
   * Admin/Owner der Org sehen alles.
   *
   * KEINE Passwoerter im Response — nur Metadaten. Passwort erst via reveal().
   */
  async listEntries(
    orgId: string,
    userId: string,
    userRole: string,
    filter?: { search?: string; categoryId?: string | null },
  ) {
    const isAdmin = userRole === 'owner' || userRole === 'admin';

    const where: any = { orgId };
    if (filter?.categoryId) where.categoryId = filter.categoryId;
    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { username: { contains: filter.search, mode: 'insensitive' } },
        { url: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (!isAdmin) {
      // User sieht nur Entries die ihm gehoeren ODER die mit ihm geteilt sind
      where.OR = [
        ...(where.OR ?? []),
        { createdById: userId },
        { access: { some: { userId } } },
      ];
      // Wenn OR ohne search reicht:
      if (!filter?.search && !filter?.categoryId) {
        delete where.OR;
        where.AND = [
          { orgId },
          { OR: [{ createdById: userId }, { access: { some: { userId } } }] },
        ];
      }
    }

    const entries = await this.prisma.passwordEntry.findMany({
      where,
      orderBy: [{ title: 'asc' }],
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        access: {
          select: {
            userId: true,
            permission: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { attachments: true } },
      },
    });

    return entries.map((e) => ({
      id: e.id,
      title: e.title,
      url: e.url,
      username: e.username,
      faviconUrl: e.faviconUrl,
      passwordStrength: e.passwordStrength,
      passwordUpdatedAt: e.passwordUpdatedAt,
      lastUsedAt: e.lastUsedAt,
      hasTotp: !!e.totpSeedEncrypted,
      hasNotes: !!e.notesEncrypted,
      attachmentCount: e._count.attachments,
      category: e.category,
      createdBy: e.createdBy,
      sharedWith: e.access.map((a) => ({ ...a.user, permission: a.permission })),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  }

  async createEntry(
    orgId: string,
    userId: string,
    input: CreateEntryInput,
    ctx?: AuditContext,
  ) {
    if (!input.title?.trim()) throw new BadRequestException('Titel erforderlich');
    if (typeof input.password !== 'string' || !input.password) {
      throw new BadRequestException('Passwort erforderlich');
    }

    const entry = await this.prisma.passwordEntry.create({
      data: {
        orgId,
        categoryId: input.categoryId ?? null,
        title: input.title.trim(),
        url: input.url?.trim() || null,
        username: input.username?.trim() || null,
        passwordEncrypted: encryptSecret(input.password, this.secret),
        notesEncrypted: input.notes ? encryptSecret(input.notes, this.secret) : undefined,
        totpSeedEncrypted: input.totpSeed
          ? encryptSecret(input.totpSeed.replace(/\s+/g, '').toUpperCase(), this.secret)
          : undefined,
        faviconUrl: input.faviconUrl?.trim() || null,
        passwordStrength: scorePasswordStrength(input.password),
        createdById: userId,
      },
    });

    if (input.sharedWithUserIds?.length) {
      const uniqueIds = Array.from(new Set(input.sharedWithUserIds)).filter((id) => id !== userId);
      if (uniqueIds.length) {
        await this.prisma.passwordAccess.createMany({
          data: uniqueIds.map((uid) => ({
            entryId: entry.id,
            userId: uid,
            permission: 'view',
            grantedById: userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.recordAudit(orgId, userId, 'create', entry.id, ctx);
    return { id: entry.id };
  }

  async updateEntry(
    orgId: string,
    userId: string,
    userRole: string,
    id: string,
    input: UpdateEntryInput,
    ctx?: AuditContext,
  ) {
    const auth = await this.userCanRead(orgId, userId, userRole, id);
    if (!auth.ok) throw new NotFoundException('Eintrag nicht gefunden');
    if (auth.permission === 'view') {
      throw new ForbiddenException('Nur Lese-Berechtigung');
    }

    // Passwort + 2FA-Seed: nur der Ersteller ODER der Org-Owner (Chef) duerfen
    // aendern. Admins und alle anderen mit Zugriff nicht — verhindert dass
    // ein Team-Passwort heimlich rotiert und der Ersteller ausgesperrt wird.
    // Der Owner bleibt Notfall-Backup falls der Ersteller ausscheidet.
    // Andere Felder (Titel, URL, Kategorie, Notizen) sind offen fuer alle mit
    // Edit-Rechten.
    const changesSecret = input.password !== undefined || input.totpSeed !== undefined;
    if (changesSecret) {
      const isCreator = auth.entry.createdById === userId;
      const isOwner = userRole === 'owner';
      if (!isCreator && !isOwner) {
        throw new ForbiddenException(
          'Nur der Ersteller oder der Owner der Organisation darf Passwort und 2FA-Seed aendern. Titel, URL, Kategorie und Notizen kannst du weiterhin bearbeiten.',
        );
      }
    }

    const patch: any = {};
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.url !== undefined) patch.url = input.url?.trim() || null;
    if (input.username !== undefined) patch.username = input.username?.trim() || null;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.faviconUrl !== undefined) patch.faviconUrl = input.faviconUrl?.trim() || null;
    if (input.password !== undefined && input.password) {
      patch.passwordEncrypted = encryptSecret(input.password, this.secret);
      patch.passwordStrength = scorePasswordStrength(input.password);
      patch.passwordUpdatedAt = new Date();
    }
    if (input.notes !== undefined) {
      patch.notesEncrypted = input.notes ? encryptSecret(input.notes, this.secret) : null;
    }
    if (input.totpSeed !== undefined) {
      patch.totpSeedEncrypted = input.totpSeed
        ? encryptSecret(input.totpSeed.replace(/\s+/g, '').toUpperCase(), this.secret)
        : null;
    }

    await this.prisma.passwordEntry.update({ where: { id }, data: patch });
    await this.recordAudit(orgId, userId, 'update', id, ctx);
    return { ok: true };
  }

  async deleteEntry(
    orgId: string,
    userId: string,
    userRole: string,
    id: string,
    ctx?: AuditContext,
  ) {
    const auth = await this.userCanRead(orgId, userId, userRole, id);
    if (!auth.ok) throw new NotFoundException('Eintrag nicht gefunden');
    if (!(auth.isOwner || userRole === 'owner' || userRole === 'admin' || auth.permission === 'manage')) {
      throw new ForbiddenException('Nur Ersteller / Manager / Admin kann loeschen');
    }
    await this.prisma.passwordEntry.delete({ where: { id } });
    await this.recordAudit(orgId, userId, 'delete', id, ctx);
    return { ok: true };
  }

  /**
   * Passwort anzeigen. Wird als kritische Aktion vollstaendig im Audit-Log erfasst.
   * lastUsedAt wird aktualisiert damit Health-Dashboard "Never used" erkennt.
   */
  async revealPassword(
    orgId: string,
    userId: string,
    userRole: string,
    id: string,
    ctx?: AuditContext,
  ): Promise<{ password: string; totpSeed: string | null; notes: string | null }> {
    // Rate-Limit: max 20 Reveals pro User pro Minute (schuetzt gegen versehentliche
    // Skripte / kompromittierte Sessions). Audit sieht trotzdem alles.
    const rl = this.revealLimiter.hit(`reveal:${userId}`, 20, 60_000);
    if (!rl.allowed) {
      await this.recordAudit(orgId, userId, 'reveal_rate_limited', id, ctx);
      throw new BadRequestException(
        `Zu viele Passwort-Anfragen. Bitte ${Math.ceil(rl.retryAfterMs / 1000)}s warten.`,
      );
    }
    const auth = await this.userCanRead(orgId, userId, userRole, id);
    if (!auth.ok) throw new NotFoundException('Eintrag nicht gefunden');
    const entry = auth.entry;

    const password = decryptSecret(entry.passwordEncrypted, this.secret);
    if (password === null) {
      this.logger.error(`Failed to decrypt entry ${id}`);
      throw new BadRequestException('Entschluesselung fehlgeschlagen');
    }
    const totpSeed = entry.totpSeedEncrypted
      ? decryptSecret(entry.totpSeedEncrypted, this.secret)
      : null;
    const notes = entry.notesEncrypted
      ? decryptSecret(entry.notesEncrypted, this.secret)
      : null;

    // fire-and-forget: last_used_at + Audit
    this.prisma.passwordEntry
      .update({ where: { id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    this.recordAudit(orgId, userId, 'reveal', id, ctx);

    return { password, totpSeed, notes };
  }

  // ------------------------------------------------------------
  // Access-Management
  // ------------------------------------------------------------

  async setAccess(
    orgId: string,
    userId: string,
    userRole: string,
    entryId: string,
    userIds: string[],
    ctx?: AuditContext,
  ) {
    const auth = await this.userCanRead(orgId, userId, userRole, entryId);
    if (!auth.ok) throw new NotFoundException('Eintrag nicht gefunden');
    if (!(auth.isOwner || userRole === 'owner' || userRole === 'admin')) {
      throw new ForbiddenException('Nur Ersteller / Admin darf freigeben');
    }
    const targets = Array.from(new Set(userIds)).filter((id) => id !== auth.entry.createdById);

    // Validate: alle User gehoeren zur selben Org
    const users = await this.prisma.user.findMany({
      where: { id: { in: targets }, orgId },
      select: { id: true },
    });
    const validIds = new Set(users.map((u) => u.id));
    const validTargets = targets.filter((id) => validIds.has(id));

    // Aktuelle Access-Zuweisungen laden
    const current = await this.prisma.passwordAccess.findMany({
      where: { entryId },
      select: { userId: true },
    });
    const currentSet = new Set(current.map((c) => c.userId));
    const targetSet = new Set(validTargets);

    const toAdd = validTargets.filter((id) => !currentSet.has(id));
    const toRemove = current.filter((c) => !targetSet.has(c.userId)).map((c) => c.userId);

    if (toAdd.length) {
      await this.prisma.passwordAccess.createMany({
        data: toAdd.map((uid) => ({
          entryId,
          userId: uid,
          permission: 'view',
          grantedById: userId,
        })),
        skipDuplicates: true,
      });
    }
    if (toRemove.length) {
      await this.prisma.passwordAccess.deleteMany({
        where: { entryId, userId: { in: toRemove } },
      });
    }

    await this.recordAudit(orgId, userId, 'access_change', entryId, ctx);
    return { added: toAdd.length, removed: toRemove.length };
  }

  // ------------------------------------------------------------
  // Audit-Log
  // ------------------------------------------------------------

  async listAudit(orgId: string, filter?: { entryId?: string; userId?: string; limit?: number }) {
    return this.prisma.passwordAuditLog.findMany({
      where: {
        orgId,
        entryId: filter?.entryId,
        userId: filter?.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, filter?.limit ?? 100),
      include: {
        user: { select: { id: true, name: true, email: true } },
        entry: { select: { id: true, title: true } },
      },
    });
  }

  // ------------------------------------------------------------
  // Team-Liste fuer Sharing-UI
  // ------------------------------------------------------------

  /**
   * Nicht-sensitive User-Liste (nur id, name, email, avatar, role) fuer
   * Sharing-Multi-Select. Bewusst hier statt via AdminService, weil der auf
   * eine hardcodierte DEV_ORG_ID setzt.
   */
  async listOrgUsers(orgId: string, excludeUserId?: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
    return users;
  }

  /**
   * Bulk-Freigabe: teilt mehrere Passwoerter mit einer Liste von Usern (Additiv, per Diff).
   * Nur der Ersteller oder org-Admin darf.
   */
  async bulkGrantAccess(
    orgId: string,
    userId: string,
    userRole: string,
    entryIds: string[],
    targetUserIds: string[],
    ctx?: AuditContext,
  ) {
    if (!entryIds?.length || !targetUserIds?.length) {
      throw new BadRequestException('entryIds und targetUserIds erforderlich');
    }
    // Alle betroffenen Entries laden + Zugriff pruefen
    const entries = await this.prisma.passwordEntry.findMany({
      where: { orgId, id: { in: entryIds } },
      select: { id: true, createdById: true },
    });
    const isAdmin = userRole === 'owner' || userRole === 'admin';
    const permittedIds = entries
      .filter((e) => isAdmin || e.createdById === userId)
      .map((e) => e.id);
    if (permittedIds.length === 0) {
      throw new ForbiddenException('Keine Rechte fuer die gewaehlten Eintraege');
    }
    // targetUserIds validieren (nur User derselben Org)
    const validTargets = await this.prisma.user.findMany({
      where: { orgId, id: { in: targetUserIds } },
      select: { id: true },
    });
    const validIds = validTargets.map((u) => u.id);
    if (validIds.length === 0) {
      throw new BadRequestException('Keine gueltigen Ziel-User');
    }
    // Diff pro Entry ermitteln + createMany mit skipDuplicates
    const rows: Array<{
      entryId: string;
      userId: string;
      permission: string;
      grantedById: string;
    }> = [];
    for (const entryId of permittedIds) {
      for (const uid of validIds) {
        // Owner-User nicht doppelt eintragen (er hat implizit Zugriff)
        const owner = entries.find((e) => e.id === entryId)?.createdById;
        if (uid === owner) continue;
        rows.push({ entryId, userId: uid, permission: 'view', grantedById: userId });
      }
    }
    const created = await this.prisma.passwordAccess.createMany({
      data: rows,
      skipDuplicates: true,
    });
    // Audit pro entry
    for (const entryId of permittedIds) {
      await this.recordAudit(orgId, userId, 'access_bulk_grant', entryId, ctx);
    }
    return { granted: created.count, entries: permittedIds.length, users: validIds.length };
  }

  /**
   * Bulk-Revoke: entzieht einem User Zugriff auf ausgewaehlte Eintraege
   * (oder alle wenn entryIds leer). Fuer Ausscheidens-Szenario.
   */
  async bulkRevokeAccess(
    orgId: string,
    userId: string,
    userRole: string,
    targetUserId: string,
    entryIds?: string[],
    ctx?: AuditContext,
  ) {
    const isAdmin = userRole === 'owner' || userRole === 'admin';
    if (!isAdmin) throw new ForbiddenException('Nur Admin darf Bulk-Revoke');
    const where: any = { userId: targetUserId, entry: { orgId } };
    if (entryIds?.length) where.entryId = { in: entryIds };
    const result = await this.prisma.passwordAccess.deleteMany({ where });
    await this.recordAudit(orgId, userId, 'access_bulk_revoke', null, ctx);
    return { removed: result.count };
  }

  // ------------------------------------------------------------
  // Health-Dashboard
  // ------------------------------------------------------------

  async health(orgId: string, userId: string, userRole: string) {
    const entries = await this.listEntries(orgId, userId, userRole);

    const now = Date.now();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const weak = entries.filter((e) => (e.passwordStrength ?? 0) < 60);
    const old = entries.filter(
      (e) => now - new Date(e.passwordUpdatedAt).getTime() > oneYear,
    );
    const never = entries.filter((e) => !e.lastUsedAt);
    return {
      total: entries.length,
      weak: weak.length,
      old: old.length,
      neverUsed: never.length,
      averageStrength: entries.length
        ? Math.round(
            entries.reduce((s, e) => s + (e.passwordStrength ?? 0), 0) / entries.length,
          )
        : 0,
    };
  }
}
