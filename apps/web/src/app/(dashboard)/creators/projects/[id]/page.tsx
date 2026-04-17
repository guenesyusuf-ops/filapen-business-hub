'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FolderKanban,
  Calendar,
  Users,
  UserPlus,
  Package,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useProject,
  useProjectInvitations,
  useUpdateProject,
  useDeleteProject,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_COLORS,
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_COLORS,
  type ProjectCampaignType,
  type InvitationStatus,
  type ProjectInvitation,
} from '@/hooks/creators/useProjects';
import { useCreators } from '@/hooks/creators/useCreators';
import { InviteCreatorsModal } from '@/components/creators/InviteCreatorsModal';
import {
  useProjectDocuments,
  useUploadProjectDocument,
  useDeleteProjectDocument,
  type ProjectDocument,
} from '@/hooks/creators/useProjectDocuments';

function formatDate(input?: string) {
  if (!input) return '—';
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

function formatDateTime(input?: string) {
  if (!input) return '—';
  try {
    return new Date(input).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return input;
  }
}

// ---------------------------------------------------------------------------
// Project Detail Page
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: project, isLoading } = useProject(id);
  const { data: invitations, isLoading: invitationsLoading } =
    useProjectInvitations(id);
  const { data: creatorsData } = useCreators({ pageSize: 500 });

  const [showInvite, setShowInvite] = useState(false);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [editNotes, setEditNotes] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [notesInit, setNotesInit] = useState(false);

  // Init notes & deadline from project
  if (project && !notesInit) {
    setEditNotes(project.description || '');
    setEditDeadline(project.deadline?.slice(0, 10) || project.startDate?.slice(0, 10) || '');
    setNotesInit(true);
  }

  const creatorLookup = useMemo(() => {
    const map = new Map<string, any>();
    (creatorsData?.data ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [creatorsData]);

  // Compute stats from invitations
  const stats = useMemo(() => {
    const counts = {
      total: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
    };
    (invitations ?? []).forEach((inv) => {
      counts.total += 1;
      if (inv.status in counts) {
        counts[inv.status as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [invitations]);

  const alreadyInvitedIds = useMemo(
    () => (invitations ?? []).map((inv) => inv.creatorId),
    [invitations],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-24 rounded bg-gray-200 dark:bg-white/10" />
        <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 p-6 shadow-card">
          <div className="h-6 w-60 rounded bg-gray-200 dark:bg-white/10 mb-4" />
          <div className="h-4 w-80 rounded bg-gray-100 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Projekt nicht gefunden
        </p>
        <button
          onClick={() => router.push('/creators/projects')}
          className="mt-3 text-sm text-purple-600 hover:underline"
        >
          Zurück zu den Projekten
        </button>
      </div>
    );
  }

  const campaignType = (project.campaignType ?? 'other') as ProjectCampaignType;
  const needed = project.neededCreators ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push('/creators/projects')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zu den Projekten
      </button>

      {/* Header Card */}
      <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 p-6 shadow-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {project.name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{
                    backgroundColor:
                      CAMPAIGN_TYPE_COLORS[campaignType] || '#6B7280',
                  }}
                >
                  {CAMPAIGN_TYPE_LABELS[campaignType] || campaignType}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar className="h-3 w-3" />
                  {formatDate(project.startDate ?? project.deadline)}
                </span>
                {project.productName && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Package className="h-3 w-3" />
                    {project.productName}
                  </span>
                )}
                {project.action && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-xs font-mono text-amber-700 dark:text-amber-300">
                    {project.action}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Creator einladen
            </button>
            <button
              onClick={() => {
                if (confirm('Projekt wirklich löschen? Alle Einladungen und Dokumente werden entfernt.')) {
                  deleteProject.mutate(id, {
                    onSuccess: () => router.push('/creators/projects'),
                  });
                }
              }}
              disabled={deleteProject.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/30 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Löschen
            </button>
          </div>
        </div>

        {/* Notizen + Deadline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-4 shadow-card dark:shadow-[var(--card-shadow)]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Notizen fuer Creator
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Wichtige Hinweise, Anforderungen..."
              rows={4}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
            />
            <button
              onClick={() => updateProject.mutate({ id, data: { description: editNotes.trim() || undefined } as any })}
              disabled={updateProject.isPending}
              className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {updateProject.isPending ? 'Speichern...' : 'Notiz speichern'}
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] p-4 shadow-card dark:shadow-[var(--card-shadow)]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Deadline
            </label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => {
                setEditDeadline(e.target.value);
                updateProject.mutate({ id, data: { deadline: e.target.value || undefined } as any });
              }}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
            {editDeadline && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Deadline: {formatDate(editDeadline)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Eingeladen"
          value={`${stats.total}${needed ? `/${needed}` : ''}`}
          tint="purple"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Angenommen"
          value={stats.accepted}
          tint="green"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Ausstehend"
          value={stats.pending}
          tint="blue"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Abgelehnt"
          value={stats.declined}
          tint="gray"
        />
      </div>

      {/* Invitations List */}
      <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Einladungen ({invitations?.length ?? 0})
          </h3>
        </div>

        {invitationsLoading ? (
          <div className="text-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mx-auto" />
          </div>
        ) : !invitations || invitations.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Noch keine Einladungen versendet
            </p>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-3 text-sm text-purple-600 hover:underline"
            >
              Jetzt Creator einladen
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {invitations.map((inv) => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                creatorLookup={creatorLookup}
              />
            ))}
          </div>
        )}
      </div>

      {/* Documents Section */}
      <ProjectDocumentsSection projectId={id} />

      {/* Invite Modal */}
      <InviteCreatorsModal
        open={showInvite}
        projectId={id}
        onClose={() => setShowInvite(false)}
        alreadyInvitedIds={alreadyInvitedIds}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tint: 'purple' | 'green' | 'blue' | 'gray' | 'red';
}) {
  const tintClasses = {
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    gray: 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return (
    <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 p-4 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', tintClasses[tint])}>{icon}</div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="text-xl font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents Section
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  briefing: 'Briefings',
  skript: 'Skripte',
  sonstige: 'Sonstige',
};

function ProjectDocumentsSection({ projectId }: { projectId: string }) {
  const { data: documents, isLoading } = useProjectDocuments(projectId);
  const uploadMutation = useUploadProjectDocument();
  const deleteMutation = useDeleteProjectDocument();

  const handleUpload = (type: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadMutation.mutateAsync({ projectId, type, file });
    };
    input.click();
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Dokument wirklich löschen?')) return;
    await deleteMutation.mutateAsync({ projectId, docId });
  };

  const grouped = {
    briefing: (documents ?? []).filter((d) => d.type === 'briefing'),
    skript: (documents ?? []).filter((d) => d.type === 'skript'),
    sonstige: (documents ?? []).filter((d) => d.type === 'sonstige'),
  };

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-white/8 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          Dokumente
        </h3>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mx-auto" />
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {(['briefing', 'skript', 'sonstige'] as const).map((type) => (
            <div key={type} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {DOC_TYPE_LABELS[type]}
                </h4>
                <button
                  onClick={() => handleUpload(type)}
                  disabled={uploadMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 disabled:opacity-40 transition-colors"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  PDF hochladen
                </button>
              </div>
              {grouped[type].length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Keine Dokumente
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {grouped[type].map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 truncate"
                        >
                          {doc.fileName}
                        </a>
                        {doc.fileSize && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {(doc.fileSize / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationRow({
  invitation,
  creatorLookup,
}: {
  invitation: ProjectInvitation;
  creatorLookup: Map<string, any>;
}) {
  const creator = invitation.creator ?? creatorLookup.get(invitation.creatorId);
  const status = invitation.status;
  const name = creator?.name ?? 'Unbekannt';
  const handle = creator?.handle ?? '';
  const platform = creator?.platform ?? '';

  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
          {creator?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={creator.avatarUrl}
              alt={name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {name}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {handle}
            {handle && platform ? ' • ' : ''}
            {platform}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="hidden md:block text-right text-[11px] text-gray-500 dark:text-gray-400">
          <div>Eingeladen: {formatDateTime(invitation.invitedAt)}</div>
          {invitation.respondedAt && (
            <div>Antwort: {formatDateTime(invitation.respondedAt)}</div>
          )}
        </div>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{
            backgroundColor:
              INVITATION_STATUS_COLORS[status as InvitationStatus] || '#6B7280',
          }}
        >
          {INVITATION_STATUS_LABELS[status as InvitationStatus] || status}
        </span>
      </div>
    </div>
  );
}
