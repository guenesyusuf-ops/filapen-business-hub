'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Plus, FolderKanban, Users, ListChecks, BarChart3, CheckCircle2, AlertTriangle, CalendarClock, Tag, Bell, X, Trash2, ShieldCheck, Loader2, Flag, Calendar } from 'lucide-react';
import { useWmProjects, useCreateWmProject, useDeleteWmProject, useWmMembers } from '@/hooks/work-management/useWm';
import { useWmDashboard, useUpdateProjectCategory, useWmProjectsWithCategory, useWmNotifications, useWmUnreadCount, useMarkNotificationRead, useMarkAllNotificationsRead, useWmBucketTasks, type WmBucket } from '@/hooks/work-management/useWmDashboard';
import { useWmCategories, useCreateWmCategory, useDeleteWmCategory, useCreateApprovalProject } from '@/hooks/work-management/useWmApproval';
import { CreateProjectModal } from '@/components/work-management/CreateProjectModal';
import { CreateApprovalProjectModal } from '@/components/work-management/CreateApprovalProjectModal';
import { useAuthStore } from '@/stores/auth';

// Categories are now loaded from the DB (admin can add/remove via + button)
// Fallback defaults only used before first load.

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  alert?: boolean;
  onClick?: () => void;
}

function KpiCard({ label, value, icon: Icon, iconColor, bgColor, alert, onClick }: KpiCardProps) {
  const base = cn(
    'rounded-xl border p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all text-left w-full',
    alert && value > 0
      ? 'border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10'
      : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)]',
    onClick && 'hover:border-primary-400 dark:hover:border-primary-500/60 hover:shadow-sm cursor-pointer',
  );
  const content = (
    <>
      <div className={cn('flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex-shrink-0', bgColor)}>
        <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn(
          'text-xl sm:text-2xl font-bold',
          alert && value > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white',
        )}>
          {value}
        </p>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
      </div>
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className={base}>{content}</button>;
  }
  return <div className={base}>{content}</div>;
}

export default function WorkManagementPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const { data: projects, isLoading, error } = useWmProjects();
  const { data: dashboard } = useWmDashboard();
  const { data: projectsWithCat } = useWmProjectsWithCategory();
  const { data: categories = [] } = useWmCategories();
  const createCategory = useCreateWmCategory();
  const createProject = useCreateWmProject();
  const deleteProject = useDeleteWmProject();
  const updateCategory = useUpdateProjectCategory();
  const { data: notifications } = useWmNotifications();
  const { data: unreadCount } = useWmUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [showCategoryPicker, setShowCategoryPicker] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCreateApproval, setShowCreateApproval] = useState(false);
  const createApprovalProject = useCreateApprovalProject();
  const [bucketOpen, setBucketOpen] = useState<WmBucket | null>(null);

  const categoryNames = ['Alle', ...categories.map((c) => c.name)];

  function handleCreate(data: { name: string; description: string; color: string }) {
    createProject.mutate(data, {
      onSuccess: () => setShowCreate(false),
    });
  }

  function handleSetCategory(projectId: string, category: string) {
    const cat = category === 'Keine' ? null : category;
    updateCategory.mutate({ projectId, category: cat });
    setShowCategoryPicker(null);
  }

  // Build a category map from the raw SQL results
  const categoryMap = new Map<string, string | null>();
  if (projectsWithCat) {
    for (const p of projectsWithCat) {
      categoryMap.set(p.id, p.category);
    }
  }

  // Filter projects by category
  const filteredProjects = projects?.filter((p) => {
    if (selectedCategory === 'Alle') return true;
    // Check both the raw SQL category map AND the Prisma-level category
    const cat = categoryMap.get(p.id) ?? (p as any).category;
    // For "Abnahmen" also match by projectType
    if (selectedCategory === 'Abnahmen' && (p as any).projectType === 'approval') return true;
    return cat === selectedCategory;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1] truncate">Aufgabenverwaltung</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">Projekte und Aufgaben verwalten</p>
          </div>
          {/* Notification Bell */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <Bell className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            {(unreadCount?.count ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount!.count > 99 ? '99+' : unreadCount!.count}
              </span>
            )}
          </button>
        </div>
        {/* Action buttons — stacked on mobile, inline on desktop */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateApproval(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs sm:text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Abnahme
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg bg-primary-600 text-white text-xs sm:text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Neues Projekt
          </button>
        </div>
      </div>

      {/* Notification Panel */}
      {showNotifications && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Benachrichtigungen
              {(unreadCount?.count ?? 0) > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({unreadCount!.count} ungelesen)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {(unreadCount?.count ?? 0) > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                >
                  Alle gelesen
                </button>
              )}
              <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {(!notifications || notifications.length === 0) ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Keine Benachrichtigungen
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors',
                    !n.read && 'bg-primary-50/50 dark:bg-primary-900/10',
                  )}
                  onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                >
                  <div className={cn(
                    'mt-0.5 h-2 w-2 rounded-full flex-shrink-0',
                    n.read ? 'bg-transparent' : 'bg-primary-500',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(n.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <KpiCard
            label="Offene Aufgaben"
            value={dashboard.totalOpen}
            icon={ListChecks}
            iconColor="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-100 dark:bg-blue-900/30"
            onClick={() => setBucketOpen('open')}
          />
          <KpiCard
            label="Erledigt (7 Tage)"
            value={dashboard.completedLast7Days}
            icon={CheckCircle2}
            iconColor="text-green-600 dark:text-green-400"
            bgColor="bg-green-100 dark:bg-green-900/30"
            onClick={() => setBucketOpen('completed7d')}
          />
          <KpiCard
            label="Überfällig"
            value={dashboard.overdue}
            icon={AlertTriangle}
            iconColor="text-red-600 dark:text-red-400"
            bgColor="bg-red-100 dark:bg-red-900/30"
            alert
            onClick={() => setBucketOpen('overdue')}
          />
          <KpiCard
            label="Fällig heute"
            value={dashboard.dueToday}
            icon={CalendarClock}
            iconColor="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-100 dark:bg-orange-900/30"
            onClick={() => setBucketOpen('today')}
          />
        </div>
      )}

      {/* KPI-Tile Detail Modal */}
      <BucketTasksModal bucket={bucketOpen} onClose={() => setBucketOpen(null)} />


      {/* Category Filter */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        <Tag className="h-4 w-4 text-gray-400 flex-shrink-0 hidden sm:block" />
        {categoryNames.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap flex-shrink-0',
              selectedCategory === cat
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-[var(--card-bg,#1a1d2e)] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-500/40',
            )}
          >
            {cat}
          </button>
        ))}
        {/* Admin: + Button to add category */}
        {isAdmin && !showAddCategory && (
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border-2 border-dashed border-gray-300 dark:border-white/10 text-gray-400 hover:text-primary-500 hover:border-primary-300 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
        {isAdmin && showAddCategory && (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) {
                  createCategory.mutate(newCategoryName.trim());
                  setNewCategoryName('');
                  setShowAddCategory(false);
                }
                if (e.key === 'Escape') {
                  setNewCategoryName('');
                  setShowAddCategory(false);
                }
              }}
              placeholder="Neue Kategorie..."
              className="rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button
              onClick={() => { setNewCategoryName(''); setShowAddCategory(false); }}
              className="text-gray-400 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
          Fehler beim Laden der Projekte. Bitte versuche es erneut.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredProjects && filteredProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {selectedCategory === 'Alle' ? 'Noch keine Projekte' : `Keine Projekte in "${selectedCategory}"`}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {selectedCategory === 'Alle'
              ? 'Erstelle dein erstes Projekt, um Aufgaben zu organisieren.'
              : selectedCategory === 'Abnahmen'
                ? 'Erstelle ein Abnahme-Projekt mit Genehmiger-Kette.'
                : 'Weise einem Projekt diese Kategorie zu oder erstelle ein neues.'}
          </p>
          {selectedCategory === 'Abnahmen' ? (
            <button
              onClick={() => setShowCreateApproval(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Abnahme-Projekt erstellen
            </button>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {selectedCategory === 'Alle' ? 'Erstes Projekt erstellen' : 'Neues Projekt'}
            </button>
          )}
        </div>
      )}

      {/* Project grid */}
      {!isLoading && !error && filteredProjects && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredProjects.map((project) => {
            const cat = categoryMap.get(project.id);
            return (
              <div
                key={project.id}
                className="group relative rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] overflow-hidden hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-500/40 transition-all duration-200"
              >
                {/* Color header */}
                <div
                  className="h-2"
                  style={{ backgroundColor: project.color }}
                />

                {/* Delete button (hover) */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Projekt "${project.name}" wirklich löschen? Alle Tasks, Spalten und Daten gehen verloren.`)) {
                      deleteProject.mutate(project.id);
                    }
                  }}
                  className="absolute top-3 right-3 p-1 rounded-md bg-red-500/80 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all z-10"
                  title="Projekt löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <Link
                  href={`/work-management/${project.id}`}
                  className="block p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    {(project as any).projectType === 'approval' && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
                        <ShieldCheck className="h-3 w-3" />
                        Abnahme
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-1">
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <ListChecks className="h-3.5 w-3.5" />
                      {project.taskCount} Aufgaben
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {project.memberCount} Mitglieder
                    </span>
                  </div>
                </Link>

                {/* Category badge + picker */}
                <div className="px-4 pb-3 flex items-center gap-2">
                  {cat && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {cat}
                    </span>
                  )}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowCategoryPicker(showCategoryPicker === project.id ? null : project.id);
                      }}
                      className="text-[10px] text-gray-400 hover:text-primary-500 transition-colors"
                    >
                      {cat ? 'Ändern' : '+ Kategorie'}
                    </button>
                    {showCategoryPicker === project.id && (
                      <div className="absolute bottom-full left-0 mb-1 z-20 bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1 min-w-[120px]">
                        {['Keine', ...categories.map((c) => c.name)].map((c) => (
                          <button
                            key={c}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSetCategory(project.id, c);
                            }}
                            className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        loading={createProject.isPending}
      />

      {/* Create approval project modal */}
      <CreateApprovalProjectModal
        open={showCreateApproval}
        onClose={() => setShowCreateApproval(false)}
        onSubmit={(data) => {
          createApprovalProject.mutate(data, {
            onSuccess: () => setShowCreateApproval(false),
            onError: (err: any) => {
              alert(`Fehler: ${err?.message || 'Projekt konnte nicht erstellt werden'}`);
            },
          });
        }}
        loading={createApprovalProject.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bucket Tasks Modal (opened when a KPI tile is clicked)
// ---------------------------------------------------------------------------

const BUCKET_LABELS: Record<WmBucket, { title: string; hint: string; empty: string }> = {
  open: {
    title: 'Offene Aufgaben',
    hint: 'Alle noch nicht erledigten Aufgaben im gesamten Workspace.',
    empty: 'Keine offenen Aufgaben — alles erledigt!',
  },
  overdue: {
    title: 'Überfällige Aufgaben',
    hint: 'Aufgaben mit Fälligkeitsdatum in der Vergangenheit, die noch offen sind.',
    empty: 'Keine überfälligen Aufgaben.',
  },
  today: {
    title: 'Heute fällig',
    hint: 'Offene Aufgaben mit Fälligkeit am heutigen Tag.',
    empty: 'Heute ist nichts fällig.',
  },
  completed7d: {
    title: 'Erledigt in den letzten 7 Tagen',
    hint: 'Aufgaben, die in den letzten 7 Tagen abgeschlossen wurden.',
    empty: 'Keine kürzlich erledigten Aufgaben.',
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function BucketTasksModal({ bucket, onClose }: { bucket: WmBucket | null; onClose: () => void }) {
  const { data: tasks, isLoading } = useWmBucketTasks(bucket);
  if (!bucket) return null;
  const meta = BUCKET_LABELS[bucket];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 modal-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 modal-panel flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{meta.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meta.hint}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lädt …
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {meta.empty}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/work-management/${t.projectId}?task=${t.id}`}
                    onClick={onClose}
                    className="block px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{t.title}</div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-gray-500">
                          {t.project && (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.project.color || '#3B82F6' }} />
                              {t.project.name}
                            </span>
                          )}
                          {t.dueDate && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(t.dueDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          )}
                          {t.assigneeName && <span className="truncate">Zuständig: {t.assigneeName}</span>}
                        </div>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0', PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium)}>
                        <Flag className="h-3 w-3" />
                        {t.priority}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 text-right flex-shrink-0">
          {tasks ? `${tasks.length} Aufgabe${tasks.length === 1 ? '' : 'n'}` : ''}
        </div>
      </div>
    </div>
  );
}
