'use client';

import { useState } from 'react';
import { MetaControls, MetaControlsValue } from '@/components/meta-ads/MetaControls';
import { MetaPageHeader } from '@/components/meta-ads/MetaUI';
import { CreativeLabTabs } from '@/components/meta-ads/CreativeLabTabs';
import { AttentionComparison } from '@/components/meta-ads/AttentionComparison';

export default function CreativeLabAttentionPage() {
  const [controls, setControls] = useState<MetaControlsValue>({ range: 'last7' });
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads · Creative Lab" title="Attention"
        description="Wo verlieren die Video-Ads eines Produkts die Aufmerksamkeit? Interpoliert aus den Meta-Checkpoints, nebeneinander vergleichbar.">
        <MetaControls value={controls} onChange={setControls} />
      </MetaPageHeader>

      <CreativeLabTabs />

      <AttentionComparison productGroupId={controls.productGroupId} range={controls.range} start={controls.start} end={controls.end} />
    </div>
  );
}
