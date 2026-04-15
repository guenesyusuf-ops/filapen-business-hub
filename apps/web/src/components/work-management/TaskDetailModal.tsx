'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X, Calendar, User, Flag, Tag, Clock, Paperclip, Send,
  CheckSquare, Square, Plus, Trash2, Download, Save,
} from 'lucide-react';
import type { WmTask, WmSubtask, WmComment, WmAttachment, WmColumn, WmMember, WmLabel } from '@/hooks/work-management/useWm';

const PRIORITY_OPTIONS: { value: WmTask['priority']; label: string; color: string }[] = [
  { value: 'urgent', label: 'Dringend', color: 'bg-red-500' },
  { value: 'high', label: 'Hoch', color: 'bg-orange-500' },
  { value: 'medium', label: 'Mittel', color: 'bg-blue-500' },
  { value: 'low', label: 'Niedrig', color: 'bg-gray-400' },
];

interface TaskDetailModalProps {
  task: WmTask;
  columns: WmColumn[];
  members: WmMember[];
  labels: WmLabel[];
  comments: WmComment[];
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<WmTask> & { id: string }) => void;
  onAddComment: (content: string) => void;
  onUploadAttachment: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
}

export function TaskDetailModal({
  task, columns, members, labels, comments, open, onClose,
  onUpdate, onAddComment, onUploadAttachment, onDeleteAttachment,
}: TaskDetailModalProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? '');
  const [editPriority, setEditPriority] = useState<WmTask['priority']>(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [editAssigneeId, setEditAssigneeId] = useState(task.assigneeId ?? '');
  const [editColumnId, setEditColumnId] = useState(task.columnId);
  const [newSubtask, setNewSubtask] = useState('');
  const [commentText, setCommentText] = useState('');
  const [visible, setVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slide-in animation
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Sync state when task prop changes
  useEffect(() => {
    setEditTitle(task.title);
    setEditDesc(task.description ?? '');
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setEditAssigneeId(task.assigneeId ?? '');
    setEditColumnId(task.columnId);
  }, [task]);

  if (!open) return null;

  const hasChanges =
    editTitle.trim() !== task.title ||
    editDesc !== (task.description ?? '') ||
    editPriority !== task.priority ||
    editDueDate !== (task.dueDate ? task.dueDate.split('T')[0] : '') ||
    editAssigneeId !== (task.assigneeId ?? '') ||
    editColumnId !== task.columnId;

  function handleSave() {
    onUpdate({
      id: task.id,
      title: editTitle.trim(),
      description: editDesc,
      priority: editPriority,
      dueDate: editDueDate || undefined,
      assigneeId: editAssigneeId || undefined,
      columnId: editColumnId,
    });
  }

  function handleAddSubtask() {
    if (!newSubtask.trim()) return;
    const updated = [...(task.subtasks ?? []), { id: `temp-${Date.now()}`, title: newSubtask.trim(), completed: false }];
    onUpdate({ id: task.id, subtasks: updated });
    setNewSubtask('');
  }

  function toggleSubtask(idx: number) {
    const updated = (task.subtasks ?? []).map((s, i) =>
      i === idx ? { ...s, completed: !s.completed } : s,
    );
    onUpdate({ id: task.id, subtasks: updated });
  }

  function handleComment() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAttachment(file);
    e.target.value = '';
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  const completedSub = (task.subtasks ?? []).filter((s) => s.completed).length;
  const totalSub = (task.subtasks ?? []).length;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleClose}
      />

      {/* Slide-over panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-full md:w-[60%] lg:w-[55%] max-w-4xl',
          'bg-white dark:bg-[#1a1d2e] border-l border-gray-200 dark:border-white/10 shadow-2xl',
          'transform transition-transform duration-300 ease-out',
          'flex flex-col',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header with save button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">
              Aufgabe bearbeiten
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              hasChanges
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed',
            )}
          >
            <Save className="h-4 w-4" />
            Aenderungen speichern
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row h-full">
            {/* Main area */}
            <div className="flex-1 p-6 space-y-6 min-w-0">
              {/* Title */}
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xl font-bold text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0"
              />

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                  Beschreibung
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  placeholder="Beschreibung hinzufuegen..."
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unteraufgaben
                  </label>
                  {totalSub > 0 && (
                    <span className="text-xs text-gray-400">{completedSub}/{totalSub}</span>
                  )}
                </div>
                {totalSub > 0 && (
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mb-2 overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${totalSub > 0 ? (completedSub / totalSub) * 100 : 0}%` }}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  {(task.subtasks ?? []).map((sub, idx) => (
                    <button
                      key={sub.id}
                      onClick={() => toggleSubtask(idx)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      {sub.completed ? (
                        <CheckSquare className="h-4 w-4 text-primary-500 flex-shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={cn('text-sm', sub.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300')}>
                        {sub.title}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Unteraufgabe hinzufuegen..."
                    className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="p-1.5 rounded-md text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Attachments */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                  Anhaenge
                </label>
                {(task.attachments ?? []).length > 0 && (
                  <div className="space-y-1 mb-2">
                    {task.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-white/5">
                        <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate flex-1">{att.filename}</span>
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary-500">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={() => onDeleteAttachment(att.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Datei hinzufuegen
                </button>
              </div>

              {/* Comments */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                  Kommentare
                </label>
                {comments.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300 flex-shrink-0 mt-0.5">
                          {c.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.authorName}</span>
                            <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('de-DE')}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                    placeholder="Kommentar schreiben..."
                    className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-gray-200 dark:border-white/10 p-5 space-y-5 bg-gray-50/50 dark:bg-white/[0.02]">
              {/* Status */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Status</label>
                <select
                  value={editColumnId}
                  onChange={(e) => setEditColumnId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> Zugewiesen an
                </label>
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">Nicht zugewiesen</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Faelligkeitsdatum
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Flag className="h-3 w-3" /> Prioritaet
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as WmTask['priority'])}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Labels */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Labels
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => {
                    const isSelected = task.labels?.some((l) => l.id === label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => {
                          const newLabels = isSelected
                            ? (task.labels ?? []).filter((l) => l.id !== label.id)
                            : [...(task.labels ?? []), label];
                          onUpdate({ id: task.id, labels: newLabels });
                        }}
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors',
                          isSelected
                            ? 'border-current opacity-100'
                            : 'border-gray-200 dark:border-white/10 opacity-60 hover:opacity-100',
                        )}
                        style={{ color: label.color, borderColor: isSelected ? label.color : undefined }}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                  {labels.length === 0 && (
                    <span className="text-xs text-gray-400">Keine Labels vorhanden</span>
                  )}
                </div>
              </div>

              {/* Created by */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Erstellt von</label>
                <p className="text-sm text-gray-600 dark:text-gray-400">{task.createdByName}</p>
              </div>

              {/* Time estimate */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Zeitschaetzung
                </label>
                <input
                  type="number"
                  min={0}
                  value={task.estimateMinutes ?? ''}
                  onChange={(e) => onUpdate({ id: task.id, estimateMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="Minuten"
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
