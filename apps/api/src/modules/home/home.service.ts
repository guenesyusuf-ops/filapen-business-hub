import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

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
