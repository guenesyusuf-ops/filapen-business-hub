import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';
const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';

export interface DashboardData {
  totalOpen: number;
  totalCompleted: number;
  completedLast7Days: number;
  overdue: number;
  dueThisWeek: number;
  dueToday: number;
  byPriority: Record<string, number>;
  byProject: { projectId: string; name: string; open: number; completed: number }[];
}

@Injectable()
export class WmDashboardService {
  private readonly logger = new Logger(WmDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // DASHBOARD KPIs
  // =========================================================================

  async getDashboard(): Promise<DashboardData> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tasks = await this.prisma.wmTask.findMany({
      where: { orgId: DEV_ORG_ID, parentTaskId: null },
      select: {
        id: true,
        projectId: true,
        priority: true,
        dueDate: true,
        completed: true,
        completedAt: true,
      },
    });

    const projects = await this.prisma.wmProject.findMany({
      where: { orgId: DEV_ORG_ID },
      select: { id: true, name: true },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    let totalOpen = 0;
    let totalCompleted = 0;
    let completedLast7Days = 0;
    let overdue = 0;
    let dueThisWeek = 0;
    let dueToday = 0;
    const byPriority: Record<string, number> = {};
    const projectStats: Record<string, { open: number; completed: number }> = {};

    for (const task of tasks) {
      // Per-project stats
      if (!projectStats[task.projectId]) {
        projectStats[task.projectId] = { open: 0, completed: 0 };
      }

      if (task.completed) {
        totalCompleted++;
        projectStats[task.projectId].completed++;

        if (task.completedAt && task.completedAt >= sevenDaysAgo) {
          completedLast7Days++;
        }
      } else {
        totalOpen++;
        projectStats[task.projectId].open++;

        // Priority counting (open tasks only)
        const prio = task.priority || 'medium';
        byPriority[prio] = (byPriority[prio] || 0) + 1;

        if (task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < todayStart) {
            overdue++;
          } else if (due >= todayStart && due < todayEnd) {
            dueToday++;
            dueThisWeek++;
          } else if (due < weekEnd) {
            dueThisWeek++;
          }
        }
      }
    }

    const byProject = Object.entries(projectStats).map(([projectId, stats]) => ({
      projectId,
      name: projectMap.get(projectId) || 'Unbekannt',
      ...stats,
    }));

    return {
      totalOpen,
      totalCompleted,
      completedLast7Days,
      overdue,
      dueThisWeek,
      dueToday,
      byPriority,
      byProject,
    };
  }

  // =========================================================================
  // MY TASKS
  // =========================================================================

  async getMyTasks() {
    return this.prisma.wmTask.findMany({
      where: {
        orgId: DEV_ORG_ID,
        parentTaskId: null,
        // In production, filter by assigneeId from auth context
        // For dev, return all tasks
      },
      include: {
        taskLabels: { include: { label: true } },
        subtasks: true,
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // =========================================================================
  // AUTO-COMPLETE TRIGGER
  // =========================================================================

  async checkCompletionTrigger(taskId: string) {
    const task = await this.prisma.wmTask.findUnique({
      where: { id: taskId },
      include: {
        column: true,
        project: {
          include: {
            columns: {
              orderBy: { position: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');

    const lastColumn = task.project.columns[0];
    if (lastColumn && task.columnId === lastColumn.id && !task.completed) {
      const updated = await this.prisma.wmTask.update({
        where: { id: taskId },
        data: { completed: true, completedAt: new Date() },
        include: {
          taskLabels: { include: { label: true } },
          subtasks: true,
        },
      });
      return { autoCompleted: true, task: updated };
    }

    // If moved out of last column and was auto-completed, un-complete
    if (lastColumn && task.columnId !== lastColumn.id && task.completed) {
      const updated = await this.prisma.wmTask.update({
        where: { id: taskId },
        data: { completed: false, completedAt: null },
        include: {
          taskLabels: { include: { label: true } },
          subtasks: true,
        },
      });
      return { autoCompleted: false, task: updated };
    }

    return { autoCompleted: false, task };
  }

  // =========================================================================
  // PROJECT CATEGORY
  // =========================================================================

  async updateProjectCategory(projectId: string, category: string | null) {
    const project = await this.prisma.wmProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.$executeRawUnsafe(
      `UPDATE wm_projects SET category = $1 WHERE id = $2::uuid`,
      category,
      projectId,
    );
  }

  async listProjectsWithCategory() {
    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        color: string | null;
        category: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >(`SELECT id, name, description, color, category, created_at, updated_at FROM wm_projects WHERE org_id = $1::uuid ORDER BY created_at DESC`, DEV_ORG_ID);

    return results;
  }
}
