import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';
const TOKEN_BYTES = 16; // 16 bytes → 22 url-safe chars

@Injectable()
export class DocShareService {
  private readonly logger = new Logger(DocShareService.name);
  private readonly appBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    // APP_URL can be comma-separated for CORS; use the first entry for share URLs.
    this.appBaseUrl = raw.split(',')[0].trim().replace(/\/$/, '');
  }

  // -------------------------------------------------------------------------
  // Hub-API
  // -------------------------------------------------------------------------

  async createLink(folderId: string, userId: string, durationDays: number | null) {
    const folder = await this.prisma.docFolder.findFirst({
      where: { id: folderId, orgId: DEV_ORG_ID, trashedAt: null },
    });
    if (!folder) throw new NotFoundException('Ordner nicht gefunden');

    if (durationDays !== null && (durationDays < 0 || durationDays > 3650)) {
      throw new BadRequestException('Dauer ungueltig');
    }

    const token = this.generateToken();
    const expiresAt = durationDays === null ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const link = await this.prisma.docShareLink.create({
      data: {
        orgId: DEV_ORG_ID,
        folderId,
        token,
        createdById: userId,
        expiresAt,
      },
    });

    return this.toListItem(link);
  }

  async listLinksForFolder(folderId: string) {
    const links = await this.prisma.docShareLink.findMany({
      where: { orgId: DEV_ORG_ID, folderId },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((l) => this.toListItem(l));
  }

  async revokeLink(linkId: string) {
    const link = await this.prisma.docShareLink.findFirst({
      where: { id: linkId, orgId: DEV_ORG_ID },
    });
    if (!link) throw new NotFoundException('Link nicht gefunden');
    if (link.revokedAt) return this.toListItem(link);
    const updated = await this.prisma.docShareLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() },
    });
    return this.toListItem(updated);
  }

  // -------------------------------------------------------------------------
  // Public-API
  // -------------------------------------------------------------------------

  /**
   * Loest Token in einen Folder-Tree auf. Wirft je nach Zustand:
   *  - NotFoundException wenn Token unbekannt oder Ordner geloescht
   *  - ForbiddenException mit code='revoked' oder 'expired'
   */
  async resolveByToken(token: string) {
    const link = await this.prisma.docShareLink.findUnique({
      where: { token },
    });
    if (!link) throw new NotFoundException('Link unbekannt');
    if (link.revokedAt) throw new ForbiddenException({ code: 'revoked', message: 'Link wurde widerrufen' });
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new ForbiddenException({ code: 'expired', message: 'Link ist abgelaufen' });
    }

    const folder = await this.prisma.docFolder.findFirst({
      where: { id: link.folderId, trashedAt: null },
    });
    if (!folder) throw new NotFoundException('Ordner nicht mehr verfuegbar');

    // View-Counter (best-effort, kein await blocking)
    this.prisma.docShareLink
      .update({ where: { id: link.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } })
      .catch(() => {});

    const tree = await this.buildFolderTree(folder.id);
    return {
      shareInfo: {
        folderName: folder.name,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
      },
      tree,
    };
  }

  async getFileForToken(token: string, fileId: string) {
    const link = await this.prisma.docShareLink.findUnique({ where: { token } });
    if (!link) throw new NotFoundException('Link unbekannt');
    if (link.revokedAt) throw new ForbiddenException('Link wurde widerrufen');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new ForbiddenException('Link ist abgelaufen');
    }

    // Pruefen ob File im Folder-Tree des Links liegt
    const folderIds = await this.collectFolderIds(link.folderId);
    const file = await this.prisma.docFile.findFirst({
      where: { id: fileId, orgId: link.orgId, trashedAt: null, folderId: { in: folderIds } },
    });
    if (!file) throw new NotFoundException('Datei nicht gefunden');
    return file;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  private buildShareUrl(token: string): string {
    return `${this.appBaseUrl}/share/docs/${token}`;
  }

  private toListItem(link: {
    id: string;
    token: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
    viewCount: number;
    lastViewedAt: Date | null;
    createdAt: Date;
    createdById: string;
  }) {
    return {
      id: link.id,
      token: link.token,
      url: this.buildShareUrl(link.token),
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      viewCount: link.viewCount,
      lastViewedAt: link.lastViewedAt,
      createdAt: link.createdAt,
      createdById: link.createdById,
      isActive: !link.revokedAt && (!link.expiresAt || link.expiresAt > new Date()),
    };
  }

  // Recursive: liefert nested Tree (sub-folders + files) ab folderId
  private async buildFolderTree(rootId: string): Promise<any> {
    const root = await this.prisma.docFolder.findFirst({
      where: { id: rootId, trashedAt: null },
    });
    if (!root) return null;

    const subFolders = await this.prisma.docFolder.findMany({
      where: { parentId: rootId, trashedAt: null },
      orderBy: { name: 'asc' },
    });
    const files = await this.prisma.docFile.findMany({
      where: { folderId: rootId, trashedAt: null },
      orderBy: { fileName: 'asc' },
      select: {
        id: true, fileName: true, fileSize: true, fileType: true, mimeType: true,
        createdAt: true,
      },
    });

    const children = await Promise.all(subFolders.map((f) => this.buildFolderTree(f.id)));

    return {
      id: root.id,
      name: root.name,
      color: root.color,
      description: root.description,
      files: files.map((f) => ({
        id: f.id,
        name: f.fileName,
        size: f.fileSize ? Number(f.fileSize) : null,
        type: f.fileType,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
      })),
      folders: children.filter(Boolean),
    };
  }

  private async collectFolderIds(rootId: string): Promise<string[]> {
    const ids: string[] = [rootId];
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const next = queue.shift()!;
      const children = await this.prisma.docFolder.findMany({
        where: { parentId: next, trashedAt: null },
        select: { id: true },
      });
      for (const c of children) {
        ids.push(c.id);
        queue.push(c.id);
      }
    }
    return ids;
  }
}
