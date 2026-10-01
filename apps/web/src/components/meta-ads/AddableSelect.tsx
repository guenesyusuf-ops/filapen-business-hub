'use client';

import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { NamedRef } from '@/hooks/meta-ads/useMetaAds';

interface Props {
  label: string;
  value: string | undefined;
  options: NamedRef[];
  onChange: (id: string | undefined) => void;
  onCreate: (name: string) => Promise<NamedRef>;
  placeholder?: string;
}

/** Select über bestehende Werte + Inline-Anlage neuer Werte (Angles/Offers). */
export function AddableSelect({ label, value, options, onChange, onCreate, placeholder }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const created = await onCreate(clean);
      onChange(created.id);
      setName('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-white/50">{label}</label>
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
            placeholder={`Neues ${label}…`}
            className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30"
          />
          <button type="button" onClick={create} disabled={busy} className="rounded-lg bg-accent-meta/10 p-2 text-accent-meta hover:bg-accent-meta/20 disabled:opacity-50">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setAdding(false); setName(''); }} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="min-w-0 flex-1 truncate rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30"
          >
            <option value="">{placeholder ?? '—'}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => setAdding(true)} title={`${label} anlegen`} className="rounded-lg border border-border p-2 text-gray-500 hover:text-accent-meta hover:border-accent-meta/40">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
