'use client';

import { LayoutTemplate } from 'lucide-react';
import { PageHeader, Empty, SoonBadge } from '@/components/email-marketing/EmailMarketingUI';

export default function TemplatesPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Email-Vorlagen" subtitle="Wiederverwendbare Blocks + Variablen" actions={<SoonBadge />} />
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
        <Empty
          icon={<LayoutTemplate className="h-10 w-10" />}
          title="Block-Editor in Vorbereitung"
          hint="Phase 9: Text, Bild, Button, Produkt-Block (Shopify-Pull), Spacer, Divider. Variables wie {{first_name}}, {{last_order}}."
        />
      </div>
    </div>
  );
}
