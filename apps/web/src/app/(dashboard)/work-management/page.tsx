'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Plus, FolderKanban, Users, ListChecks } from 'lucide-react';
import { useWmProjects, useCreateWmProject } from '@/hooks/work-management/useWm';
import { CreateProjectModal } from '@/components/work-management/CreateProjectModal';

export default function WorkManagementPage() {
  const { data: projects, isLoading, error } = useWmProjects();
  const createProject = useCreateWmProject();
  const [showCreate, setShowCreate] = useState(false);

  function handleCreate(data: { name: string; description: string; color: string }) {
    createProject.mutate(data, {
      onSuccess: () => setShowCreate(false),
    });
  }

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
      {!isLoading && !error && projects && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Noch keine Projekte</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Erstelle dein erstes Projekt, um Aufgaben zu organisieren.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Erstes Projekt erstellen
          </button>
        </div>
      )}

      {/* Project grid */}
      {!isLoading && !error && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/work-management/${project.id}`}
              className="group rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg,#1a1d2e)] overflow-hidden hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-500/40 transition-all duration-200"
            >
              {/* Color header */}
              <div
                className="h-2"
                style={{ backgroundColor: project.color }}
              />

              <div className="p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                  {project.name}
                </h3>

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
              </div>
            </Link>
          ))}
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
