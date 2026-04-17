import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // =========================================================================
  // FOLDERS
  // =========================================================================

  async listFolders(parentId: string | null, userId: string) {
    const folders = await this.prisma.docFolder.findMany({
      where: { orgId: DEV_ORG_ID, parentId: parentId || null, trashedAt: null },
      include: {
        _count: { select: { children: true, files: true } },
        permissions: { where: { userId } },
      },
      orderBy: { name: 'asc' },
    });

    return folders.map((f) => ({
      ...f,
      childCount: f._count.children,
      fileCount: f._count.files,
      _count: undefined,
      userPermission: f.permissions[0] || null,
      permissions: undefined,
    }));
  }

  async createFolder(data: { name: string; parentId?: string; color?: string; description?: string }, userId: string) {
    return this.prisma.docFolder.create({
      data: {
        orgId: DEV_ORG_ID,
        name: data.name.trim(),
        parentId: data.parentId || null,
        color: data.color || null,
        description: data.description || null,
        createdBy: userId,
      },
    });
  }

  async updateFolder(id: string, data: { name?: string; color?: string; description?: string }) {
    return this.prisma.docFolder.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  async lockFolder(folderId: string, adminId: string) {
    return this.prisma.docFolder.update({
      where: { id: folderId },
      data: { locked: true, lockedBy: adminId },
    });
  }

  async unlockFolder(folderId: string) {
    return this.prisma.docFolder.update({
      where: { id: folderId },
      data: { locked: false, lockedBy: null },
    });
  }

  async trashFolder(folderId: string) {
    return this.prisma.docFolder.update({
      where: { id: folderId },
      data: { trashedAt: new Date() },
    });
  }

  async restoreFolder(folderId: string) {
    return this.prisma.docFolder.update({
      where: { id: folderId },
      data: { trashedAt: null },
    });
  }

  async deleteFolder(folderId: string) {
    await this.prisma.docFolder.delete({ where: { id: folderId } });
    return { deleted: true };
  }

  // =========================================================================
  // FILES
  // =========================================================================

  async listFiles(folderId: string | null, userId: string, filters?: { search?: string; fileType?: string; status?: string; tags?: string[] }) {
    // Check if the folder is locked and user has no access
    if (folderId) {
      const accessDenied = await this.isFolderLockedForUser(folderId, userId);
      if (accessDenied) return [];
    }

    const where: any = { orgId: DEV_ORG_ID, trashedAt: null };
    if (folderId) where.folderId = folderId;
    else where.folderId = null; // root files
    if (filters?.search) where.fileName = { contains: filters.search, mode: 'insensitive' };
    if (filters?.fileType) where.fileType = filters.fileType;
    if (filters?.status) where.status = filters.status;
    if (filters?.tags?.length) where.tags = { hasEvery: filters.tags };

    const files = await this.prisma.docFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Enrich with creator names
    const userIds = [...new Set(files.map((f) => f.createdBy))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name || u.email.split('@')[0]]));

    return files.map((f) => ({
      ...f,
      fileSize: f.fileSize ? Number(f.fileSize) : null,
      createdByName: userMap.get(f.createdBy) || 'Unbekannt',
    }));
  }

  async uploadFile(folderId: string | null, file: Express.Multer.File, userId: string, tags: string[] = []) {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `docs/${folderId || 'root'}/${timestamp}-${safeName}`;

    const fileUrl = await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const created = await this.prisma.docFile.create({
      data: {
        orgId: DEV_ORG_ID,
        folderId: folderId || null,
        fileName: file.originalname,
        fileUrl,
        storageKey,
        fileSize: file.size,
        fileType: this.detectFileType(file.mimetype, file.originalname),
        mimeType: file.mimetype,
        createdBy: userId,
        tags,
        status: 'draft',
      },
    });

    // Create first version
    await this.prisma.docFileVersion.create({
      data: {
        fileId: created.id,
        versionNum: 1,
        fileName: file.originalname,
        fileUrl,
        storageKey,
        fileSize: file.size,
        createdBy: userId,
      },
    });

    await this.logActivity(userId, 'uploaded', `Datei "${file.originalname}" hochgeladen`, folderId, created.id);

    return created;
  }

  async updateFile(id: string, data: { fileName?: string; status?: string; tags?: string[]; metadata?: any }) {
    return this.prisma.docFile.update({
      where: { id },
      data: {
        ...(data.fileName && { fileName: data.fileName.trim() }),
        ...(data.status && { status: data.status }),
        ...(data.tags && { tags: data.tags }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
    });
  }

  async moveFile(fileId: string, targetFolderId: string | null) {
    return this.prisma.docFile.update({
      where: { id: fileId },
      data: { folderId: targetFolderId },
    });
  }

  async trashFile(fileId: string) {
    return this.prisma.docFile.update({
      where: { id: fileId },
      data: { trashedAt: new Date() },
    });
  }

  async restoreFile(fileId: string) {
    return this.prisma.docFile.update({
      where: { id: fileId },
      data: { trashedAt: null },
    });
  }

  async deleteFile(fileId: string) {
    const file = await this.prisma.docFile.findUnique({ where: { id: fileId } });
    if (file?.storageKey) {
      try { await this.storage.delete(file.storageKey); } catch { /* ignore */ }
    }
    await this.prisma.docFile.delete({ where: { id: fileId } });
    return { deleted: true };
  }

  async getFileVersions(fileId: string) {
    return this.prisma.docFileVersion.findMany({
      where: { fileId },
      orderBy: { versionNum: 'desc' },
    });
  }

  // =========================================================================
  // PERMISSIONS (Admin only)
  // =========================================================================

  async setFolderPermission(folderId: string, userId: string, perms: { canRead: boolean; canUpload: boolean; canEdit: boolean; canDelete: boolean }) {
    return this.prisma.docPermission.upsert({
      where: { folderId_userId: { folderId, userId } },
      create: { folderId, userId, ...perms },
      update: perms,
    });
  }

  async removeFolderPermission(folderId: string, userId: string) {
    await this.prisma.docPermission.deleteMany({ where: { folderId, userId } });
    return { removed: true };
  }

  async getFolderPermissions(folderId: string) {
    const perms = await this.prisma.docPermission.findMany({
      where: { folderId },
    });
    const userIds = perms.map((p) => p.userId);
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name || u.email.split('@')[0]]));
    return perms.map((p) => ({ ...p, userName: userMap.get(p.userId) || 'Unbekannt' }));
  }

  // =========================================================================
  // FAVORITES
  // =========================================================================

  async toggleFavorite(userId: string, folderId?: string, fileId?: string) {
    if (folderId) {
      const existing = await this.prisma.docFavorite.findFirst({ where: { userId, folderId } });
      if (existing) {
        await this.prisma.docFavorite.delete({ where: { id: existing.id } });
        return { favorited: false };
      }
      await this.prisma.docFavorite.create({ data: { userId, folderId } });
      return { favorited: true };
    }
    if (fileId) {
      const existing = await this.prisma.docFavorite.findFirst({ where: { userId, fileId } });
      if (existing) {
        await this.prisma.docFavorite.delete({ where: { id: existing.id } });
        return { favorited: false };
      }
      await this.prisma.docFavorite.create({ data: { userId, fileId } });
      return { favorited: true };
    }
    throw new BadRequestException('folderId oder fileId erforderlich');
  }

  async getFavorites(userId: string) {
    return this.prisma.docFavorite.findMany({
      where: { userId },
      include: {
        folder: { select: { id: true, name: true, color: true } },
        file: { select: { id: true, fileName: true, fileType: true, fileUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // =========================================================================
  // ACTIVITY LOG
  // =========================================================================

  async getActivities(folderId?: string, limit = 50) {
    const where: any = { orgId: DEV_ORG_ID };
    if (folderId) where.folderId = folderId;
    return this.prisma.docActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // =========================================================================
  // TRASH
  // =========================================================================

  async getTrash() {
    const [folders, files] = await Promise.all([
      this.prisma.docFolder.findMany({
        where: { orgId: DEV_ORG_ID, trashedAt: { not: null } },
        orderBy: { trashedAt: 'desc' },
      }),
      this.prisma.docFile.findMany({
        where: { orgId: DEV_ORG_ID, trashedAt: { not: null } },
        orderBy: { trashedAt: 'desc' },
      }),
    ]);
    return { folders, files: files.map((f) => ({ ...f, fileSize: f.fileSize ? Number(f.fileSize) : null })) };
  }

  // =========================================================================
  // SEARCH
  // =========================================================================

  async search(query: string) {
    const [folders, files] = await Promise.all([
      this.prisma.docFolder.findMany({
        where: {
          orgId: DEV_ORG_ID,
          trashedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        },
        take: 20,
      }),
      this.prisma.docFile.findMany({
        where: {
          orgId: DEV_ORG_ID,
          trashedAt: null,
          OR: [
            { fileName: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        },
        take: 30,
      }),
    ]);
    return { folders, files: files.map((f) => ({ ...f, fileSize: f.fileSize ? Number(f.fileSize) : null })) };
  }

  // =========================================================================
  // LOCK CHECK

  /**
   * Returns true if the folder is locked AND the user is NOT an admin
   * AND has no explicit permission. Admins always have access.
   */
  async isFolderLockedForUser(folderId: string, userId: string): Promise<boolean> {
    const folder = await this.prisma.docFolder.findUnique({
      where: { id: folderId },
      select: { locked: true, createdBy: true },
    });
    if (!folder || !folder.locked) return false;

    // Creator always has access
    if (folder.createdBy === userId) return false;

    // Check if user is admin/owner
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'admin' || user?.role === 'owner') return false;

    // Check explicit permission
    const perm = await this.prisma.docPermission.findFirst({
      where: { folderId, userId, canRead: true },
    });
    return !perm; // locked = true if no permission found
  }

  // HELPERS
  // =========================================================================

  private detectFileType(mime: string, name: string): string {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (mime.includes('spreadsheet') || name.match(/\.(xlsx?|csv)$/i)) return 'spreadsheet';
    if (mime.includes('document') || mime.includes('msword') || name.match(/\.(docx?|odt)$/i)) return 'document';
    if (mime.includes('presentation') || name.match(/\.(pptx?|odp)$/i)) return 'presentation';
    if (mime.includes('zip') || mime.includes('compress') || name.match(/\.(zip|rar|7z|tar|gz)$/i)) return 'archive';
    return 'other';
  }

  private async logActivity(userId: string, action: string, details: string, folderId?: string | null, fileId?: string | null) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      await this.prisma.docActivity.create({
        data: {
          orgId: DEV_ORG_ID,
          folderId: folderId || null,
          fileId: fileId || null,
          userId,
          userName: user?.name || user?.email?.split('@')[0] || 'Unbekannt',
          action,
          details,
        },
      });
    } catch { /* ignore */ }
  }
}
