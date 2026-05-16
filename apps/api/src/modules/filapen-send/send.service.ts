import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

/**
 * Filapen Send: Datei-Sharing zwischen Team-Mitgliedern der gleichen Org.
 *
 * Architektur:
 *  - 1 Transfer = 1 Sender + N Empfaenger + N Dateien
 *  - Dateien liegen in R2 (Cloudflare)
 *  - Empfaenger sehen Transfers in ihrer Inbox, Sender in seiner Outbox
 *  - Default-Expiry: 30 Tage (kann ueber Env-Var ueberschrieben werden)
 *
 * Endpoints im Controller — Upload geht via Multipart POST mit Files +
 * recipientIds + filePaths.
 */

const DEFAULT_EXPIRY_DAYS = 30;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB pro Datei

@Injectable()
export class FilapenSendService {
  private readonly logger = new Logger(FilapenSendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ----------------------------------------------------------------------
  // CREATE — Transfer mit Dateien anlegen
  // ----------------------------------------------------------------------
  async create(
    orgId: string,
    senderId: string,
    data: {
      recipientIds: string[];
      message?: string;
      files: Array<{ originalname: string; buffer: Buffer; size: number; mimetype?: string }>;
      filePaths?: string[]; // optional relative Pfade aus webkitdirectory
    },
  ) {
    if (!data.recipientIds?.length) throw new BadRequestException('Mindestens ein Empfaenger erforderlich');
    if (!data.files?.length) throw new BadRequestException('Mindestens eine Datei erforderlich');

    // Empfaenger pruefen — alle muessen aus derselben Org sein
    const recipients = await this.prisma.user.findMany({
      where: { id: { in: data.recipientIds }, orgId },
      select: { id: true, email: true, name: true },
    });
    if (recipients.length !== data.recipientIds.length) {
      throw new BadRequestException('Mindestens ein Empfaenger ist nicht in deiner Organisation');
    }
    if (recipients.some((r) => r.id === senderId)) {
      throw new BadRequestException('Du kannst dir selbst nichts senden');
    }

    // Datei-Limits pruefen
    for (const f of data.files) {
      if (!f.buffer || f.buffer.length === 0) throw new BadRequestException(`Datei "${f.originalname}" ist leer`);
      if (f.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`Datei "${f.originalname}" ist zu gross (${Math.round(f.size / 1024 / 1024)} MB, max 500 MB)`);
      }
    }

    // Transfer-Record anlegen
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const transfer = await this.prisma.fileTransfer.create({
      data: {
        orgId,
        senderId,
        message: data.message?.trim() || null,
        expiresAt,
        recipients: {
          create: data.recipientIds.map((rid) => ({ recipientId: rid })),
        },
      },
    });

    // Dateien zu R2 hochladen — sequenziell um Speicher zu sparen
    const items: any[] = [];
    for (let i = 0; i < data.files.length; i++) {
      const f = data.files[i];
      const path = data.filePaths?.[i] || null;
      const cleanName = (f.originalname || 'file').replace(/[^\w.\-]/g, '_');
      const key = `send/${orgId}/${transfer.id}/${i}-${cleanName}`;
      try {
        const url = await this.storage.upload(key, f.buffer, f.mimetype || 'application/octet-stream');
        const item = await this.prisma.fileTransferItem.create({
          data: {
            transferId: transfer.id,
            fileName: cleanName,
            filePath: path,
            mimeType: f.mimetype || null,
            fileSize: BigInt(f.size),
            storageKey: key,
            fileUrl: url,
          },
        });
        items.push({ ...item, fileSize: Number(item.fileSize) });
      } catch (err: any) {
        this.logger.error(`Upload fuer "${cleanName}" fehlgeschlagen: ${err.message}`);
        // Rollback: Transfer + bisher hochgeladene Dateien aufraeumen
        await this.prisma.fileTransfer.delete({ where: { id: transfer.id } }).catch(() => {});
        throw new BadRequestException(`Upload fuer "${cleanName}" fehlgeschlagen: ${err.message}`);
      }
    }

    return {
      ...transfer,
      items,
      recipientCount: recipients.length,
      totalSize: data.files.reduce((s, f) => s + f.size, 0),
    };
  }

  // ----------------------------------------------------------------------
  // LIST — Inbox (empfangen) + Outbox (gesendet)
  // ----------------------------------------------------------------------
  async inbox(orgId: string, userId: string) {
    const rows = await this.prisma.fileTransferRecipient.findMany({
      where: {
        recipientId: userId,
        deletedByRecipientAt: null,
        transfer: { orgId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        transfer: {
          include: {
            sender: { select: { id: true, name: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
            items: true,
            recipients: { select: { recipientId: true } },
          },
        },
      },
    });
    return rows.map((r) => this.serializeRow(r));
  }

  async outbox(orgId: string, userId: string) {
    const transfers = await this.prisma.fileTransfer.findMany({
      where: { orgId, senderId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        recipients: {
          include: {
            recipient: { select: { id: true, name: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    return transfers.map((t) => ({
      ...t,
      items: t.items.map((it) => ({ ...it, fileSize: Number(it.fileSize) })),
      totalSize: t.items.reduce((s, it) => s + Number(it.fileSize), 0),
      recipients: t.recipients.map((rr) => ({
        recipientId: rr.recipientId,
        user: rr.recipient,
        receivedAt: rr.receivedAt,
      })),
    }));
  }

  private serializeRow(row: any) {
    return {
      id: row.transfer.id,
      message: row.transfer.message,
      senderId: row.transfer.senderId,
      sender: row.transfer.sender,
      createdAt: row.transfer.createdAt,
      expiresAt: row.transfer.expiresAt,
      receivedAt: row.receivedAt,
      receiverRowId: row.id,
      items: row.transfer.items.map((it: any) => ({ ...it, fileSize: Number(it.fileSize) })),
      totalSize: row.transfer.items.reduce((s: number, it: any) => s + Number(it.fileSize), 0),
      recipientCount: row.transfer.recipients.length,
    };
  }

  // ----------------------------------------------------------------------
  // DOWNLOAD — Single File
  // ----------------------------------------------------------------------
  async getItemForDownload(orgId: string, userId: string, itemId: string) {
    const item = await this.prisma.fileTransferItem.findUnique({
      where: { id: itemId },
      include: {
        transfer: { include: { recipients: { select: { recipientId: true } } } },
      },
    });
    if (!item || item.transfer.orgId !== orgId) throw new NotFoundException('Datei nicht gefunden');

    // Auth: Sender ODER eingeladener Empfaenger duerfen runterladen
    const isSender = item.transfer.senderId === userId;
    const isRecipient = item.transfer.recipients.some((r) => r.recipientId === userId);
    if (!isSender && !isRecipient) throw new ForbiddenException('Kein Zugriff');

    const obj = await this.storage.getObject(item.storageKey);
    return {
      stream: obj.body,
      fileName: item.fileName,
      mimeType: item.mimeType || obj.contentType || 'application/octet-stream',
      contentLength: obj.contentLength ?? Number(item.fileSize),
    };
  }

  // ----------------------------------------------------------------------
  // MARK RECEIVED — Empfaenger markiert als abgeholt
  // ----------------------------------------------------------------------
  async markReceived(orgId: string, userId: string, transferId: string) {
    const row = await this.prisma.fileTransferRecipient.findFirst({
      where: { transferId, recipientId: userId, transfer: { orgId } },
    });
    if (!row) throw new NotFoundException('Transfer nicht gefunden');
    if (!row.receivedAt) {
      await this.prisma.fileTransferRecipient.update({
        where: { id: row.id },
        data: { receivedAt: new Date() },
      });
      await this.cleanupIfAllReceived(transferId);
    }
    return { ok: true };
  }

  /**
   * Wird nach jedem erfolgreichen Download des Empfaengers aufgerufen
   * (via res.on('finish') im Controller).
   *
   * - markiert receivedAt fuer diesen Empfaenger, falls noch nicht gesetzt
   * - prueft ob ALLE Empfaenger abgeholt haben → wenn ja: R2-Files + Transfer
   *   loeschen ("Wenn alle es heruntergeladen haben, ist es weg")
   */
  async onItemDownloaded(orgId: string, userId: string, itemId: string) {
    const item = await this.prisma.fileTransferItem.findUnique({
      where: { id: itemId },
      select: { transferId: true, transfer: { select: { orgId: true } } },
    });
    if (!item || item.transfer.orgId !== orgId) return;

    const row = await this.prisma.fileTransferRecipient.findFirst({
      where: { transferId: item.transferId, recipientId: userId },
    });
    if (!row) return;
    if (!row.receivedAt) {
      await this.prisma.fileTransferRecipient.update({
        where: { id: row.id },
        data: { receivedAt: new Date() },
      });
    }
    await this.cleanupIfAllReceived(item.transferId);
  }

  /**
   * Prueft ob alle Empfaenger eines Transfers receivedAt haben. Wenn ja:
   * R2-Files loeschen + DB-Record entfernen. Sicher gegen Race-Conditions
   * weil findFirst-then-delete atomisch genug fuer unseren Use-Case ist.
   */
  private async cleanupIfAllReceived(transferId: string): Promise<void> {
    const transfer = await this.prisma.fileTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: { select: { id: true, storageKey: true } },
        recipients: { select: { receivedAt: true } },
      },
    });
    if (!transfer) return;
    const allReceived = transfer.recipients.length > 0 && transfer.recipients.every((r) => !!r.receivedAt);
    if (!allReceived) return;
    // Cleanup R2-Files — best-effort, DB-Delete folgt unabhaengig
    for (const item of transfer.items) {
      await this.storage.delete(item.storageKey).catch((err) => {
        this.logger.warn(`R2-Cleanup fuer ${item.storageKey} fehlgeschlagen: ${err.message}`);
      });
    }
    // DB-Cascade loescht Items + Recipients automatisch
    await this.prisma.fileTransfer.delete({ where: { id: transferId } }).catch(() => {});
    this.logger.log(`Transfer ${transferId} bereinigt — alle Empfaenger haben heruntergeladen`);
  }

  // ----------------------------------------------------------------------
  // DELETE — Sender kann widerrufen, Empfaenger kann aus Inbox entfernen
  // ----------------------------------------------------------------------
  async revoke(orgId: string, userId: string, transferId: string) {
    const t = await this.prisma.fileTransfer.findFirst({
      where: { id: transferId, orgId, senderId: userId },
      include: { items: true },
    });
    if (!t) throw new NotFoundException('Transfer nicht gefunden oder kein Zugriff');
    // R2-Dateien aufraeumen
    for (const item of t.items) {
      await this.storage.delete(item.storageKey).catch(() => {});
    }
    await this.prisma.fileTransfer.delete({ where: { id: transferId } });
    return { ok: true };
  }

  async hideFromInbox(orgId: string, userId: string, transferId: string) {
    const row = await this.prisma.fileTransferRecipient.findFirst({
      where: { transferId, recipientId: userId, transfer: { orgId } },
    });
    if (!row) throw new NotFoundException('Transfer nicht gefunden');
    await this.prisma.fileTransferRecipient.update({
      where: { id: row.id },
      data: { deletedByRecipientAt: new Date() },
    });
    return { ok: true };
  }
}
