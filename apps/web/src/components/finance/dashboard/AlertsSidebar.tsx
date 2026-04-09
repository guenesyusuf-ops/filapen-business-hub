'use client';

import { useState, useCallback } from 'react';
import {
  AlertTriangle,
  Info,
  XCircle,
  Check,
  Settings,
  Inbox,
} from 'lucide-react';
import type { AlertItem } from '@filapen/shared/src/types/finance';
import { useTranslation } from '@/i18n/useTranslation';
import { cn } from '@/lib/utils';

interface AlertsSidebarProps {
  alerts: AlertItem[];
  onAcknowledge: (id: string) => void;
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircle,
    bg: 'bg-red-50/80',
    border: 'border-l-red-500',
    iconColor: 'text-red-600',
    badge: 'bg-red-600',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50/80',
    border: 'border-l-amber-500',
    iconColor: 'text-amber-600',
    badge: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50/80',
    border: 'border-l-blue-500',
    iconColor: 'text-blue-600',
    badge: 'bg-blue-500',
  },
} as const;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function AlertsSkeleton() {
  return (
    <div className="relative rounded-xl bg-white p-5 shadow-card overflow-hidden">
      <div className="absolute inset-0 shimmer-bg animate-shimmer" />
      <div className="relative">
        <div className="h-4 w-20 rounded-full bg-gray-200/60 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
        <Inbox className="h-6 w-6 text-gray-300" />
      </div>
      <p className="text-sm text-gray-500 font-medium">All clear</p>
      <p className="text-xs text-gray-400 mt-0.5">No active alerts right now</p>
    </div>
  );
}

export function AlertsSidebar({ alerts, onAcknowledge, loading }: AlertsSidebarProps) {
  const { t } = useTranslation();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleAcknowledge = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    // Delay the actual callback so the animation plays
    setTimeout(() => onAcknowledge(id), 300);
  }, [onAcknowledge]);

  if (loading) {
    return <AlertsSkeleton />;
  }

  // Support both enum values and plain string severity from API
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const criticalCount = activeAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === ('critical' as unknown),
  ).length;

  return (
    <div className="rounded-xl bg-white/90 backdrop-blur-sm shadow-card overflow-hidden border border-gray-100/60">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{t('finance.alerts')}</h3>
          {activeAlerts.length > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xxs font-semibold text-white transition-colors',
                criticalCount > 0 ? 'bg-red-600' : 'bg-amber-500',
              )}
            >
              {activeAlerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="px-3 pb-3 space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin">
        {activeAlerts.length === 0 ? (
          <EmptyState />
        ) : (
          activeAlerts.map((alert) => {
            // Resolve severity config - handle both enum and string values
            const severityKey = (typeof alert.severity === 'string'
              ? alert.severity
              : 'info') as keyof typeof SEVERITY_CONFIG;
            const config = SEVERITY_CONFIG[severityKey] ?? SEVERITY_CONFIG.info;
            const IconComponent = config.icon;
            const isDismissed = dismissedIds.has(alert.id);

            return (
              <div
                key={alert.id}
                className={cn(
                  'rounded-lg border-l-[3px] p-3 transition-all duration-300',
                  config.bg,
                  config.border,
                  isDismissed && 'opacity-0 -translate-x-4 h-0 p-0 overflow-hidden',
                )}
              >
                <div className="flex gap-2.5">
                  <IconComponent className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-relaxed">{alert.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xxs text-gray-500">{relativeTime(alert.createdAt)}</span>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="inline-flex items-center gap-1 text-xxs font-medium text-gray-500 hover:text-gray-700 transition-colors rounded-md px-1.5 py-0.5 hover:bg-white/60"
                      >
                        <Check className="h-3 w-3" />
                        {t('common.acknowledge')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-3">
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors">
          <Settings className="h-3.5 w-3.5" />
          {t('common.configureAlerts')}
        </button>
      </div>
    </div>
  );
}
