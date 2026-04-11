'use client';

import { useState } from 'react';
import {
  useDashboardStats,
  useCreatorsWithUploads,
  useRecentCreators,
} from '@/hooks/creators/useCreatorDashboard';
import { WelcomeSection } from '@/components/creators/dashboard/WelcomeSection';
import { StatCards } from '@/components/creators/dashboard/StatCards';
import { CreatorsAnalyticsTable } from '@/components/creators/dashboard/CreatorsAnalyticsTable';
import { CreatorsWithoutUploadsModal } from '@/components/creators/dashboard/CreatorsWithoutUploadsModal';
import { CalendarWidget } from '@/components/creators/dashboard/CalendarWidget';
import { RecentCreatorsList } from '@/components/creators/dashboard/RecentCreatorsList';
import { Toolbox } from '@/components/creators/dashboard/Toolbox';
import { AdminInfoCard } from '@/components/creators/dashboard/AdminInfoCard';

// ---------------------------------------------------------------------------
// Creator Hub Dashboard (replaces the old overview page)
// Two-column layout: main content (2/3) + sidebar (1/3).
// ---------------------------------------------------------------------------

export default function CreatorHubDashboardPage() {
  const [uploadsModalOpen, setUploadsModalOpen] = useState(false);

  const statsQuery = useDashboardStats();
  const analyticsQuery = useCreatorsWithUploads();
  const recentQuery = useRecentCreators();

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <WelcomeSection userName="Admin" />

          <StatCards
            stats={statsQuery.data}
            loading={statsQuery.isLoading}
            onUploadsClick={() => setUploadsModalOpen(true)}
          />

          <CreatorsAnalyticsTable
            rows={analyticsQuery.data}
            loading={analyticsQuery.isLoading}
          />
        </div>

        {/* Right sidebar (1/3) */}
        <aside className="space-y-6 lg:col-span-1">
          <AdminInfoCard name="Admin" role="Administrator" />
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
