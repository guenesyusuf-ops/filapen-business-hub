'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  BarChart3,
  Search,
  PlayCircle,
  Package,
  Plug,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useIntegrations,
  useDisconnectIntegration,
  useSyncIntegration,
  useConnectIntegration,
  type Integration,
} from '@/hooks/finance/useIntegrations';

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

interface PlatformDef {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  comingSoon: boolean;
}

const PLATFORMS: PlatformDef[] = [
  {
    type: 'shopify',
    label: 'Shopify',
    description: 'E-Commerce Daten: Bestellungen, Produkte, Umsatz',
    icon: <ShoppingBag className="h-6 w-6" />,
    iconBg: 'bg-green-500/10 text-green-400',
    comingSoon: false,
  },
  {
    type: 'meta',
    label: 'Meta Ads',
    description: 'Facebook & Instagram Werbe-Daten',
    icon: <BarChart3 className="h-6 w-6" />,
    iconBg: 'bg-blue-500/10 text-blue-400',
    comingSoon: true,
  },
  {
    type: 'google',
    label: 'Google Ads',
    description: 'Google Werbe-Daten & Attribution',
    icon: <Search className="h-6 w-6" />,
    iconBg: 'bg-red-500/10 text-red-400',
    comingSoon: true,
  },
  {
    type: 'tiktok',
    label: 'TikTok Ads',
    description: 'TikTok Werbe-Daten',
    icon: <PlayCircle className="h-6 w-6" />,
    iconBg: 'bg-pink-500/10 text-pink-400',
    comingSoon: true,
  },
  {
    type: 'amazon',
    label: 'Amazon',
    description: 'Amazon Marketplace Daten',
    icon: <Package className="h-6 w-6" />,
    iconBg: 'bg-orange-500/10 text-orange-400',
    comingSoon: true,
  },
];

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nie';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `vor ${diffHr} Std.`;
  const diffDay = Math.floor(diffHr / 24);
  return `vor ${diffDay} Tag${diffDay === 1 ? '' : 'en'}`;
}

// ---------------------------------------------------------------------------
// Toast / Banner component
// ---------------------------------------------------------------------------

function CallbackBanner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const shopifyStatus = searchParams.get('shopify');
    if (!shopifyStatus) return;

    if (shopifyStatus === 'connected') {
      setMessage('Shopify erfolgreich verbunden!');
      setIsError(false);
      setVisible(true);
    } else if (shopifyStatus === 'error') {
      const errorText = searchParams.get('error') || 'Unbekannter Fehler';
      setMessage(`Shopify-Verbindung fehlgeschlagen: ${errorText}`);
      setIsError(true);
      setVisible(true);
    }

    timerRef.current = setTimeout(() => setVisible(false), 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border px-4 py-3 text-sm',
        isError
          ? 'border-red-500/30 bg-red-500/10 text-red-400'
          : 'border-green-500/30 bg-green-500/10 text-green-400',
      )}
    >
      <div className="flex items-center gap-2">
        {isError ? (
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        )}
        <span>{message}</span>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="rounded p-0.5 hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#111] p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-lg bg-[#222]" />
        <div>
          <div className="h-4 w-24 rounded bg-[#222] mb-2" />
          <div className="h-3 w-40 rounded bg-[#222]" />
        </div>
      </div>
      <div className="h-3 w-32 rounded bg-[#222] mt-6" />
      <div className="h-9 w-28 rounded-lg bg-[#222] mt-4" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connected integration card
// ---------------------------------------------------------------------------

function ConnectedCard({
  platform,
  integration,
}: {
  platform: PlatformDef;
  integration: Integration;
}) {
  const syncMutation = useSyncIntegration();
  const disconnectMutation = useDisconnectIntegration();

  return (
    <div className="rounded-xl border border-[#222] bg-[#111] p-6 hover:border-[#333] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-12 w-12 rounded-lg', platform.iconBg)}>
            {platform.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{platform.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{platform.description}</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          {integration.syncStatus === 'syncing' ? (
            <span className="flex items-center gap-1.5 text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Synchronisiert...
            </span>
          ) : integration.syncStatus === 'failed' ? (
            <span className="flex items-center gap-1.5 text-red-400">
              <AlertCircle className="h-3 w-3" />
              Sync fehlgeschlagen
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Verbunden
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Letzter Sync: {relativeTime(integration.lastSyncedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-5">
        {(() => {
          const isSyncing =
            syncMutation.isPending || integration.syncStatus === 'syncing';
          return (
            <button
              onClick={() => syncMutation.mutate(integration.id)}
              disabled={isSyncing}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isSyncing
                  ? 'bg-[#222] text-gray-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-200',
              )}
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isSyncing ? 'Synchronisiert...' : 'Sync'}
            </button>
          );
        })()}
        <button
          onClick={() => disconnectMutation.mutate(integration.id)}
          disabled={disconnectMutation.isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-[#333] px-3 py-2 text-xs font-medium transition-colors',
            disconnectMutation.isPending
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-red-400 hover:border-red-500/30',
          )}
        >
          {disconnectMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5" />
          )}
          Trennen
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shopify connect card (with domain input)
// ---------------------------------------------------------------------------

function ShopifyConnectCard({ platform }: { platform: PlatformDef }) {
  const { connect } = useConnectIntegration();
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const domain = (formData.get('shopDomain') as string)?.trim();
    if (domain) {
      connect('shopify', domain);
    }
  };

  return (
    <div className="rounded-xl border border-[#222] bg-[#111] p-6 hover:border-[#333] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-12 w-12 rounded-lg', platform.iconBg)}>
            {platform.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{platform.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{platform.description}</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-gray-600" />
          Nicht verbunden
        </div>
      </div>

      {/* Connect */}
      <div className="mt-5">
        {showInput ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              name="shopDomain"
              type="text"
              placeholder="meinshop.myshopify.com"
              required
              autoFocus
              className="w-full rounded-lg border border-[#333] bg-[#0a0a0a] px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#555] focus:outline-none transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-500 transition-colors"
              >
                <Plug className="h-3.5 w-3.5" />
                Verbinden
              </button>
              <button
                type="button"
                onClick={() => setShowInput(false)}
                className="inline-flex items-center rounded-lg border border-[#333] px-3 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black hover:bg-gray-200 transition-colors"
          >
            <Plug className="h-3.5 w-3.5" />
            Verbinden
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coming soon card
// ---------------------------------------------------------------------------

function ComingSoonCard({ platform }: { platform: PlatformDef }) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#111] p-6 opacity-60">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-12 w-12 rounded-lg', platform.iconBg)}>
            {platform.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{platform.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{platform.description}</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-gray-600" />
          Nicht verbunden
        </div>
      </div>

      {/* Coming soon badge */}
      <div className="mt-5">
        <span className="inline-flex items-center rounded-full border border-[#333] px-3 py-1.5 text-xs font-medium text-gray-500">
          Demnachst verfugbar
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform card router
// ---------------------------------------------------------------------------

function PlatformCard({
  platform,
  integration,
}: {
  platform: PlatformDef;
  integration?: Integration;
}) {
  // Connected
  if (integration && integration.status === 'connected') {
    return <ConnectedCard platform={platform} integration={integration} />;
  }

  // Coming soon
  if (platform.comingSoon) {
    return <ComingSoonCard platform={platform} />;
  }

  // Shopify — connectable
  if (platform.type === 'shopify') {
    return <ShopifyConnectCard platform={platform} />;
  }

  // Fallback
  return <ComingSoonCard platform={platform} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const { data: integrations, isLoading, isError, error } = useIntegrations();

  // Build a lookup map: type -> integration
  const integrationMap = new Map<string, Integration>();
  integrations?.forEach((i) => integrationMap.set(i.type, i));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Callback banner */}
      <CallbackBanner />

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Integrationen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Verbinde deine Datenquellen um Umsatz, Kosten und Werbe-Performance an einem Ort zu sehen.
        </p>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <strong>Fehler beim Laden der Integrationen.</strong>{' '}
          {(error as Error)?.message ?? 'Bitte versuche es erneut.'}
        </div>
      )}

      {/* Platform grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.type}
              platform={platform}
              integration={integrationMap.get(platform.type)}
            />
          ))
        )}
      </div>
    </div>
  );
}
