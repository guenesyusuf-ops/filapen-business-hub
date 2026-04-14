'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { WmTask, WmColumn } from '@/hooks/work-management/useWm';
import { KanbanTaskCard } from './KanbanTaskCard';
import { InlineTaskCreate } from './InlineTaskCreate';

interface KanbanColumnProps {
  column: WmColumn;
  tasks: WmTask[];
  onAddTask: (columnId: string, title: string) => void;
  onTaskClick: (task: WmTask) => void;
}

export function KanbanColumn({ column, tasks, onAddTask, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', column },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        'flex flex-col w-72 min-w-[18rem] flex-shrink-0 rounded-xl',
        'bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/8',
        isOver && 'ring-2 ring-primary-400/50 bg-primary-50/30 dark:bg-primary-900/10',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60 dark:border-white/8">
        <div className="flex items-center gap-2">
          {column.color && (
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {column.name}
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>

      {/* Add task */}
      <div className="border-t border-gray-200/60 dark:border-white/8">
        <InlineTaskCreate onSubmit={(title) => onAddTask(column.id, title)} />
      </div>
    </div>
  );
}
