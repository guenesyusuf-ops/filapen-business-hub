'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  X, Calendar, User, Flag, Tag, Clock, Paperclip, Send,
  CheckSquare, Square, Plus, Trash2, Download, Save, Activity,
  MessageSquare,
} from 'lucide-react';
import type { WmTask, WmSubtask, WmComment, WmAttachment, WmColumn, WmMember, WmLabel, WmActivity } from '@/hooks/work-management/useWm';

const PRIORITY_OPTIONS: { value: WmTask['priority']; label: string; color: string }[] = [
  { value: 'urgent', label: 'Dringend', color: 'bg-red-500' },
  { value: 'high', label: 'Hoch', color: 'bg-orange-500' },
  { value: 'medium', label: 'Mittel', color: 'bg-blue-500' },
  { value: 'low', label: 'Niedrig', color: 'bg-gray-400' },
];

const LABEL_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

const ACTION_LABELS: Record<string, string> = {
  created: 'hat die Aufgabe erstellt',
  updated: 'hat die Aufgabe aktualisiert',
  moved: 'hat die Aufgabe verschoben',
  completed: 'hat die Aufgabe abgeschlossen',
  commented: 'hat einen Kommentar geschrieben',
  assigned: 'hat die Aufgabe zugewiesen',
  label_added: 'hat ein Label hinzugefuegt',
  label_removed: 'hat ein Label entfernt',
  priority_changed: 'hat die Prioritaet geaendert',
};

interface TaskDetailModalProps {
  task: WmTask;
  columns: WmColumn[];
  members: WmMember[];
  labels: WmLabel[];
  comments: WmComment[];
  activities?: WmActivity[];
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<WmTask> & { id: string }) => void;
  onAddComment: (content: string) => void;
  onUploadAttachment: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onAddLabel?: (taskId: string, labelId: string) => void;
  onRemoveLabel?: (taskId: string, labelId: string) => void;
  onCreateLabel?: (name: string, color: string) => void;
}

export function TaskDetailModal({
  task, columns, members, labels, comments, activities = [], open, onClose,
  onUpdate, onAddComment, onUploadAttachment, onDeleteAttachment,
  onAddLabel, onRemoveLabel, onCreateLabel,
}: TaskDetailModalProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? '');
  const [editPriority, setEditPriority] = useState<WmTask['priority']>(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(
    task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []),
  );
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [editColumnId, setEditColumnId] = useState(task.columnId);
  const [newSubtask, setNewSubtask] = useState('');
  const [commentText, setCommentText] = useState('');
  const [visible, setVisible] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'comments' | 'activity'>('comments');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

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
    setEditAssigneeIds(task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []));
    setEditColumnId(task.columnId);
  }, [task]);

  if (!open) return null;

  const currentAssigneeIds = task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []);
  const assigneesChanged =
    editAssigneeIds.length !== currentAssigneeIds.length ||
    editAssigneeIds.some((id, i) => id !== currentAssigneeIds[i]);

  const hasChanges =
    editTitle.trim() !== task.title ||
    editDesc !== (task.description ?? '') ||
    editPriority !== task.priority ||
    editDueDate !== (task.dueDate ? task.dueDate.split('T')[0] : '') ||
    assigneesChanged ||
    editColumnId !== task.columnId;

  function handleSave() {
    onUpdate({
      id: task.id,
      title: editTitle.trim(),
      description: editDesc,
      priority: editPriority,
      dueDate: editDueDate || undefined,
      assigneeIds: editAssigneeIds,
      columnId: editColumnId,
    } as any);
  }

  function toggleAssignee(userId: string) {
    setEditAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
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
    setShowMentionDropdown(false);
  }

  function handleCommentChange(value: string) {
    setCommentText(value);
    // Detect @ mentions
    const lastAtIdx = value.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const afterAt = value.slice(lastAtIdx + 1);
      // Only show dropdown if @ is at the cursor and no space yet
      if (!afterAt.includes(' ') && afterAt.length < 30) {
        setShowMentionDropdown(true);
        setMentionFilter(afterAt.toLowerCase());
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  }

  function insertMention(memberName: string) {
    const lastAtIdx = commentText.lastIndexOf('@');
    const before = commentText.slice(0, lastAtIdx);
    setCommentText(`${before}@${memberName} `);
    setShowMentionDropdown(false);
    commentInputRef.current?.focus();
  }

  const filteredMentionMembers = useMemo(() => {
    return members.filter((m) => {
      const name = m.userName || m.name || '';
      return name.toLowerCase().includes(mentionFilter);
    });
  }, [members, mentionFilter]);

  function renderCommentContent(content: string) {
    // Highlight @mentions in comment text
    const parts = content.split(/(@[\w\s]+?)(?=\s|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="font-semibold text-primary-600 dark:text-primary-400">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  function handleCreateNewLabel() {
    if (!newLabelName.trim() || !onCreateLabel) return;
    onCreateLabel(newLabelName.trim(), newLabelColor);
    setNewLabelName('');
    setNewLabelColor(LABEL_COLORS[0]);
    setShowNewLabel(false);
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

              {/* Comments / Activity Tabs */}
              <div>
                <div className="flex items-center gap-4 mb-3 border-b border-gray-200 dark:border-white/10">
                  <button
                    onClick={() => setActiveBottomTab('comments')}
                    className={cn(
                      'flex items-center gap-1.5 pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
                      activeBottomTab === 'comments'
                        ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Kommentare {comments.length > 0 && `(${comments.length})`}
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('activity')}
                    className={cn(
                      'flex items-center gap-1.5 pb-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
                      activeBottomTab === 'activity'
                        ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300',
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Aktivitaet {activities.length > 0 && `(${activities.length})`}
                  </button>
                </div>

                {activeBottomTab === 'comments' && (
                  <>
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
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{renderCommentContent(c.content)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <div className="flex gap-2">
                        <input
                          ref={commentInputRef}
                          type="text"
                          value={commentText}
                          onChange={(e) => handleCommentChange(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !showMentionDropdown && handleComment()}
                          placeholder="Kommentar schreiben... (@erwaehnen)"
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
                      {/* @Mention Dropdown */}
                      {showMentionDropdown && filteredMentionMembers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] shadow-xl z-10 max-h-40 overflow-y-auto">
                          {filteredMentionMembers.map((m) => {
                            const displayName = m.userName || m.name || 'Unbekannt';
                            return (
                              <button
                                key={m.userId || m.id}
                                onClick={() => insertMention(displayName)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                              >
                                <span className="h-5 w-5 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-300">
                                  {displayName.charAt(0).toUpperCase()}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300">{displayName}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeBottomTab === 'activity' && (
                  <div className="space-y-3">
                    {activities.length === 0 && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Noch keine Aktivitaeten</p>
                    )}
                    {activities.map((act) => (
                      <div key={act.id} className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5">
                          {act.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{act.userName}</span>
                            {' '}{ACTION_LABELS[act.action] || act.action}
                          </p>
                          {act.details && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{act.details}</p>
                          )}
                          <span className="text-[10px] text-gray-400 mt-0.5 block">
                            {new Date(act.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

              {/* Assignees — multi-select */}
              <div className="relative">
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> Zugewiesen an
                </label>
                <button
                  type="button"
                  onClick={() => setShowAssigneePicker((s) => !s)}
                  className="w-full min-h-[36px] rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] px-2.5 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {editAssigneeIds.length === 0 ? (
                    <span className="text-gray-400">Mitarbeiter auswaehlen...</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {editAssigneeIds.map((id) => {
                        const member = members.find((m) => (m.userId || m.id) === id);
                        const name = member?.userName || member?.name || 'Unbekannt';
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                          >
                            {name}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAssignee(id);
                              }}
                              className="hover:text-primary-900 dark:hover:text-white"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>

                {showAssigneePicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAssigneePicker(false)} />
                    <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d2e] shadow-lg py-1">
                      {members.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400">Keine Mitarbeiter</div>
                      )}
                      {members.map((m) => {
                        const uid = m.userId || m.id;
                        const checked = editAssigneeIds.includes(uid);
                        const name = m.userName || m.name || 'Unbekannt';
                        return (
                          <button
                            key={uid}
                            type="button"
                            onClick={() => toggleAssignee(uid)}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-white/5"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              readOnly
                              className="accent-primary-600 h-3.5 w-3.5"
                            />
                            <span className="h-5 w-5 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-[9px] font-bold text-primary-700 dark:text-primary-300">
                              {name.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-gray-700 dark:text-gray-300">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
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
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Labels
                </label>

                {/* Assigned labels */}
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {task.labels.map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}
                      >
                        {label.name}
                        {onRemoveLabel && (
                          <button
                            onClick={() => onRemoveLabel(task.id, label.id)}
                            className="ml-0.5 hover:opacity-70 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Available labels to add */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {labels
                    .filter((label) => !task.labels?.some((l) => l.id === label.id))
                    .map((label) => (
                      <button
                        key={label.id}
                        onClick={() => {
                          if (onAddLabel) {
                            onAddLabel(task.id, label.id);
                          } else {
                            const newLabels = [...(task.labels ?? []), label];
                            onUpdate({ id: task.id, labels: newLabels });
                          }
                        }}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 opacity-50 hover:opacity-100 transition-opacity"
                        style={{ color: label.color }}
                      >
                        + {label.name}
                      </button>
                    ))}
                </div>

                {/* New label */}
                {!showNewLabel ? (
                  <button
                    onClick={() => setShowNewLabel(true)}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Neues Label
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-gray-200 dark:border-white/10 p-2 bg-white dark:bg-[#0f1117]">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateNewLabel()}
                      placeholder="Label-Name..."
                      autoFocus
                      className="w-full rounded border border-gray-200 dark:border-white/10 bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          className={cn(
                            'h-5 w-5 rounded-full border-2 transition-all',
                            newLabelColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateNewLabel}
                        disabled={!newLabelName.trim()}
                        className="flex-1 text-[10px] font-semibold py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      >
                        Erstellen
                      </button>
                      <button
                        onClick={() => { setShowNewLabel(false); setNewLabelName(''); }}
                        className="text-[10px] font-semibold py-1 px-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
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
