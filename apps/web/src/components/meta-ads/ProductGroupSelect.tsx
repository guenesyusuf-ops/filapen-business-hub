'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Check, ChevronDown, Layers, Package, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import {
  useMetaProductGroups, useMetaProducts, useCreateProductGroup, MaProductGroupType,
} from '@/hooks/meta-ads/useMetaAds';

const TYPE_LABEL: Record<MaProductGroupType, string> = { linked: 'verknüpft', manual: 'manuell', bundle: 'bundle' };

/**
 * Command-Style Auswahl von Produkt-/Analysegruppen.
 * mode="field"  → Pflichtauswahl im Formular (mit Anlage)
 * mode="filter" → Switcher mit "Alle Produkte"
 */
export function ProductGroupSelect({
  value, onChange, mode = 'field', className,
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  mode?: 'field' | 'filter';
  className?: string;
}) {
  const toast = useToast();
  const { data: groups } = useMetaProductGroups();
  const { data: shopProducts } = useMetaProducts();
  const createGroup = useCreateProductGroup();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<MaProductGroupType>('manual');
  const [newName, setNewName] = useState('');
  const [linkProductId, setLinkProductId] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const items = groups?.items ?? [];
  const current = items.find((g) => g.id === value);
  const triggerLabel = current ? current.name : mode === 'filter' ? 'Alle Produkte' : '— wählen —';

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((g) => g.name.toLowerCase().includes(t)) : items;
  }, [items, q]);
  const linked = filtered.filter((g) => g.type === 'linked');
  const analysis = filtered.filter((g) => g.type !== 'linked');

  // Shop-Produkte, die noch KEINE verknüpfte Gruppe haben — direkt im Selector wählbar.
  const linkedProductIds = useMemo(
    () => new Set(items.filter((g) => g.type === 'linked' && g.productId).map((g) => g.productId as string)),
    [items],
  );
  const shopItems = useMemo(() => {
    const t = q.trim().toLowerCase();
    const unlinked = (shopProducts?.items ?? []).filter((p) => !linkedProductIds.has(p.id));
    return t ? unlinked.filter((p) => p.title.toLowerCase().includes(t)) : unlinked;
  }, [shopProducts, linkedProductIds, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = () => { setOpen(false); setCreating(false); setQ(''); setNewName(''); setLinkProductId(''); };

  const submitCreate = async () => {
    try {
      if (newType === 'linked') {
        if (!linkProductId) { toast.error('Bitte ein Shop-Produkt wählen'); return; }
        const g = await createGroup.mutateAsync({ type: 'linked', productId: linkProductId });
        onChange(g.id); close();
      } else {
        const name = newName.trim();
        if (!name) { toast.error('Name erforderlich'); return; }
        const g = await createGroup.mutateAsync({ type: newType, name });
        onChange(g.id); close();
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Anlage fehlgeschlagen'); }
  };

  // Shop-Produkt direkt wählen: vorhandene verknüpfte Gruppe nutzen oder neu verknüpfen.
  const pickShopProduct = async (p: { id: string; title: string }) => {
    const existing = items.find((g) => g.type === 'linked' && g.productId === p.id);
    if (existing) { onChange(existing.id); close(); return; }
    try {
      const g = await createGroup.mutateAsync({ type: 'linked', productId: p.id });
      onChange(g.id); close();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Verknüpfen fehlgeschlagen'); }
  };

  const itemRow = (g: { id: string; name: string; type: MaProductGroupType }) => (
    <button key={g.id} type="button" onClick={() => { onChange(g.id); close(); }}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition',
        g.id === value ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-700 hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06]')}>
      {g.type === 'linked' ? <Package className="h-3.5 w-3.5 shrink-0 opacity-60" /> : <Layers className="h-3.5 w-3.5 shrink-0 opacity-60" />}
      <span className="min-w-0 flex-1 truncate">{g.name}</span>
      <span className="shrink-0 rounded border border-gray-200 px-1.5 text-[10.5px] text-gray-400 dark:border-white/10 dark:text-white/40">{TYPE_LABEL[g.type]}</span>
      {g.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button type="button" onClick={() => (open ? close() : setOpen(true))}
        className="flex h-[38px] w-full min-w-0 items-center justify-between gap-2 rounded-[9px] border border-gray-200 bg-white px-3 text-[13.5px] text-gray-900 transition hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-meta/25 dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white">
        <span className="flex min-w-0 items-center gap-2">
          {current?.type === 'linked' ? <Package className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            : current ? <Layers className="h-3.5 w-3.5 shrink-0 text-gray-400" /> : null}
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-[320px] max-w-[88vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_14px_40px_-10px_rgba(20,20,30,.22)] dark:border-white/[0.12] dark:bg-[var(--card-bg)] dark:shadow-[0_18px_44px_-10px_rgba(0,0,0,.6)]">
          {!creating ? (
            <>
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-gray-400 dark:border-white/[0.07]">
                <Search className="h-4 w-4" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…"
                  className="w-full border-0 bg-transparent text-[13px] text-gray-900 outline-none dark:text-white" />
              </div>
              <div className="max-h-[300px] overflow-auto p-1.5">
                {mode === 'filter' && (
                  <button type="button" onClick={() => { onChange(undefined); close(); }}
                    className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition',
                      !value ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-700 hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06]')}>
                    <span className="flex-1">Alle Produkte</span>{!value && <Check className="h-3.5 w-3.5" />}
                  </button>
                )}
                {linked.length > 0 && <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Shop-verknüpft</div>}
                {linked.map(itemRow)}
                {analysis.length > 0 && <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Analysegruppen</div>}
                {analysis.map(itemRow)}
                {shopItems.length > 0 && <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40">Shop-Produkte · direkt verknüpfen</div>}
                {shopItems.map((p) => (
                  <button key={p.id} type="button" onClick={() => pickShopProduct(p)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-gray-700 transition hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06]">
                    <Package className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-white/30" />
                  </button>
                ))}
                {filtered.length === 0 && shopItems.length === 0 && <div className="px-2.5 py-3 text-[12.5px] text-gray-400">Keine Treffer.</div>}
              </div>
              <button type="button" onClick={() => { setCreating(true); setNewName(q); }}
                className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-[13px] font-medium text-accent-meta transition hover:bg-accent-meta/[0.06] dark:border-white/[0.07]">
                <Plus className="h-4 w-4" /> Neue Gruppe anlegen{q.trim() ? ` „${q.trim()}"` : ''}
              </button>
            </>
          ) : (
            <div className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gray-900 dark:text-white">Neue Gruppe</span>
                <button type="button" onClick={() => setCreating(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
                {(['manual', 'bundle', 'linked'] as MaProductGroupType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setNewType(t)}
                    className={cn('flex-1 rounded-md px-2 py-1 text-[12px] font-medium capitalize transition',
                      newType === t ? 'bg-white text-accent-meta shadow-sm dark:bg-white/15' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>
                    {t === 'manual' ? 'Manuell' : t === 'bundle' ? 'Bundle' : 'Verknüpft'}
                  </button>
                ))}
              </div>
              {newType === 'linked' ? (
                <select value={linkProductId} onChange={(e) => setLinkProductId(e.target.value)}
                  className="mb-3 h-[38px] w-full min-w-0 rounded-[9px] border border-gray-200 bg-white px-2.5 text-[13px] dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white">
                  <option value="">Shop-Produkt wählen…</option>
                  {(shopProducts?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              ) : (
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCreate(); } }}
                  placeholder={newType === 'bundle' ? 'z. B. Bundle A+B' : 'z. B. Test Offer XY'}
                  className="mb-3 h-[38px] w-full min-w-0 rounded-[9px] border border-gray-200 bg-white px-3 text-[13.5px] outline-none focus:ring-2 focus:ring-accent-meta/25 dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white" />
              )}
              <button type="button" onClick={submitCreate} disabled={createGroup.isPending}
                className="w-full rounded-lg bg-accent-meta px-3 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:opacity-50">
                {createGroup.isPending ? 'Anlegen…' : 'Anlegen & auswählen'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
