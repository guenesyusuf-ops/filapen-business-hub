'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { WmTask, WmColumn } from '@/hooks/work-management/useWm';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTaskCard } from './KanbanTaskCard';

interface ColumnWithTasks extends WmColumn {
  tasks: WmTask[];
}

interface KanbanBoardProps {
  columns: ColumnWithTasks[];
  members?: { id: string; userId?: string; userName?: string; name?: string }[];
  onMoveTask: (taskId: string, columnId: string, position: number) => void;
  onAddTask: (columnId: string, data: { title: string; assigneeId?: string; priority?: string }) => void;
  onTaskClick: (task: WmTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddColumn: () => void;
}

export function KanbanBoard({ columns, members, onMoveTask, onAddTask, onTaskClick, onDeleteTask, onAddColumn }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<WmTask | null>(null);
  const [localColumns, setLocalColumns] = useState<ColumnWithTasks[]>(columns);

  // Sync prop changes
  if (columns !== localColumns && !activeTask) {
    setLocalColumns(columns);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const findColumnByTaskId = useCallback((taskId: string): ColumnWithTasks | undefined => {
    return localColumns.find((col) => col.tasks.some((t) => t.id === taskId));
  }, [localColumns]);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = active.data.current?.task as WmTask | undefined;
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCol = findColumnByTaskId(activeId);
    let overCol: ColumnWithTasks | undefined;

    // Determine target column
    if (overId.startsWith('column-')) {
      const colId = overId.replace('column-', '');
      overCol = localColumns.find((c) => c.id === colId);
    } else {
      overCol = findColumnByTaskId(overId);
    }

    if (!activeCol || !overCol || activeCol.id === overCol.id) return;

    setLocalColumns((prev) => {
      const newCols = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
      const srcCol = newCols.find((c) => c.id === activeCol.id)!;
      const dstCol = newCols.find((c) => c.id === overCol!.id)!;

      const taskIdx = srcCol.tasks.findIndex((t) => t.id === activeId);
      if (taskIdx === -1) return prev;

      const [task] = srcCol.tasks.splice(taskIdx, 1);
      const overIdx = dstCol.tasks.findIndex((t) => t.id === overId);
      if (overIdx >= 0) {
        dstCol.tasks.splice(overIdx, 0, task);
      } else {
        dstCol.tasks.push(task);
      }
      return newCols;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const col = findColumnByTaskId(activeId) ?? localColumns.find(
      (c) => c.tasks.some((t) => t.id === activeId),
    );
    if (!col) return;

    // Reorder within same column
    if (activeId !== overId && !overId.startsWith('column-')) {
      const oldIdx = col.tasks.findIndex((t) => t.id === activeId);
      const newIdx = col.tasks.findIndex((t) => t.id === overId);
      if (oldIdx !== -1 && newIdx !== -1) {
        setLocalColumns((prev) =>
          prev.map((c) =>
            c.id === col.id ? { ...c, tasks: arrayMove(c.tasks, oldIdx, newIdx) } : c,
          ),
        );
      }
    }

    // Find final position
    const finalCol = localColumns.find(
      (c) => c.tasks.some((t) => t.id === activeId),
    );
    if (finalCol) {
      const pos = finalCol.tasks.findIndex((t) => t.id === activeId);
      onMoveTask(activeId, finalCol.id, pos >= 0 ? pos : 0);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {localColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={col.tasks}
            members={members}
            onAddTask={onAddTask}
            onTaskClick={onTaskClick}
            onDeleteTask={onDeleteTask}
          />
        ))}

        {/* Add column button */}
        <button
          onClick={onAddColumn}
          className={cn(
            'flex items-center justify-center gap-2 w-72 min-w-[18rem] flex-shrink-0 rounded-xl',
            'border-2 border-dashed border-gray-300 dark:border-white/10',
            'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
            'hover:border-gray-400 dark:hover:border-white/20 transition-colors',
            'h-32 self-start',
          )}
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-medium">Spalte hinzufuegen</span>
        </button>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="w-72 opacity-90 rotate-2">
            <KanbanTaskCard task={activeTask} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
