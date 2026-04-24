'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  FolderKanban,
  Calendar,
  Users,
  Package,
  Mail,
} from 'lucide-react';
import {
  useProjects,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_COLORS,
  type ProjectCampaignType,
} from '@/hooks/creators/useProjects';
import { CreateProjectModal } from '@/components/creators/CreateProjectModal';

function formatDate(input?: string) {
  if (!input) return '—';
  try {
    return new Date(input).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return input;
  }
}

// ---------------------------------------------------------------------------
// Projects Page
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 shadow-card"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Projekte
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Verwalte deine Kampagnen und lade Creator zu Projekten ein
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Projekt anlegen
        </button>
      </div>

      {/* Projects Grid */}
      {!projects || projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-[var(--card-bg)] text-center py-16">
          <FolderKanban className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Noch keine Projekte vorhanden
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-amber-600 hover:underline"
          >
            Erstes Projekt anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const campaignType = (project.campaignType ?? 'other') as ProjectCampaignType;
            const needed = project.neededCreators ?? 0;
            const filled = project.creators?.length ?? project.creatorIds.length;
            const pending = project.invitationCounts?.pending ?? 0;

            return (
              <button
                key={project.id}
                onClick={() => router.push(`/creators/projects/${project.id}`)}
                className="group text-left rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderKanban className="h-4.5 w-4.5 text-amber-600 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate">
                      {project.name}
                    </h3>
                  </div>
                  <span
                    className="inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{
                      backgroundColor:
                        CAMPAIGN_TYPE_COLORS[campaignType] || '#6B7280',
                    }}
                  >
                    {CAMPAIGN_TYPE_LABELS[campaignType] || campaignType}
                  </span>
                </div>

                {/* Action */}
                {project.action && (
                  <div className="mb-3 inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-mono text-amber-700 dark:text-amber-300">
                    {project.action}
                  </div>
                )}

                {/* Meta rows */}
                <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span>{formatDate(project.startDate ?? project.deadline)}</span>
                  </div>
                  {project.productName && (
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{project.productName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 flex-shrink-0" />
                    <span>
                      {filled}/{needed || '?'} Creator
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    <span>{pending} offene Einladungen</span>
                  </div>
                </div>

                {/* Progress bar */}
                {needed > 0 && (
                  <div className="mt-4">
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{
                          width: `${Math.min(100, (filled / needed) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={(project) => router.push(`/creators/projects/${project.id}`)}
      />
    </div>
  );
}
