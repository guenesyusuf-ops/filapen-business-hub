import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

const DEFAULT_COLUMNS = [
  { name: 'To Do', color: '#6B7280', position: 0 },
  { name: 'In Arbeit', color: '#3B82F6', position: 1 },
  { name: 'Erledigt', color: '#10B981', position: 2 },
];

@Injectable()
export class WorkManagementService {
  private readonly logger = new Logger(WorkManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Enriches tasks with:
   *   - assignees: [{ userId, userName, avatarUrl }]  (multi-assignee join)
   *   - assigneeName / assigneeAvatarUrl              (first assignee, back-compat)
   *   - createdByName / createdByAvatarUrl
   *
   * Reads the wm_task_assignees join table once per call for all passed tasks.
   */
  private async enrichTasksWithUsers<T extends { id: string; assigneeId: string | null; createdById?: string | null }>(
    tasks: T[],
  ): Promise<any[]> {
    if (tasks.length === 0) return tasks;

    // Load all assignees from the join table for these tasks in one query
    const taskIds = tasks.map((t) => t.id);
    const joins = await this.prisma.wmTaskAssignee.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { assignedAt: 'asc' },
    });

    // Collect all distinct user IDs we need (assignees + createdBy + legacy assigneeId)
    const userIds = new Set<string>();
    for (const j of joins) userIds.add(j.userId);
    for (const t of tasks) {
      if (t.assigneeId) userIds.add(t.assigneeId);
      if (t.createdById) userIds.add(t.createdById);
    }

    const users = userIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        })
      : [];

    const userMap = new Map(
      users.map((u) => [
        u.id,
        {
          userId: u.id,
          userName: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0],
          avatarUrl: u.avatarUrl || undefined,
        },
      ]),
    );

    // Group assignees per task
    const assigneesByTask = new Map<string, { userId: string; userName: string; avatarUrl?: string }[]>();
    for (const j of joins) {
      const user = userMap.get(j.userId);
      if (!user) continue;
      const list = assigneesByTask.get(j.taskId) ?? [];
      list.push(user);
      assigneesByTask.set(j.taskId, list);
    }

    return tasks.map((t) => {
      let assignees = assigneesByTask.get(t.id) ?? [];
      // Fallback: if join table is empty for this task but legacy assigneeId
      // still points at a valid user, expose it as a single-element assignees array.
      if (assignees.length === 0 && t.assigneeId && userMap.has(t.assigneeId)) {
        assignees = [userMap.get(t.assigneeId)!];
      }
      const primary = assignees[0];
      const creator = t.createdById ? userMap.get(t.createdById) : undefined;
      return {
        ...t,
        assignees,
        assigneeIds: assignees.map((a) => a.userId),
        ...(primary
          ? { assigneeName: primary.userName, assigneeAvatarUrl: primary.avatarUrl }
          : {}),
        ...(creator
          ? { createdByName: creator.userName, createdByAvatarUrl: creator.avatarUrl }
          : {}),
      };
    });
  }

  /**
   * Replace the full set of assignees for a given task.
   * Keeps the legacy WmTask.assigneeId mirror pointing to the first assignee.
   */
  private async setTaskAssignees(taskId: string, userIds: string[]) {
    const unique = Array.from(new Set(userIds.filter(Boolean)));

    // Guard: only allow actual users, silently drop unknown ids
    const existingUsers = unique.length
      ? await this.prisma.user.findMany({
          where: { id: { in: unique } },
          select: { id: true },
        })
      : [];
    const validIds = existingUsers.map((u) => u.id);

    await this.prisma.$transaction([
      this.prisma.wmTaskAssignee.deleteMany({ where: { taskId } }),
      ...(validIds.length
        ? [
            this.prisma.wmTaskAssignee.createMany({
              data: validIds.map((userId) => ({ taskId, userId })),
              skipDuplicates: true,
            }),
          ]
        : []),
      this.prisma.wmTask.update({
        where: { id: taskId },
        data: { assigneeId: validIds[0] ?? null },
      }),
    ]);
  }

  // =========================================================================
  // PROJECTS
  // =========================================================================

  async listProjects() {
    const projects = await this.prisma.wmProject.findMany({
      where: { orgId: DEV_ORG_ID },
      include: {
        _count: { select: { members: true, tasks: true } },
        columns: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Count eligible org users — used as fallback member count for projects
    // that were created before auto-population (legacy projects).
    const eligibleCount = await this.prisma.user.count({
      where: {
        orgId: DEV_ORG_ID,
        status: 'active',
        OR: [
          { role: { in: ['owner', 'admin'] } },
          { menuPermissions: { has: 'work-management' } },
        ],
      },
    });

    return projects.map((p) => ({
      ...p,
      memberCount: Math.max(p._count.members, eligibleCount),
      taskCount: p._count.tasks,
      _count: undefined,
    }));
  }

  async createProject(data: { name: string; description?: string; color?: string; createdBy: string }) {
    const project = await this.prisma.wmProject.create({
      data: {
        orgId: DEV_ORG_ID,
        name: data.name,
        description: data.description || null,
        color: data.color || '#3B82F6',
        createdBy: data.createdBy,
      },
    });

    await this.prisma.wmColumn.createMany({
      data: DEFAULT_COLUMNS.map((col) => ({
        projectId: project.id,
        name: col.name,
        color: col.color,
        position: col.position,
      })),
    });

    // Auto-populate members with all eligible org users:
    //   - Admins/Owners (always get full access)
    //   - Mitarbeiter with 'work-management' in menuPermissions
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        orgId: DEV_ORG_ID,
        status: 'active',
        OR: [
          { role: { in: ['owner', 'admin'] } },
          { menuPermissions: { has: 'work-management' } },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
    });

    if (eligibleUsers.length > 0) {
      await this.prisma.wmProjectMember.createMany({
        data: eligibleUsers.map((u) => ({
          projectId: project.id,
          userId: u.id,
          userName: u.name || u.email.split('@')[0],
          role: u.id === data.createdBy ? 'admin' : 'member',
        })),
        skipDuplicates: true,
      });
    }

    return this.getProjectById(project.id);
  }

  async getProjectById(id: string) {
    const project = await this.prisma.wmProject.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { position: 'asc' } },
        tasks: {
          include: {
            taskLabels: { include: { label: true } },
            subtasks: true,
            attachments: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { position: 'asc' },
        },
        members: true,
        labels: true,
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    // Override members with the resilient listMembers (includes all eligible org users)
    const members = await this.listMembers(id);
    const tasks = await this.enrichTasksWithUsers(project.tasks);
    return { ...project, members, tasks };
  }

  async updateProject(id: string, data: { name?: string; description?: string; color?: string }) {
    await this.ensureProjectExists(id);
    return this.prisma.wmProject.update({
      where: { id },
      data,
    });
  }

  async deleteProject(id: string) {
    await this.ensureProjectExists(id);
    await this.prisma.wmProject.delete({ where: { id } });
    return { deleted: true };
  }

  // =========================================================================
  // COLUMNS
  // =========================================================================

  async createColumn(projectId: string, data: { name: string; color?: string }) {
    await this.ensureProjectExists(projectId);

    const maxPos = await this.prisma.wmColumn.aggregate({
      where: { projectId },
      _max: { position: true },
    });

    return this.prisma.wmColumn.create({
      data: {
        projectId,
        name: data.name,
        color: data.color,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
  }

  async updateColumn(id: string, data: { name?: string; color?: string }) {
    return this.prisma.wmColumn.update({ where: { id }, data });
  }

  async deleteColumn(id: string) {
    const column = await this.prisma.wmColumn.findUnique({
      where: { id },
      include: { project: { include: { columns: { orderBy: { position: 'asc' } } } } },
    });

    if (!column) throw new NotFoundException('Column not found');

    const otherColumns = column.project.columns.filter((c) => c.id !== id);
    if (otherColumns.length === 0) {
      throw new BadRequestException('Cannot delete the last column');
    }

    const targetColumnId = otherColumns[0].id;

    await this.prisma.$transaction([
      this.prisma.wmTask.updateMany({
        where: { columnId: id },
        data: { columnId: targetColumnId },
      }),
      this.prisma.wmColumn.delete({ where: { id } }),
    ]);

    return { deleted: true, tasksMovedTo: targetColumnId };
  }

  async reorderColumns(projectId: string, columnIds: string[]) {
    await this.ensureProjectExists(projectId);

    const updates = columnIds.map((colId, index) =>
      this.prisma.wmColumn.update({
        where: { id: colId },
        data: { position: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return { reordered: true };
  }

  // =========================================================================
  // TASKS
  // =========================================================================

  async listProjectTasks(projectId: string) {
    await this.ensureProjectExists(projectId);

    return this.prisma.wmTask.findMany({
      where: { projectId, parentTaskId: null },
      include: {
        taskLabels: { include: { label: true } },
        subtasks: {
          include: { taskLabels: { include: { label: true } } },
          orderBy: { position: 'asc' },
        },
        _count: { select: { comments: true, attachments: true } },
      },
      orderBy: { position: 'asc' },
    });
  }

  async createTask(data: {
    projectId: string;
    columnId: string;
    title: string;
    description?: string;
    /** Primary assignee (legacy) — takes precedence if assigneeIds not given. */
    assigneeId?: string;
    /** Multi-assignee — replaces assigneeId semantics. */
    assigneeIds?: string[];
    createdById: string;
    priority?: string;
    dueDate?: string;
    estimatedMinutes?: number;
    color?: string;
    section?: string;
  }) {
    const maxPos = await this.prisma.wmTask.aggregate({
      where: { columnId: data.columnId, parentTaskId: null },
      _max: { position: true },
    });

    // Consolidate assignee inputs — assigneeIds wins if provided, else legacy assigneeId
    const finalAssigneeIds =
      data.assigneeIds && data.assigneeIds.length > 0
        ? data.assigneeIds
        : data.assigneeId
          ? [data.assigneeId]
          : [];

    const created = await this.prisma.wmTask.create({
      data: {
        orgId: DEV_ORG_ID,
        projectId: data.projectId,
        columnId: data.columnId,
        title: data.title,
        description: data.description,
        assigneeId: finalAssigneeIds[0] ?? null,
        createdById: data.createdById,
        priority: data.priority || 'medium',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        estimatedMinutes: data.estimatedMinutes,
        color: data.color,
        section: data.section,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        taskLabels: { include: { label: true } },
        subtasks: true,
      },
    });

    if (finalAssigneeIds.length > 0) {
      await this.setTaskAssignees(created.id, finalAssigneeIds);
    }

    await this.logActivity(created.id, data.projectId, data.createdById, 'System', 'created', `Aufgabe "${data.title}" erstellt`);
    const refreshed = await this.prisma.wmTask.findUnique({
      where: { id: created.id },
      include: { taskLabels: { include: { label: true } }, subtasks: true, attachments: true },
    });
    const [enriched] = await this.enrichTasksWithUsers([refreshed ?? created]);
    return enriched;
  }

  async getTaskById(id: string) {
    const task = await this.prisma.wmTask.findUnique({
      where: { id },
      include: {
        taskLabels: { include: { label: true } },
        subtasks: {
          orderBy: { position: 'asc' },
          include: { taskLabels: { include: { label: true } } },
        },
        comments: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
        column: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateTask(
    id: string,
    data: {
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: string | null;
      assigneeId?: string | null;
      assigneeIds?: string[];
      columnId?: string;
      completed?: boolean;
      estimatedMinutes?: number | null;
      color?: string | null;
      section?: string | null;
    },
  ) {
    await this.ensureTaskExists(id);

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    // Primary assignee mirror — only set when explicitly provided and no assigneeIds given
    if (data.assigneeId !== undefined && data.assigneeIds === undefined) {
      updateData.assigneeId = data.assigneeId;
    }
    if (data.columnId !== undefined) updateData.columnId = data.columnId;
    if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.section !== undefined) updateData.section = data.section;

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      updateData.completedAt = data.completed ? new Date() : null;
    }

    const existingTask = await this.prisma.wmTask.findUnique({ where: { id } });
    const updated = await this.prisma.wmTask.update({
      where: { id },
      data: updateData,
      include: {
        taskLabels: { include: { label: true } },
        subtasks: true,
      },
    });

    // Log activity for relevant changes
    if (existingTask) {
      const details: string[] = [];
      if (data.priority !== undefined && data.priority !== existingTask.priority) {
        details.push(`Prioritaet: ${existingTask.priority} → ${data.priority}`);
      }
      if (data.completed !== undefined && data.completed !== existingTask.completed) {
        await this.logActivity(id, existingTask.projectId, existingTask.createdById, 'System', data.completed ? 'completed' : 'updated', data.completed ? 'Aufgabe abgeschlossen' : 'Aufgabe wieder geoeffnet');
      }
      if (details.length > 0) {
        await this.logActivity(id, existingTask.projectId, existingTask.createdById, 'System', 'updated', details.join(', '));
      }
    }

    // Multi-assignee sync (either explicit list or legacy single set)
    if (data.assigneeIds !== undefined) {
      await this.setTaskAssignees(id, data.assigneeIds);
    } else if (data.assigneeId !== undefined) {
      await this.setTaskAssignees(id, data.assigneeId ? [data.assigneeId] : []);
    }

    const refreshed = await this.prisma.wmTask.findUnique({
      where: { id },
      include: { taskLabels: { include: { label: true } }, subtasks: true, attachments: true },
    });
    const [enriched] = await this.enrichTasksWithUsers([refreshed ?? updated]);
    return enriched;
  }

  async deleteTask(id: string) {
    await this.ensureTaskExists(id);
    await this.prisma.wmTask.delete({ where: { id } });
    return { deleted: true };
  }

  async moveTask(id: string, data: { columnId: string; position: number }) {
    await this.ensureTaskExists(id);

    // Shift existing tasks in the target column
    await this.prisma.wmTask.updateMany({
      where: {
        columnId: data.columnId,
        position: { gte: data.position },
        parentTaskId: null,
        id: { not: id },
      },
      data: { position: { increment: 1 } },
    });

    const existingTask = await this.prisma.wmTask.findUnique({ where: { id } });
    const moved = await this.prisma.wmTask.update({
      where: { id },
      data: {
        columnId: data.columnId,
        position: data.position,
      },
      include: {
        taskLabels: { include: { label: true } },
        subtasks: true,
      },
    });

    if (existingTask && existingTask.columnId !== data.columnId) {
      await this.logActivity(id, existingTask.projectId, existingTask.createdById, 'System', 'moved', `Aufgabe in andere Spalte verschoben`);
    }

    return moved;
  }

  async bulkReorderTasks(projectId: string, items: { taskId: string; columnId: string; position: number }[]) {
    await this.ensureProjectExists(projectId);

    const updates = items.map((item) =>
      this.prisma.wmTask.update({
        where: { id: item.taskId },
        data: { columnId: item.columnId, position: item.position },
      }),
    );

    await this.prisma.$transaction(updates);
    return { reordered: true };
  }

  // =========================================================================
  // SUBTASKS
  // =========================================================================

  async createSubtask(parentTaskId: string, data: { title: string; createdById: string; assigneeId?: string }) {
    const parent = await this.prisma.wmTask.findUnique({ where: { id: parentTaskId } });
    if (!parent) throw new NotFoundException('Parent task not found');

    const maxPos = await this.prisma.wmTask.aggregate({
      where: { parentTaskId },
      _max: { position: true },
    });

    return this.prisma.wmTask.create({
      data: {
        orgId: parent.orgId,
        projectId: parent.projectId,
        columnId: parent.columnId,
        parentTaskId,
        title: data.title,
        createdById: data.createdById,
        assigneeId: data.assigneeId,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
  }

  async toggleSubtask(id: string) {
    const subtask = await this.prisma.wmTask.findUnique({ where: { id } });
    if (!subtask) throw new NotFoundException('Subtask not found');

    const completed = !subtask.completed;
    return this.prisma.wmTask.update({
      where: { id },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  // =========================================================================
  // COMMENTS
  // =========================================================================

  async listComments(taskId: string) {
    return this.prisma.wmComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createComment(taskId: string, data: { userId: string; userName: string; message: string }) {
    const task = await this.ensureTaskExists(taskId);

    const comment = await this.prisma.wmComment.create({
      data: {
        taskId,
        userId: data.userId,
        userName: data.userName,
        message: data.message,
      },
    });

    await this.logActivity(taskId, task.projectId, data.userId, data.userName, 'commented', 'Kommentar geschrieben');
    return comment;
  }

  // =========================================================================
  // ATTACHMENTS
  // =========================================================================

  async uploadAttachment(
    taskId: string,
    file: Express.Multer.File,
  ) {
    const task = await this.prisma.wmTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `wm/attachments/${taskId}/${timestamp}-${safeName}`;

    const fileUrl = await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const attachment = await this.prisma.wmAttachment.create({
      data: {
        taskId,
        fileName: file.originalname,
        fileUrl,
        storageKey,
        fileSize: file.size,
        fileType: file.mimetype,
      },
    });

    // Return attachment + projectId so the client can invalidate the right cache
    return { ...attachment, projectId: task.projectId };
  }

  async deleteAttachment(id: string) {
    const attachment = await this.prisma.wmAttachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.storageKey) {
      try {
        await this.storage.delete(attachment.storageKey);
      } catch (err) {
        this.logger.warn(`Failed to delete from R2: ${attachment.storageKey}`, err);
      }
    }

    await this.prisma.wmAttachment.delete({ where: { id } });
    return { deleted: true };
  }

  // =========================================================================
  // LABELS
  // =========================================================================

  async listLabels(projectId: string) {
    return this.prisma.wmLabel.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    });
  }

  async createLabel(projectId: string, data: { name: string; color: string }) {
    await this.ensureProjectExists(projectId);

    return this.prisma.wmLabel.create({
      data: {
        projectId,
        name: data.name,
        color: data.color,
      },
    });
  }

  async deleteLabel(id: string) {
    await this.prisma.wmLabel.delete({ where: { id } });
    return { deleted: true };
  }

  async addLabelToTask(taskId: string, labelId: string) {
    const task = await this.ensureTaskExists(taskId);
    const label = await this.prisma.wmLabel.findUnique({ where: { id: labelId } });

    const result = await this.prisma.wmTaskLabel.create({
      data: { taskId, labelId },
    });

    await this.logActivity(taskId, task.projectId, task.createdById, 'System', 'label_added', `Label "${label?.name ?? labelId}" hinzugefuegt`);
    return result;
  }

  async removeLabelFromTask(taskId: string, labelId: string) {
    const task = await this.prisma.wmTask.findUnique({ where: { id: taskId } });
    const label = await this.prisma.wmLabel.findUnique({ where: { id: labelId } });

    await this.prisma.wmTaskLabel.delete({
      where: { taskId_labelId: { taskId, labelId } },
    });

    if (task) {
      await this.logActivity(taskId, task.projectId, task.createdById, 'System', 'label_removed', `Label "${label?.name ?? labelId}" entfernt`);
    }
    return { removed: true };
  }

  // =========================================================================
  // MEMBERS
  // =========================================================================

  async listMembers(projectId: string) {
    const members = await this.prisma.wmProjectMember.findMany({
      where: { projectId },
      orderBy: { userName: 'asc' },
    });

    // Backfill: if there are no members (legacy projects) or to ensure newly-invited
    // users appear, return the union with all active org users who have WM access.
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        orgId: DEV_ORG_ID,
        status: 'active',
        OR: [
          { role: { in: ['owner', 'admin'] } },
          { menuPermissions: { has: 'work-management' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    const existingUserIds = new Set(members.map((m) => m.userId));
    const virtualMembers = eligibleUsers
      .filter((u) => !existingUserIds.has(u.id))
      .map((u) => ({
        id: `virtual-${u.id}`,
        projectId,
        userId: u.id,
        userName: u.name || u.email.split('@')[0],
        role: 'member',
        joinedAt: new Date(),
      }));

    return [...members, ...virtualMembers].sort((a, b) =>
      (a.userName || '').localeCompare(b.userName || ''),
    );
  }

  async addMember(projectId: string, data: { userId: string; userName: string; role?: string }) {
    await this.ensureProjectExists(projectId);

    return this.prisma.wmProjectMember.create({
      data: {
        projectId,
        userId: data.userId,
        userName: data.userName,
        role: data.role || 'member',
      },
    });
  }

  async updateMember(id: string, data: { role: string }) {
    return this.prisma.wmProjectMember.update({
      where: { id },
      data: { role: data.role },
    });
  }

  async removeMember(id: string) {
    await this.prisma.wmProjectMember.delete({ where: { id } });
    return { removed: true };
  }

  // =========================================================================
  // WORKLOAD
  // =========================================================================

  async getWorkload(projectId?: string) {
    const where: Record<string, unknown> = {
      orgId: DEV_ORG_ID,
      parentTaskId: null,
    };
    if (projectId) where.projectId = projectId;

    const tasks = await this.prisma.wmTask.findMany({
      where,
      select: {
        id: true,
        assigneeId: true,
        completed: true,
        dueDate: true,
        priority: true,
      },
    });

    // Build assignee mapping from multi-assignee join table
    const taskIds = tasks.map((t) => t.id);
    const joins = taskIds.length
      ? await this.prisma.wmTaskAssignee.findMany({
          where: { taskId: { in: taskIds } },
          select: { taskId: true, userId: true },
        })
      : [];

    // Map each task → set of assignee user IDs
    const taskAssignees = new Map<string, Set<string>>();
    for (const j of joins) {
      if (!taskAssignees.has(j.taskId)) taskAssignees.set(j.taskId, new Set());
      taskAssignees.get(j.taskId)!.add(j.userId);
    }
    // Legacy fallback
    for (const t of tasks) {
      if (t.assigneeId && !taskAssignees.has(t.id)) {
        taskAssignees.set(t.id, new Set([t.assigneeId]));
      }
    }

    const today = new Date(new Date().toDateString());
    const tomorrow = new Date(today.getTime() + 86_400_000);

    interface Stats { openTasks: number; dueToday: number; overdue: number; highPriority: number }
    const byUser = new Map<string, Stats>();

    for (const task of tasks) {
      const assignees = taskAssignees.get(task.id);
      if (!assignees || assignees.size === 0) continue;

      for (const userId of assignees) {
        if (!byUser.has(userId)) byUser.set(userId, { openTasks: 0, dueToday: 0, overdue: 0, highPriority: 0 });
        const s = byUser.get(userId)!;

        if (task.completed) continue;
        s.openTasks++;
        if (task.priority === 'high' || task.priority === 'urgent') s.highPriority++;
        if (task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < today) s.overdue++;
          else if (due >= today && due < tomorrow) s.dueToday++;
        }
      }
    }

    // Resolve user names
    const userIds = Array.from(byUser.keys());
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const nameMap = new Map(
      users.map((u) => [
        u.id,
        u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0],
      ]),
    );

    return Array.from(byUser.entries())
      .map(([userId, stats]) => ({
        memberId: userId,
        memberName: nameMap.get(userId) || 'Unbekannt',
        ...stats,
      }))
      .sort((a, b) => b.openTasks - a.openTasks);
  }

  // =========================================================================
  // ACTIVITIES
  // =========================================================================

  async listActivities(taskId: string) {
    return this.prisma.wmActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async logActivity(
    taskId: string,
    projectId: string,
    userId: string,
    userName: string,
    action: string,
    details?: string,
  ) {
    try {
      return await this.prisma.wmActivity.create({
        data: { taskId, projectId, userId, userName, action, details },
      });
    } catch (err) {
      this.logger.warn(`Failed to log activity for task ${taskId}: ${action}`, err);
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async ensureProjectExists(id: string) {
    const project = await this.prisma.wmProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async ensureTaskExists(id: string) {
    const task = await this.prisma.wmTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
