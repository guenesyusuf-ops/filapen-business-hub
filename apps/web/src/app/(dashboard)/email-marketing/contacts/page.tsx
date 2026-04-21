'use client';

import { Users2 } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function ContactsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Kontakte"
        subtitle="Aus Shopify synchronisierte Customer-Profile"
        actions={<SoonBadge />}
      />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<Users2 className="h-10 w-10" />}
          title="Contact-Sync in Vorbereitung"
          hint="Phase 3: Shopify-Customers werden automatisch als Kontakte importiert, inkl. Marketing-Consent. Danach kannst du sie filtern, anschauen und segmentieren."
        />
      </div>
    </div>
  );
}
