'use client';

import { useState } from 'react';
import {
  useDashboardStats,
  useCreatorsWithUploads,
  useRecentCreators,
  useLiveContent,
  useGoOffline,
} from '@/hooks/creators/useCreatorDashboard';
import { WelcomeSection } from '@/components/creators/dashboard/WelcomeSection';
import { StatCards } from '@/components/creators/dashboard/StatCards';
import { CreatorsAnalyticsTable } from '@/components/creators/dashboard/CreatorsAnalyticsTable';
import { LiveContentTable } from '@/components/creators/dashboard/LiveContentTable';
import { CreatorsWithoutUploadsModal } from '@/components/creators/dashboard/CreatorsWithoutUploadsModal';
import { CalendarWidget } from '@/components/creators/dashboard/CalendarWidget';
import { RecentCreatorsList } from '@/components/creators/dashboard/RecentCreatorsList';
import { Toolbox } from '@/components/creators/dashboard/Toolbox';
import { AdminInfoCard } from '@/components/creators/dashboard/AdminInfoCard';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Creator Hub Dashboard (replaces the old overview page)
// Two-column layout: main content (2/3) + sidebar (1/3).
// ---------------------------------------------------------------------------

export default function CreatorHubDashboardPage() {
  const [uploadsModalOpen, setUploadsModalOpen] = useState(false);
  const { user } = useAuthStore();

  // Use the authenticated user's first name (fallback to email prefix)
  const displayName =
    user?.firstName ||
    user?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Team';

  const roleLabel =
    user?.role === 'owner' || user?.role === 'admin' ? 'Administrator' : 'Mitarbeiter';

  const statsQuery = useDashboardStats();
  const analyticsQuery = useCreatorsWithUploads();
  const recentQuery = useRecentCreators();
  const liveContentQuery = useLiveContent();
  const offlineMutation = useGoOffline();

  return (
    <div className="min-h-screen px-4 py-6 text-gray-900 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <WelcomeSection
            userName={displayName}
            stats={statsQuery.data ? {
              uploadCount: statsQuery.data.uploadCount,
              creatorCount: statsQuery.data.creatorCount,
            } : null}
          />

          <StatCards
            stats={statsQuery.data}
            loading={statsQuery.isLoading}
            onUploadsClick={() => setUploadsModalOpen(true)}
          />

          <LiveContentTable
            rows={liveContentQuery.data}
            loading={liveContentQuery.isLoading}
            onGoOffline={(id) => offlineMutation.mutate(id)}
            offlineLoading={offlineMutation.isPending}
          />

          <CreatorsAnalyticsTable
            rows={analyticsQuery.data}
            loading={analyticsQuery.isLoading}
          />
        </div>

        {/* Right sidebar (1/3) */}
        <aside className="space-y-6 lg:col-span-1">
          <AdminInfoCard name={user?.name || displayName} role={roleLabel} />
          <CalendarWidget />
          <RecentCreatorsList
            creators={recentQuery.data}
            loading={recentQuery.isLoading}
          />
          <Toolbox />
        </aside>
      </div>

      <CreatorsWithoutUploadsModal
        open={uploadsModalOpen}
        onClose={() => setUploadsModalOpen(false)}
      />
    </div>
  );
}
