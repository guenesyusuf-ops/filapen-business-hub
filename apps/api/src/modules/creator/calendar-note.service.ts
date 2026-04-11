import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// CalendarNoteService
// Per-day notes + optional reminders for the Creator Hub calendar widget.
// ---------------------------------------------------------------------------

export interface CreateCalendarNoteDto {
  date: string; // YYYY-MM-DD
  content: string;
  reminderAt?: string | null;
  createdBy?: string;
}

export interface UpdateCalendarNoteDto {
  content?: string;
  reminderAt?: string | null;
  date?: string;
}

function parseDateOnly(value: string): Date {
  // Accept YYYY-MM-DD and return a UTC midnight Date (Prisma @db.Date stores day).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('date must be in YYYY-MM-DD format');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function serialize(note: {
  id: string;
  orgId: string;
  date: Date;
  content: string;
  reminderAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: note.id,
    orgId: note.orgId,
    date: note.date.toISOString().slice(0, 10),
    content: note.content,
    reminderAt: note.reminderAt ? note.reminderAt.toISOString() : null,
    createdBy: note.createdBy,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

@Injectable()
export class CalendarNoteService {
  private readonly logger = new Logger(CalendarNoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listByMonth(orgId: string, month: string) {
    // month = YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be in YYYY-MM format');
    }
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const notes = await this.prisma.calendarNote.findMany({
      where: {
        orgId,
        date: { gte: start, lt: end },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    return notes.map(serialize);
  }

  async listByDate(orgId: string, date: string) {
    const d = parseDateOnly(date);
    const notes = await this.prisma.calendarNote.findMany({
      where: { orgId, date: d },
      orderBy: { createdAt: 'asc' },
    });
    return notes.map(serialize);
  }

  async create(orgId: string, data: CreateCalendarNoteDto) {
    if (!data.content || !data.content.trim()) {
      throw new BadRequestException('content is required');
    }
    const note = await this.prisma.calendarNote.create({
      data: {
        orgId,
        date: parseDateOnly(data.date),
        content: data.content.trim(),
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        createdBy: data.createdBy || 'admin',
      },
    });
    return serialize(note);
  }

  async update(orgId: string, id: string, data: UpdateCalendarNoteDto) {
    const existing = await this.prisma.calendarNote.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Calendar note not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.date !== undefined) updateData.date = parseDateOnly(data.date);
    if (data.reminderAt !== undefined) {
      updateData.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
    }

    const updated = await this.prisma.calendarNote.update({
      where: { id },
      data: updateData,
    });
    return serialize(updated);
  }

  async delete(orgId: string, id: string) {
    const existing = await this.prisma.calendarNote.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException('Calendar note not found');
    }
    await this.prisma.calendarNote.delete({ where: { id } });
    return { success: true };
  }
}
