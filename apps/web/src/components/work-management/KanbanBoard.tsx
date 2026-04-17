'use client';

import { useState, useCallback, useRef } from 'react';
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
  onAddTask: (columnId: string, data: { title: string; assigneeIds?: string[]; priority?: string }) => void;
  onTaskClick: (task: WmTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddColumn: () => void;
  onMoveColumn?: (columnId: string, direction: -1 | 1) => void;
  onDeleteColumn?: (columnId: string) => void;
}

export function KanbanBoard({ columns, members, onMoveTask, onAddTask, onTaskClick, onDeleteTask, onAddColumn, onMoveColumn, onDeleteColumn }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<WmTask | null>(null);
  const [localColumns, setLocalColumns] = useState<ColumnWithTasks[]>(columns);
  const [mobileColIdx, setMobileColIdx] = useState(0);
  const touchStartRef = useRef<number>(0);

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

  const mobileCol = localColumns[mobileColIdx];

  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0 && mobileColIdx < localColumns.length - 1) {
        setMobileColIdx(mobileColIdx + 1);
      } else if (diff < 0 && mobileColIdx > 0) {
        setMobileColIdx(mobileColIdx - 1);
      }
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
      {/* ===== MOBILE: Swipeable single column ===== */}
      <div className="md:hidden h-full flex flex-col">
        {/* Column tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-2 scrollbar-thin -mx-1 px-1">
          {localColumns.map((col, i) => (
            <button
              key={col.id}
              onClick={() => setMobileColIdx(i)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                i === mobileColIdx
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400',
              )}
            >
              {col.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />}
              {col.name}
              <span className="text-[10px] opacity-70">{col.tasks.length}</span>
            </button>
          ))}
          <button
            onClick={onAddColumn}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-400 border border-dashed border-gray-300 dark:border-white/10 whitespace-nowrap flex-shrink-0"
          >
            + Spalte
          </button>
        </div>

        {/* Swipeable column */}
        {mobileCol && (
          <div
            className="flex-1 overflow-y-auto"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <KanbanColumn
              key={mobileCol.id}
              column={mobileCol}
              tasks={mobileCol.tasks}
              members={members}
              onAddTask={onAddTask}
              onTaskClick={onTaskClick}
              onDeleteTask={onDeleteTask}
              onMoveColumn={onMoveColumn}
              onDeleteColumn={onDeleteColumn}
              isFirst={mobileColIdx === 0}
              isLast={mobileColIdx === localColumns.length - 1}
            />
          </div>
        )}

        {/* Swipe indicator dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {localColumns.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === mobileColIdx ? 'w-4 bg-primary-500' : 'w-1.5 bg-gray-300 dark:bg-gray-600',
              )}
            />
          ))}
        </div>
      </div>

      {/* ===== DESKTOP: Normal horizontal scroll ===== */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4 h-full">
        {localColumns.map((col, i) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={col.tasks}
            members={members}
            onAddTask={onAddTask}
            onTaskClick={onTaskClick}
            onDeleteTask={onDeleteTask}
            onMoveColumn={onMoveColumn}
            onDeleteColumn={onDeleteColumn}
            isFirst={i === 0}
            isLast={i === localColumns.length - 1}
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
          <span className="text-sm font-medium">Spalte hinzufügen</span>
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
