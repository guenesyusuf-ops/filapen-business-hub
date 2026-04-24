'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  Calendar,
  Package,
  FileText,
  Download,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCreatorInvitations,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_COLORS,
  type ProjectCampaignType,
} from '@/hooks/creators/useProjects';
import { API_URL } from '@/lib/api';

const API_BASE = `${API_URL}/api`;

function formatDate(input?: string) {
  if (!input) return '--';
  try {
    return new Date(input).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return input;
  }
}

interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  status: string;
  deadline?: string;
  campaignType?: string;
  action?: string;
  startDate?: string;
  neededCreators?: number;
  product?: {
    id: string;
    title: string;
    imageUrl?: string;
    handle?: string;
  };
  notes?: string;
  documents: {
    briefing: DocItem[];
    skript: DocItem[];
    sonstige: DocItem[];
  };
}

interface DocItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  type: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  archived: 'Archiviert',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#059669',
  paused: '#D97706',
  completed: '#2563EB',
  archived: '#6B7280',
};

export default function PortalDealsPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        const c = JSON.parse(stored);
        setCreatorId(c.id);
      } catch {
        router.push('/creator-portal');
      }
    } else {
      router.push('/creator-portal');
    }
  }, [router]);

  const {
    data: invitations,
    isLoading,
  } = useCreatorInvitations(creatorId ?? undefined);

  // Filter only accepted invitations = "Projekte"
  const acceptedInvitations = (invitations ?? []).filter(
    (inv) => inv.status === 'accepted',
  );

  const fetchProjectDetail = useCallback(
    async (projectId: string) => {
      if (!creatorId) return;
      setDetailLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/creator/portal/project/${projectId}?creatorId=${creatorId}`,
        );
        if (res.ok) {
          const data = await res.json();
          setProjectDetail(data);
          setSelectedProjectId(projectId);
        }
      } catch {
        // ignore
      } finally {
        setDetailLoading(false);
      }
    },
    [creatorId],
  );

  if (!creatorId) return null;

  // Detail view
  if (selectedProjectId && projectDetail) {
    const ct = (projectDetail.campaignType ?? 'other') as ProjectCampaignType;
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => {
            setSelectedProjectId(null);
            setProjectDetail(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zu Meine Projekte
        </button>

        {/* Header */}
        <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 shadow-card p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {projectDetail.name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{
                    backgroundColor: CAMPAIGN_TYPE_COLORS[ct] || '#6B7280',
                  }}
                >
                  {CAMPAIGN_TYPE_LABELS[ct] || ct}
                </span>
                {projectDetail.deadline && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    Deadline: {formatDate(projectDetail.deadline)}
                  </span>
                )}
                {projectDetail.action && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-mono text-amber-700">
                    {projectDetail.action}
                  </span>
                )}
                {projectDetail.product && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Package className="h-3 w-3" />
                    {projectDetail.product.title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {projectDetail.notes && (
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 shadow-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Notizen
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {projectDetail.notes}
            </p>
          </div>
        )}

        {/* Documents */}
        {(['briefing', 'skript', 'sonstige'] as const).map((type) => {
          const docs = projectDetail.documents?.[type] ?? [];
          if (docs.length === 0) return null;
          const label =
            type === 'briefing'
              ? 'Briefings'
              : type === 'skript'
                ? 'Skripte'
                : 'Sonstige';
          return (
            <div
              key={type}
              className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 shadow-card p-5"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {label}
              </h3>
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">
                        {doc.fileName}
                      </span>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-100 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Herunterladen
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Meine Projekte</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Projekte, die du angenommen hast
        </p>
      </div>

      {isLoading || detailLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : acceptedInvitations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 dark:border-white/10">
          <FolderKanban className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            Noch keine Projekte
          </p>
          <p className="text-xs text-gray-500">
            Nimm eine Einladung an, um hier dein erstes Projekt zu sehen
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {acceptedInvitations.map((inv) => {
            const project = inv.project;
            if (!project) return null;
            const ct = (project.campaignType ?? 'other') as ProjectCampaignType;
            return (
              <div
                key={inv.id}
                className="rounded-xl bg-white dark:bg-white/5 p-5 border border-gray-200 hover:border-amber-200 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => fetchProjectDetail(project.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{
                            backgroundColor:
                              CAMPAIGN_TYPE_COLORS[ct] || '#6B7280',
                          }}
                        >
                          {CAMPAIGN_TYPE_LABELS[ct] || ct}
                        </span>
                        {project.startDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {formatDate(project.startDate)}
                          </span>
                        )}
                        {project.productName && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Package className="h-3 w-3" />
                            {project.productName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-amber-600 hover:underline flex-shrink-0">
                    Details anzeigen &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
