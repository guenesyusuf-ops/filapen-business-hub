'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import {
  ArrowLeft,
  Camera,
  Music,
  Play,
  UserCircle,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Edit,
  Handshake,
  Tag,
  Upload,
  Copy,
  Check,
  FileText,
  Image,
  Video,
  Link2,
  Baby,
  Banknote,
  Loader2,
  MailPlus,
  Trash2,
  Radio,
  Power,
  Calendar,
  X,
  Plus,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDollars, formatNumber } from '@filapen/shared/src/utils/money';
import { useCreator, useUpdateCreator, useResendInvite, useDeleteCreator } from '@/hooks/creators/useCreators';
import { useDeals, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/hooks/creators/useDeals';
import type { DealStage } from '@/hooks/creators/useDeals';
import {
  useCreatorUploads,
  useAllUploads,
  useUploadFolders,
  useDeleteUpload,
  useGoLiveUpload,
  useGoOfflineUpload,
  UPLOAD_TABS,
  UPLOAD_TAB_LABELS,
} from '@/hooks/creators/useUploads';
import type { UploadTab, CreatorUpload, UploadFolder } from '@/hooks/creators/useUploads';
import { Lightbox } from '@/components/creators/Lightbox';
import { UploadZone } from '@/components/creators/UploadZone';
import { ChatWidget } from '@/components/creators/ChatWidget';
import { AvatarUpload } from '@/components/creators/AvatarUpload';
import { CreatorFormModal } from '@/components/creators/CreatorFormModal';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  prospect: 'bg-blue-50 text-blue-700 border-blue-200',
  outreach: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
};

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    instagram: {
      icon: <Camera className="h-3.5 w-3.5" />,
      label: 'Instagram',
      className: 'bg-orange-50 text-orange-600 border-orange-200',
    },
    tiktok: {
      icon: <Music className="h-3.5 w-3.5" />,
      label: 'TikTok',
      className: 'bg-gray-50 text-gray-800 border-gray-300',
    },
    youtube: {
      icon: <Play className="h-3.5 w-3.5" />,
      label: 'YouTube',
      className: 'bg-red-50 text-red-600 border-red-200',
    },
    twitter: {
      icon: <UserCircle className="h-3.5 w-3.5" />,
      label: 'Twitter',
      className: 'bg-blue-50 text-blue-500 border-blue-200',
    },
  };
  const c = config[platform] ?? config.twitter;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', c!.className)}>
      {c!.icon}
      {c!.label}
    </span>
  );
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-24 rounded bg-gray-200" />
      <div className="rounded-xl bg-white p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 shadow-card">
            <div className="h-3 w-20 rounded bg-gray-200 mb-2" />
            <div className="h-6 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CreatorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const id = params.id as string;
  const currentUserName = user?.name || user?.email?.split('@')[0] || 'Admin';

  const { data: creator, isLoading } = useCreator(id);
  const { data: deals } = useDeals({ creatorId: id });
  const updateMutation = useUpdateCreator();
  const resendMutation = useResendInvite();
  const deleteMutation = useDeleteCreator();

  const [activeTab, setActiveTab] = useState<'overview' | 'uploads' | 'deals' | 'activity'>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [uploadTab, setUploadTab] = useState<UploadTab>('bilder');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [lightboxUpload, setLightboxUpload] = useState<CreatorUpload | null>(null);
  const [activeBatch, setActiveBatch] = useState<string | null>(null);
  const [activeBatchName, setActiveBatchName] = useState<string>('');
  const [folderPage, setFolderPage] = useState(1);

  const { data: uploads } = useCreatorUploads(id, uploadTab);
  const { data: creatorFoldersData } = useUploadFolders({ creatorId: id, tab: uploadTab });
  const creatorFolders = creatorFoldersData?.folders;
  const { data: batchFiles } = useAllUploads({
    batch: activeBatch ?? undefined,
    creatorId: id,
    tab: uploadTab,
    page: folderPage,
    pageSize: 24,
  });
  const deleteUpload = useDeleteUpload();
  const goLiveMutation = useGoLiveUpload();
  const goOfflineMutation = useGoOfflineUpload();

  const [goLiveUploadId, setGoLiveUploadId] = useState<string | null>(null);
  const [goLiveDate, setGoLiveDate] = useState('');
  const [showAddContract, setShowAddContract] = useState(false);
  const [contractName, setContractName] = useState('');
  const [contractUrl, setContractUrl] = useState('');
  const [deleteUploadConfirm, setDeleteUploadConfirm] = useState<string | null>(null);

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleResendInvite = useCallback(() => {
    if (!creator?.id) return;
    setResendStatus('sending');
    resendMutation.mutate(creator.id, {
      onSuccess: () => setResendStatus('sent'),
      onError: () => setResendStatus('error'),
    });
  }, [creator?.id, resendMutation]);

  const handleCopyInviteCode = useCallback(() => {
    if (!creator?.inviteCode) return;
    navigator.clipboard.writeText(creator.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [creator?.inviteCode]);

  const handleDeleteUpload = useCallback(
    (uploadId: string) => {
      if (confirm('Delete this upload?')) {
        deleteUpload.mutate(uploadId);
        setLightboxUpload(null);
      }
    },
    [deleteUpload],
  );

  const handleSaveNotes = useCallback(() => {
    if (!creator) return;
    updateMutation.mutate({ id: creator.id, data: { notes } });
    setEditingNotes(false);
  }, [creator, notes, updateMutation]);

  const handleGoLive = useCallback(() => {
    if (!goLiveUploadId || !goLiveDate) return;
    goLiveMutation.mutate(
      { uploadId: goLiveUploadId, liveDate: goLiveDate },
      {
        onSuccess: () => {
          setGoLiveUploadId(null);
          setGoLiveDate('');
        },
      },
    );
  }, [goLiveUploadId, goLiveDate, goLiveMutation]);

  const handleGoOffline = useCallback((uploadId: string) => {
    if (confirm('Content offline setzen?')) {
      goOfflineMutation.mutate(uploadId);
    }
  }, [goOfflineMutation]);

  const handleConfirmDeleteUpload = useCallback(() => {
    if (!deleteUploadConfirm) return;
    deleteUpload.mutate(deleteUploadConfirm);
    setDeleteUploadConfirm(null);
    setLightboxUpload(null);
  }, [deleteUploadConfirm, deleteUpload]);

  const handleAddContract = useCallback(() => {
    if (!creator || !contractName) return;
    const existing = Array.isArray(creator.contracts) ? creator.contracts : [];
    const newContracts = [
      ...existing,
      { name: contractName, url: contractUrl || '', uploadedAt: new Date().toISOString() },
    ];
    updateMutation.mutate(
      { id: creator.id, data: { contracts: newContracts } as any },
      {
        onSuccess: () => {
          setContractName('');
          setContractUrl('');
          setShowAddContract(false);
        },
      },
    );
  }, [creator, contractName, contractUrl, updateMutation]);

  const handleDeleteContract = useCallback((index: number) => {
    if (!creator) return;
    const existing = Array.isArray(creator.contracts) ? [...creator.contracts] : [];
    existing.splice(index, 1);
    updateMutation.mutate({ id: creator.id, data: { contracts: existing } as any });
  }, [creator, updateMutation]);

  if (isLoading) return <DetailSkeleton />;
  if (!creator) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">Creator not found</p>
        <button
          onClick={() => router.push('/creators/list')}
          className="mt-3 text-sm text-accent-creator hover:underline"
        >
          Back to creators
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => router.push('/creators/list')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Creators
      </button>

      {/* Header Card */}
      <div className="rounded-xl bg-white p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <AvatarUpload
              creatorId={creator.id}
              name={creator.name}
              currentAvatarUrl={creator.avatarUrl}
              size={80}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{creator.name}</h1>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                    STATUS_BADGE_STYLES[creator.status],
                  )}
                >
                  {creator.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{creator.handle}</p>
              <div className="flex items-center gap-2 mt-2">
                <PlatformBadge platform={creator.platform} />
                <span className="text-xs text-gray-400">
                  {formatFollowers(creator.followers)} followers &middot; {creator.engagementRate}% engagement
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center justify-center h-10 w-10 rounded-lg text-sm font-bold',
                creator.score >= 90
                  ? 'bg-emerald-50 text-emerald-700'
                  : creator.score >= 80
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-amber-50 text-amber-700',
              )}
            >
              {creator.score}
            </span>
            <button
              onClick={() => router.push(`/creators/deals?action=new&creatorId=${creator.id}`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark transition-colors"
            >
              <Handshake className="h-3.5 w-3.5" />
              Create Deal
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
              Creator bearbeiten
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Löschen
            </button>
          </div>

        </div>
      </div>

      {/* Edit Creator Modal */}
      <CreatorFormModal
        open={showEditModal}
        mode="edit"
        creator={creator}
        onClose={() => setShowEditModal(false)}
      />

      {/* Delete Confirmation — rendered outside the header card to avoid flex layout issues */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 animate-scale-in">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-white">Delete Creator?</h3>
            <p className="text-center text-sm text-gray-500 mt-2">
              This will permanently delete <strong>{creator.name}</strong> and revoke their portal access. All deals, uploads, and chat history will also be removed.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate(creator.id, {
                    onSuccess: () => router.push('/creators/list'),
                    onError: (err) => {
                      console.error('Delete failed:', err);
                      alert('Failed to delete creator. Please try again.');
                      setShowDeleteConfirm(false);
                    },
                  });
                }}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? 'Wird gelöscht...' : 'Creator löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact */}
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Contact</h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-700">{creator.email}</span>
            </div>
            {creator.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-700">{creator.phone}</span>
              </div>
            )}
            {creator.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-700">{creator.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rates */}
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Rates</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Per Post</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {creator.ratePerPost ? formatDollars(creator.ratePerPost) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Per Video</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {creator.ratePerVideo ? formatDollars(creator.ratePerVideo) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Performance</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Deals</span>
              <span className="font-medium text-gray-900 dark:text-white">{creator.totalDeals}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Spend</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatDollars(creator.totalSpend)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Avg Engagement</span>
              <span className="font-medium text-gray-900 dark:text-white">{creator.avgEngagement}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Code + Compensation + Kids Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Invite Code + Portal Access */}
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Creator Portal</h3>
          {creator.inviteCode ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-400 uppercase mb-1">Invite Code</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono font-bold text-amber-700 tracking-widest">
                    {creator.inviteCode}
                  </code>
                  <button
                    onClick={handleCopyInviteCode}
                    className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Copy invite code"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-400 uppercase mb-1">Invite Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/creator-portal?code=${creator.inviteCode}`}
                    className="flex-1 rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5 text-[11px] font-mono text-gray-600"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/creator-portal?code=${creator.inviteCode}`;
                      navigator.clipboard.writeText(link);
                      handleCopyInviteCode();
                    }}
                    className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Copy invite link"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${creator.lastLogin ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-500">
                    {creator.lastLogin ? 'Portal accessed' : 'Not yet accessed'}
                  </span>
                </div>
                {creator.lastLogin && (
                  <span className="text-[10px] text-gray-400">
                    Last: {new Date(creator.lastLogin).toLocaleDateString()} {new Date(creator.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {/* Resend Invite */}
              <button
                onClick={handleResendInvite}
                disabled={resendStatus === 'sending'}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {resendStatus === 'sending' ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</>
                ) : resendStatus === 'sent' ? (
                  <><Check className="h-3 w-3 text-green-600" /> Invite Resent</>
                ) : resendStatus === 'error' ? (
                  <><MailPlus className="h-3 w-3 text-red-500" /> Failed - Retry</>
                ) : (
                  <><MailPlus className="h-3 w-3" /> Resend Invite</>
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No invite code</p>
          )}
        </div>

        {/* Compensation */}
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
            <Banknote className="h-3 w-3" />
            Compensation
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Type</span>
              <span className="font-medium text-gray-900 capitalize">{creator.compensation || 'Not set'}</span>
            </div>
            {creator.provision && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Provision</span>
                <span className="font-medium text-gray-900 dark:text-white">{creator.provision}</span>
              </div>
            )}
            {creator.fixAmount != null && creator.fixAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Fix Amount</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatDollars(creator.fixAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Kids Info */}
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
            <Baby className="h-3 w-3" />
            Kids
          </h3>
          {creator.kids ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Has Kids</span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Yes</span>
              </div>
              {creator.kidsAges && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ages</span>
                  <span className="font-medium text-gray-900 dark:text-white">{creator.kidsAges}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Kids on Video</span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', creator.kidsOnVideo ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500')}>
                  {creator.kidsOnVideo ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No kids info</p>
          )}
        </div>
      </div>

      {/* Contracts / Vertrage */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Vertr&auml;ge
          </h3>
          <button
            onClick={() => setShowAddContract(true)}
            className="inline-flex items-center gap-1 text-xs text-accent-creator hover:underline"
          >
            <Plus className="h-3 w-3" />
            Vertrag hinzuf&uuml;gen
          </button>
        </div>
        {creator.contracts && Array.isArray(creator.contracts) && creator.contracts.length > 0 ? (
          <div className="space-y-2">
            {(creator.contracts as any[]).map((contract: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700"
              >
                <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                {contract.url ? (
                  <a
                    href={contract.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 hover:text-accent-creator hover:underline truncate"
                  >
                    {contract.name || 'Vertrag'}
                  </a>
                ) : (
                  <span className="flex-1 truncate">{contract.name || 'Vertrag'}</span>
                )}
                {contract.uploadedAt && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(contract.uploadedAt).toLocaleDateString('de-DE')}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (confirm('Vertrag entfernen?')) handleDeleteContract(i);
                  }}
                  className="shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Keine Vertr&auml;ge vorhanden</p>
        )}
      </div>

      {/* Add Contract Modal */}
      {showAddContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddContract(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Vertrag hinzuf&uuml;gen</h3>
              <button onClick={() => setShowAddContract(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="z.B. Rahmenvertrag 2026"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">URL / Referenz (optional)</label>
                <input
                  type="text"
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                  placeholder="https://... oder Dateiname"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddContract(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddContract}
                disabled={!contractName || updateMutation.isPending}
                className="flex-1 rounded-lg bg-accent-creator px-4 py-2 text-sm font-medium text-white hover:bg-accent-creator-dark disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags */}
      {creator.tags.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
            <Tag className="h-3 w-3" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {creator.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-accent-creator-light px-2.5 py-0.5 text-xs font-medium text-accent-creator"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="rounded-xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Notes</h3>
          {!editingNotes && (
            <button
              onClick={() => {
                setNotes(creator.notes ?? '');
                setEditingNotes(true);
              }}
              className="text-xs text-accent-creator hover:underline flex items-center gap-1"
            >
              <Edit className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-creator/30 focus:border-accent-creator resize-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setEditingNotes(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="rounded-lg bg-accent-creator px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-creator-dark"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            {creator.notes || 'No notes yet.'}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-white shadow-card overflow-hidden">
        <div className="flex border-b border-border">
          {(['overview', 'uploads', 'deals', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-accent-creator text-accent-creator'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab === 'deals' ? `Deals (${deals?.length ?? 0})` : tab === 'uploads' ? `Uploads (${uploads?.length ?? 0})` : tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-5 space-y-4">
            {/* Creator Notes (visible to creator) */}
            {creator.creatorNotes && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
                <h4 className="text-xs font-medium uppercase tracking-wider text-amber-600 mb-1">Notes for Creator</h4>
                <p className="text-sm text-amber-800">{creator.creatorNotes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{creator.totalDeals}</p>
                <p className="text-xs text-gray-500">Total Deals</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDollars(creator.totalSpend)}</p>
                <p className="text-xs text-gray-500">Total Spend</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{creator.engagementRate ?? 0}%</p>
                <p className="text-xs text-gray-500">Engagement Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{uploads?.length ?? 0}</p>
                <p className="text-xs text-gray-500">Uploads</p>
              </div>
            </div>
          </div>
        )}

        {/* Uploads Tab */}
        {activeTab === 'uploads' && (
          <div>
            {/* Upload sub-tabs + back button */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                {activeBatch !== null && (
                  <button
                    onClick={() => { setActiveBatch(null); setActiveBatchName(''); setFolderPage(1); }}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Zurück
                  </button>
                )}
                {activeBatch !== null && (
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{activeBatchName}</span>
                )}
                {activeBatch === null && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setUploadTab(undefined as any); setActiveBatch(null); }}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        !uploadTab
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      Alle
                      {(creatorFoldersData?.total ?? 0) > 0 && (
                        <span className={cn('ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold', !uploadTab ? 'bg-white/20 text-white' : 'bg-red-500 text-white')}>
                          {creatorFoldersData?.total}
                        </span>
                      )}
                    </button>
                    {UPLOAD_TABS.map((t) => {
                      const cnt = creatorFoldersData?.tabCounts?.[t] ?? 0;
                      return (
                        <button
                          key={t}
                          onClick={() => { setUploadTab(t); setActiveBatch(null); }}
                          className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            uploadTab === t
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                          )}
                        >
                          {UPLOAD_TAB_LABELS[t]}
                          {cnt > 0 && (
                            <span className={cn('ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold', uploadTab === t ? 'bg-white/20 text-white' : 'bg-red-500 text-white')}>
                              {cnt}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowUploadZone(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-creator px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-creator-dark transition-colors"
              >
                <Upload className="h-3 w-3" />
                Upload
              </button>
            </div>

            <div className="p-5">
              {/* Folder view (first level) */}
              {activeBatch === null && (
                <>
                  {!creatorFolders || creatorFolders.length === 0 ? (
                    <div className="text-center py-12">
                      <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Keine Uploads in dieser Kategorie</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {creatorFolders.map((folder) => (
                        <div
                          key={folder.batch}
                          onClick={() => { setActiveBatch(folder.batch); setActiveBatchName(folder.name); setFolderPage(1); }}
                          className="group relative flex flex-col rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all bg-white text-left cursor-pointer"
                        >
                          {/* Delete folder button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Ordner "${folder.name}" mit allen Dateien löschen?`)) {
                                fetch(`${API_URL}/api/creator-uploads/batch?batch=${encodeURIComponent(folder.batch)}`, { method: 'DELETE' })
                                  .then(() => window.location.reload())
                                  .catch(() => {});
                              }
                            }}
                            className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors"
                            title="Ordner löschen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
                            {folder.previewUrl ? (
                              <img src={folder.previewUrl} alt={folder.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <Folder className="h-10 w-10 text-gray-300" />
                            )}
                          </div>
                          <div className="px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Folder className="h-3 w-3 text-amber-500 shrink-0" />
                              <p className="text-xs font-medium text-gray-900 truncate">{folder.name}</p>
                            </div>
                            <p className="text-[11px] text-gray-500">{folder.fileCount} {folder.fileCount === 1 ? 'Datei' : 'Dateien'}</p>
                            <p className="text-[11px] text-gray-400">{new Date(folder.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          </div>
                          {/* File count + unseen indicator */}
                          {folder.fileCount > 0 && (
                            <div className="absolute top-2 right-2 flex items-center gap-1">
                              {folder.unseenCount > 0 && (
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                              )}
                              <div className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 px-1">
                                <span className="text-[9px] font-bold text-white">{folder.fileCount}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* File view (second level — inside a folder) */}
              {activeBatch !== null && (
                <>
                  {!batchFiles || batchFiles.items.length === 0 ? (
                    <div className="text-center py-12">
                      <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Keine Dateien in diesem Ordner</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {batchFiles.items.map((upload) => (
                        <div
                          key={upload.id}
                          className="group relative aspect-square rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all bg-gray-50"
                        >
                          <button
                            onClick={() => setLightboxUpload(upload)}
                            className="w-full h-full"
                          >
                            {upload.fileType === 'image' ? (
                              <img src={upload.fileUrl} alt={upload.fileName} className="w-full h-full object-cover" />
                            ) : upload.fileType === 'video' ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <Play className="h-8 w-8 text-white opacity-75" />
                              </div>
                            ) : upload.fileType === 'link' ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <Link2 className="h-8 w-8 text-gray-400" />
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileText className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                          </button>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <p className="text-xs text-white truncate">{upload.label || upload.fileName}</p>
                            {upload.commentCount > 0 && (
                              <span className="text-[10px] text-white/80">{upload.commentCount} Kommentare</span>
                            )}
                          </div>
                          {upload.liveStatus === 'live' && (
                            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-green-500 px-1.5 py-0.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[9px] font-bold text-white">LIVE</span>
                            </div>
                          )}
                          {!upload.seenByAdmin && (
                            <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-amber-500" />
                          )}
                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {upload.liveStatus === 'live' ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGoOffline(upload.id); }}
                                className="flex items-center gap-0.5 rounded-md bg-red-500 px-1.5 py-1 text-[9px] font-medium text-white shadow-sm hover:bg-red-600 transition-colors"
                                title="Offline setzen"
                              >
                                <Power className="h-2.5 w-2.5" />
                                Offline
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setGoLiveUploadId(upload.id); }}
                                className="flex items-center gap-0.5 rounded-md bg-green-500 px-1.5 py-1 text-[9px] font-medium text-white shadow-sm hover:bg-green-600 transition-colors"
                                title="Go Live"
                              >
                                <Radio className="h-2.5 w-2.5" />
                                Live
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteUploadConfirm(upload.id); }}
                              className="flex items-center justify-center rounded-md bg-red-500 p-1 text-white shadow-sm hover:bg-red-600 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {batchFiles && batchFiles.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        onClick={() => setFolderPage(Math.max(1, folderPage - 1))}
                        disabled={folderPage === 1}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        Zurück
                      </button>
                      <span className="text-xs text-gray-500">
                        Seite {folderPage} von {batchFiles.totalPages}
                      </span>
                      <button
                        onClick={() => setFolderPage(Math.min(batchFiles.totalPages, folderPage + 1))}
                        disabled={folderPage === batchFiles.totalPages}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        Weiter
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Deals Tab */}
        {activeTab === 'deals' && (
          <div>
            {!deals || deals.length === 0 ? (
              <div className="text-center py-12">
                <Handshake className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No deals yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Stage</th>
                      <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="text-right px-3 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 uppercase">Deadline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {deals.map((deal) => (
                      <tr
                        key={deal.id}
                        onClick={() => router.push(`/creators/deals/${deal.id}`)}
                        className="cursor-pointer hover:bg-surface-secondary transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{deal.title}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: DEAL_STAGE_COLORS[deal.stage as DealStage] }}
                          >
                            {DEAL_STAGE_LABELS[deal.stage as DealStage]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-600 capitalize text-xs">
                          {deal.type.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {formatDollars(deal.amount)}
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-xs">
                          {deal.deadline
                            ? new Date(deal.deadline).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">Activity timeline coming soon</p>
          </div>
        )}
      </div>

      {/* Go Live Date Picker Modal */}
      {goLiveUploadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setGoLiveUploadId(null); setGoLiveDate(''); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 animate-scale-in">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-4">
              <Radio className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-white">Wann geht der Content live?</h3>
            <p className="text-center text-sm text-gray-500 mt-2">
              W&auml;hle das Live-Datum f&uuml;r diesen Content.
            </p>
            <div className="mt-4">
              <input
                type="date"
                value={goLiveDate}
                onChange={(e) => setGoLiveDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setGoLiveUploadId(null); setGoLiveDate(''); }}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleGoLive}
                disabled={!goLiveDate || goLiveMutation.isPending}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {goLiveMutation.isPending ? 'Wird gesetzt...' : 'Go Live'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Upload Confirmation */}
      {deleteUploadConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteUploadConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 animate-scale-in">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-white">Upload l&ouml;schen?</h3>
            <p className="text-center text-sm text-gray-500 mt-2">
              Dieser Upload wird unwiderruflich gel&ouml;scht.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteUploadConfirm(null)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmDeleteUpload}
                disabled={deleteUpload.isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteUpload.isPending ? 'L\u00f6schen...' : 'L\u00f6schen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Zone Modal */}
      {showUploadZone && (
        <UploadZone
          creatorId={id}
          defaultTab={uploadTab}
          onClose={() => setShowUploadZone(false)}
        />
      )}

      {/* Lightbox Modal */}
      {lightboxUpload && (
        <Lightbox
          upload={lightboxUpload}
          onClose={() => setLightboxUpload(null)}
          onDelete={handleDeleteUpload}
          authorName={currentUserName}
          authorRole="admin"
        />
      )}

      {/* Floating Chat Widget */}
      <ChatWidget
        creatorId={id}
        creatorName={creator.name}
        role="admin"
      />
    </div>
  );
}
