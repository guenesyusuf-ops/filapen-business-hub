'use client';

import Link from 'next/link';
import { ShoppingBag, Store, ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Channel card definition
// ---------------------------------------------------------------------------

interface ChannelItem {
  id: string;
  name: string;
  description: string;
  href: string | null;
  status: 'live' | 'coming_soon';
  icon: React.ElementType;
  accent: string;
}

const CHANNELS: ChannelItem[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Umsatz, Bestellungen, Produkte, Retouren — Shopify Admin Analytics replica.',
    href: '/channels/shopify',
    status: 'live',
    icon: ShoppingBag,
    accent: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    description: 'Kampagnen, Anzeigen, Zielgruppen — Facebook & Instagram.',
    href: null,
    status: 'coming_soon',
    icon: Store,
    accent: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    description: 'Search, Shopping, Performance Max.',
    href: null,
    status: 'coming_soon',
    icon: Store,
    accent: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChannelsOverviewPage() {
  return (
    <div className="text-white">
      <header className="mb-8">
        <h1 className="text-xl font-bold text-white">Channels</h1>
        <p className="mt-1 text-xs text-gray-500">
          Alle verbundenen Vertriebs- und Marketing-Kanäle im Überblick.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const content = (
            <div className="group relative flex h-full flex-col rounded-xl border border-white/5 bg-[#111] p-6 transition-all hover:border-white/10 hover:bg-[#141414]">
              <div className="mb-4 flex items-center justify-between">
                <div
                  className={[
                    'flex h-11 w-11 items-center justify-center rounded-xl border',
                    ch.accent,
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {ch.status === 'live' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    Bald verfügbar
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white">{ch.name}</h3>
              <p className="mt-1 text-xs text-gray-500">{ch.description}</p>
              {ch.href && (
                <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-white/80 group-hover:text-white">
                  Dashboard öffnen
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              )}
            </div>
          );

          return ch.href ? (
            <Link key={ch.id} href={ch.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={ch.id} className="cursor-not-allowed opacity-60">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
