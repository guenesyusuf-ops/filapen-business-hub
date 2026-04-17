'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { WmTask, WmColumn } from '@/hooks/work-management/useWm';
import { KanbanTaskCard } from './KanbanTaskCard';
import { InlineTaskCreate } from './InlineTaskCreate';
import { Plus, X, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';

interface KanbanColumnProps {
  column: WmColumn;
  tasks: WmTask[];
  members?: { id: string; userId?: string; userName?: string; name?: string }[];
  onAddTask: (columnId: string, data: { title: string; assigneeIds?: string[]; priority?: string; section?: string }) => void;
  onTaskClick: (task: WmTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onMoveColumn?: (columnId: string, direction: -1 | 1) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const DEFAULT_SECTION = 'Allgemein';

function groupTasksBySections(tasks: WmTask[]): { name: string; tasks: WmTask[] }[] {
  const sectionMap = new Map<string, WmTask[]>();

  for (const task of tasks) {
    const sectionName = task.section || DEFAULT_SECTION;
    const existing = sectionMap.get(sectionName);
    if (existing) {
      existing.push(task);
    } else {
      sectionMap.set(sectionName, [task]);
    }
  }

  // Put "Allgemein" last if there are other sections
  const sections = Array.from(sectionMap.entries()).map(([name, tasks]) => ({ name, tasks }));
  if (sections.length <= 1) return sections;

  const allgemeinIdx = sections.findIndex((s) => s.name === DEFAULT_SECTION);
  if (allgemeinIdx > -1) {
    const [allgemein] = sections.splice(allgemeinIdx, 1);
    sections.push(allgemein);
  }

  return sections;
}

export function KanbanColumn({ column, tasks, members, onAddTask, onTaskClick, onDeleteTask, onMoveColumn, isFirst, isLast }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', column },
  });

  const [showSectionInput, setShowSectionInput] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const taskIds = tasks.map((t) => t.id);
  const sections = groupTasksBySections(tasks);
  const hasSections = sections.length > 1 || (sections.length === 1 && sections[0].name !== DEFAULT_SECTION);

  function handleCreateSection() {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    setNewSectionName('');
    setShowSectionInput(false);
    // Create a placeholder task in this section so it appears
    onAddTask(column.id, { title: `Neue Aufgabe in ${trimmed}`, section: trimmed, priority: 'medium' });
  }

  function handleSectionKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateSection();
    }
    if (e.key === 'Escape') {
      setShowSectionInput(false);
      setNewSectionName('');
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col w-[75vw] sm:w-72 min-w-0 sm:min-w-[18rem] flex-shrink-0 rounded-xl',
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
        {onMoveColumn && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onMoveColumn(column.id, -1)}
              disabled={isFirst}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
              title="Nach links"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onMoveColumn(column.id, 1)}
              disabled={isLast}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
              title="Nach rechts"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {hasSections ? (
            sections.map((section) => (
              <div key={section.name}>
                {/* Section header */}
                <div className="flex items-center gap-2 px-1 py-1.5 mt-1 first:mt-0">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {section.name}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="space-y-2">
                  {section.tasks.map((task) => (
                    <KanbanTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onDelete={onDeleteTask} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            tasks.map((task) => (
              <KanbanTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onDelete={onDeleteTask} />
            ))
          )}
        </SortableContext>

        {/* Add section */}
        {showSectionInput ? (
          <div className="flex items-center gap-1 mt-2">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={handleSectionKeyDown}
              autoFocus
              placeholder="Sektionsname..."
              className="flex-1 rounded-md border border-gray-200 dark:border-white/10 bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <button
              onClick={handleCreateSection}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              OK
            </button>
            <button
              onClick={() => { setShowSectionInput(false); setNewSectionName(''); }}
              className="text-gray-400 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSectionInput(true)}
            className="flex items-center gap-1 w-full px-1 py-1 mt-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Sektion
          </button>
        )}
      </div>

      {/* Add task */}
      <div className="border-t border-gray-200/60 dark:border-white/8">
        <InlineTaskCreate
          members={members}
          onSubmit={(data) => onAddTask(column.id, data)}
        />
      </div>
    </div>
  );
}
