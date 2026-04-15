'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Plus, FolderKanban, Users, ListChecks, BarChart3, CheckCircle2, AlertTriangle, CalendarClock, Tag } from 'lucide-react';
import { useWmProjects, useCreateWmProject } from '@/hooks/work-management/useWm';
import { useWmDashboard, useUpdateProjectCategory, useWmProjectsWithCategory } from '@/hooks/work-management/useWmDashboard';
import { CreateProjectModal } from '@/components/work-management/CreateProjectModal';

const PROJECT_CATEGORIES = ['Alle', 'Marketing', 'Produkt', 'Intern', 'Vertrieb', 'Sonstige'] as const;

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  alert?: boolean;
}

function KpiCard({ label, value, icon: Icon, iconColor, bgColor, alert }: KpiCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-center gap-4 transition-all',
      alert && value > 0
        ? 'border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10'
        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)]',
    )}>
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg', bgColor)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div>
        <p className={cn(
          'text-2xl font-bold',
          alert && value > 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white',
        )}>
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export default function WorkManagementPage() {
  const { data: projects, isLoading, error } = useWmProjects();
  const { data: dashboard } = useWmDashboard();
  const { data: projectsWithCat } = useWmProjectsWithCategory();
  const createProject = useCreateWmProject();
  const updateCategory = useUpdateProjectCategory();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [showCategoryPicker, setShowCategoryPicker] = useState<string | null>(null);

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
    const cat = categoryMap.get(p.id);
    return cat === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Projekte und Aufgaben verwalten</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Neues Projekt
        </button>
      </div>

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Offene Aufgaben"
            value={dashboard.totalOpen}
            icon={ListChecks}
            iconColor="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-100 dark:bg-blue-900/30"
          />
          <KpiCard
            label="Erledigt (7 Tage)"
            value={dashboard.completedLast7Days}
            icon={CheckCircle2}
            iconColor="text-green-600 dark:text-green-400"
            bgColor="bg-green-100 dark:bg-green-900/30"
          />
          <KpiCard
            label="Ueberfaellig"
            value={dashboard.overdue}
            icon={AlertTriangle}
            iconColor="text-red-600 dark:text-red-400"
            bgColor="bg-red-100 dark:bg-red-900/30"
            alert
          />
          <KpiCard
            label="Faellig heute"
            value={dashboard.dueToday}
            icon={CalendarClock}
            iconColor="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-100 dark:bg-orange-900/30"
          />
        </div>
      )}

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tag className="h-4 w-4 text-gray-400" />
        {PROJECT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
              selectedCategory === cat
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-[var(--card-bg,#1a1d2e)] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-primary-300 dark:hover:border-primary-500/40',
            )}
          >
            {cat}
          </button>
        ))}
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
              : 'Weise einem Projekt diese Kategorie zu oder erstelle ein neues.'}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {selectedCategory === 'Alle' ? 'Erstes Projekt erstellen' : 'Neues Projekt'}
          </button>
        </div>
      )}

      {/* Project grid */}
      {!isLoading && !error && filteredProjects && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

                <Link
                  href={`/work-management/${project.id}`}
                  className="block p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
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
                      {cat ? 'Aendern' : '+ Kategorie'}
                    </button>
                    {showCategoryPicker === project.id && (
                      <div className="absolute bottom-full left-0 mb-1 z-20 bg-white dark:bg-[#1a1d2e] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1 min-w-[120px]">
                        {['Keine', 'Marketing', 'Produkt', 'Intern', 'Vertrieb', 'Sonstige'].map((c) => (
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
    </div>
  );
}
