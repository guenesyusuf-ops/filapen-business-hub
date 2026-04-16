import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ONLINE_WINDOW_MINUTES = 5;

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Presence
  // -------------------------------------------------------------------------

  /** Heartbeat — updates lastActiveAt for the calling user. */
  async heartbeat(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
    return { ok: true };
  }

  /** List all team members with their online status (active within 5 min). */
  async listPresence(currentUserId: string) {
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);

    const users = await this.prisma.user.findMany({
      where: {
        status: 'active',
        id: { not: currentUserId }, // exclude self
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
        lastActiveAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    // Unread DM counts per sender
    const unread = await this.prisma.directMessage.groupBy({
      by: ['senderId'],
      where: { recipientId: currentUserId, readAt: null },
      _count: { _all: true },
    });
    const unreadMap = new Map(unread.map((u) => [u.senderId, u._count._all]));

    return users.map((u) => ({
      id: u.id,
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0],
      firstName: u.firstName,
      email: u.email,
      avatarUrl: u.avatarUrl,
      role: u.role,
      online: u.lastActiveAt ? u.lastActiveAt > cutoff : false,
      lastActiveAt: u.lastActiveAt,
      unread: unreadMap.get(u.id) ?? 0,
    }));
  }

  // -------------------------------------------------------------------------
  // Direct Messages
  // -------------------------------------------------------------------------

  /** Conversation between current user and the given partner. Oldest first. */
  async listMessages(currentUserId: string, partnerId: string) {
    if (currentUserId === partnerId) {
      throw new BadRequestException('Du kannst nicht mit dir selbst chatten');
    }

    const messages = await this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUserId, recipientId: partnerId },
          { senderId: partnerId, recipientId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return messages;
  }

  async sendMessage(currentUserId: string, partnerId: string, content: string) {
    if (!content.trim()) {
      throw new BadRequestException('Nachricht darf nicht leer sein');
    }
    if (currentUserId === partnerId) {
      throw new BadRequestException('Du kannst nicht dir selbst schreiben');
    }

    const partner = await this.prisma.user.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Empfaenger nicht gefunden');

    return this.prisma.directMessage.create({
      data: {
        senderId: currentUserId,
        recipientId: partnerId,
        content: content.trim(),
      },
    });
  }

  async markConversationRead(currentUserId: string, partnerId: string) {
    await this.prisma.directMessage.updateMany({
      where: {
        senderId: partnerId,
        recipientId: currentUserId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async unreadCount(currentUserId: string) {
    const count = await this.prisma.directMessage.count({
      where: { recipientId: currentUserId, readAt: null },
    });
    return { count };
  }

  // -------------------------------------------------------------------------
  // Personal Notes
  // -------------------------------------------------------------------------

  async listNotes(userId: string) {
    return this.prisma.personalNote.findMany({
      where: { userId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createNote(userId: string, data: { content: string; color?: string }) {
    return this.prisma.personalNote.create({
      data: {
        userId,
        content: data.content,
        color: data.color || null,
        pinned: false,
      },
    });
  }

  async updateNote(
    userId: string,
    id: string,
    data: { content?: string; pinned?: boolean; color?: string | null },
  ) {
    // Ensure ownership
    const existing = await this.prisma.personalNote.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Notiz nicht gefunden');

    return this.prisma.personalNote.update({
      where: { id },
      data: {
        ...(data.content !== undefined && { content: data.content }),
        ...(data.pinned !== undefined && { pinned: data.pinned }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  }

  async deleteNote(userId: string, id: string) {
    const existing = await this.prisma.personalNote.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Notiz nicht gefunden');
    await this.prisma.personalNote.delete({ where: { id } });
    return { deleted: true };
  }

  // -------------------------------------------------------------------------
  // Personal Calendar Events
  // -------------------------------------------------------------------------

  async listEvents(userId: string, from?: string, to?: string) {
    const where: any = { userId };
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = new Date(from);
      if (to) where.startsAt.lte = new Date(to);
    }
    return this.prisma.personalCalendarEvent.findMany({
      where,
      orderBy: { startsAt: 'asc' },
    });
  }

  async createEvent(
    userId: string,
    data: {
      title: string;
      description?: string;
      startsAt: string;
      endsAt?: string;
      allDay?: boolean;
      reminderAt?: string;
      color?: string;
    },
  ) {
    return this.prisma.personalCalendarEvent.create({
      data: {
        userId,
        title: data.title,
        description: data.description || null,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        allDay: data.allDay || false,
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        color: data.color || null,
      },
    });
  }

  async updateEvent(
    userId: string,
    id: string,
    data: {
      title?: string;
      description?: string | null;
      startsAt?: string;
      endsAt?: string | null;
      allDay?: boolean;
      reminderAt?: string | null;
      color?: string | null;
    },
  ) {
    const existing = await this.prisma.personalCalendarEvent.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Termin nicht gefunden');

    return this.prisma.personalCalendarEvent.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
        ...(data.allDay !== undefined && { allDay: data.allDay }),
        ...(data.reminderAt !== undefined && {
          reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  }

  async deleteEvent(userId: string, id: string) {
    const existing = await this.prisma.personalCalendarEvent.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Termin nicht gefunden');
    await this.prisma.personalCalendarEvent.delete({ where: { id } });
    return { deleted: true };
  }
}
