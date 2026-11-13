'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Trash2, Pencil, X, Boxes, Check } from 'lucide-react';
import { PageHeader, Button, Card, CardBody, Input, Select, StatusPill, Toggle, EmptyState } from '@/components/ds';
import {
  dropshippingApi, DsRule, DsRuleMode, DsRuleSku, DsSkuRow, DS_MODE_LABELS,
} from '@/lib/dropshipping';

interface Draft {
  id?: string;
  name: string;
  mode: DsRuleMode;
  skus: DsRuleSku[];
}

function Thumb({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) {
    return <div className="w-8 h-8 rounded-md bg-[var(--bg-secondary)] shrink-0 grid place-items-center text-[var(--text-tertiary)]"><Boxes size={14} /></div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-8 h-8 rounded-md object-cover shrink-0 border border-[var(--border-color)]" />;
}

export default function DropshippingRulesPage() {
  const [rules, setRules] = useState<DsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setRules(await dropshippingApi.listRules());
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setDraft({ name: '', mode: 'subset', skus: [] });
  const startEdit = (r: DsRule) =>
    setDraft({ id: r.id, name: r.name, mode: r.mode, skus: r.skus.map((s) => ({ ...s })) });

  const save = async () => {
    if (!draft) return;
    if (draft.skus.length === 0) { setError('Mindestens eine SKU auswählen'); return; }
    setSaving(true);
    setError(null);
    try {
      if (draft.id) {
        await dropshippingApi.updateRule(draft.id, { name: draft.name, mode: draft.mode, skus: draft.skus });
      } else {
        await dropshippingApi.createRule({ name: draft.name, mode: draft.mode, skus: draft.skus });
      }
      setDraft(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: DsRule) => {
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
    try {
      await dropshippingApi.updateRule(r.id, { active: !r.active });
    } catch (e: any) {
      setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: r.active } : x)));
      setError(e.message ?? 'Konnte nicht speichern');
    }
  };

  const remove = async (r: DsRule) => {
    if (!confirm(`Regel "${r.name || 'Ohne Namen'}" wirklich löschen?`)) return;
    try {
      await dropshippingApi.deleteRule(r.id);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Löschen fehlgeschlagen');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
      <PageHeader
        eyebrow="Dropshipping"
        title="Regeln"
        subtitle="Lege fest, welche SKU-Kombinationen an den Dropshipper gehen. Pro Regel: eine einzelne SKU oder mehrere."
        actions={!draft && <Button variant="primary" leftIcon={<Plus size={16} />} onClick={startNew}>Neue Regel</Button>}
      />

      {error && (
        <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">
          {error}
        </div>
      )}

      {draft && <RuleEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => { setDraft(null); setError(null); }} saving={saving} />}

      {loading ? (
        <div className="px-4 py-10 text-center text-[14px] text-[var(--text-secondary)]">Lädt…</div>
      ) : rules.length === 0 && !draft ? (
        <EmptyState
          icon={<Boxes size={28} />}
          title="Noch keine Regeln"
          description="Erstelle eine Regel, um festzulegen welche Produkte (SKUs) über Dropshipping versendet werden."
          action={<Button variant="primary" leftIcon={<Plus size={16} />} onClick={startNew}>Neue Regel</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold text-[var(--text-primary)]">{r.name || 'Ohne Namen'}</span>
                      <StatusPill tone={r.mode === 'exact' ? 'warn' : 'info'} dot={false}>{DS_MODE_LABELS[r.mode]}</StatusPill>
                      {!r.active && <StatusPill tone="neutral" dot={false}>inaktiv</StatusPill>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.skus.map((s) => (
                        <span key={s.sku} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] pl-1 pr-2.5 py-1 text-[12.5px]">
                          <Thumb url={s.imageUrl} alt={s.sku} />
                          <span className="font-mono text-[var(--text-primary)]">{s.sku}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Toggle checked={r.active} onChange={() => toggleActive(r)} label="Regel aktiv" />
                    <Button variant="ghost" size="sm" onClick={() => startEdit(r)} aria-label="Bearbeiten"><Pencil size={15} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(r)} aria-label="Löschen"><Trash2 size={15} /></Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Rule editor
// -----------------------------------------------------------------------------

function RuleEditor({
  draft, setDraft, onSave, onCancel, saving,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [catalog, setCatalog] = useState<DsSkuRow[]>([]);
  const [q, setQ] = useState('');
  const [loadingCat, setLoadingCat] = useState(true);

  useEffect(() => {
    let alive = true;
    dropshippingApi.listSkus()
      .then((rows) => { if (alive) setCatalog(rows); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingCat(false); });
    return () => { alive = false; };
  }, []);

  const selectedSkus = useMemo(() => new Set(draft.skus.map((s) => s.sku)), [draft.skus]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = catalog.filter((c) => !selectedSkus.has(c.sku));
    if (!s) return base.slice(0, 50);
    return base.filter(
      (c) => c.sku.toLowerCase().includes(s) || (c.title ?? '').toLowerCase().includes(s) || c.productTitle.toLowerCase().includes(s),
    ).slice(0, 50);
  }, [catalog, q, selectedSkus]);

  const add = (c: DsSkuRow) =>
    setDraft({ ...draft, skus: [...draft.skus, { sku: c.sku, title: c.title ?? c.productTitle, imageUrl: c.imageUrl, variantExternalId: c.variantExternalId }] });
  const removeSku = (sku: string) => setDraft({ ...draft, skus: draft.skus.filter((s) => s.sku !== sku) });

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[16px] font-semibold text-[var(--text-primary)]">{draft.id ? 'Regel bearbeiten' : 'Neue Regel'}</h3>
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Schließen"><X size={16} /></Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--text-primary)]">Name (optional)</label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="z. B. 3D-Stifte + PCL" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--text-primary)]">Modus</label>
            <Select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DsRuleMode })}>
              <option value="subset">Erlaubte Produkte (Teilmenge)</option>
              <option value="exact">Exakte Kombination</option>
            </Select>
          </div>
        </div>

        <p className="m-0 text-[13px] text-[var(--text-secondary)]">
          {draft.mode === 'subset'
            ? 'Bestellung passt, wenn ALLE ihre Produkte aus den gewählten SKUs stammen (kein fremdes Produkt). Menge egal.'
            : 'Bestellung passt nur, wenn ihre Produkte GENAU diesen SKUs entsprechen.'}
        </p>

        {/* Ausgewählte SKUs */}
        <div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">Ausgewählte SKUs ({draft.skus.length})</div>
          {draft.skus.length === 0 ? (
            <div className="text-[13px] text-[var(--text-secondary)]">Noch keine. Unten suchen und hinzufügen.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {draft.skus.map((s) => (
                <span key={s.sku} className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/40 bg-primary-500/10 pl-1 pr-1.5 py-1 text-[12.5px]">
                  <Thumb url={s.imageUrl} alt={s.sku} />
                  <span className="font-mono text-[var(--text-primary)]">{s.sku}</span>
                  <button onClick={() => removeSku(s.sku)} className="text-[var(--text-tertiary)] hover:text-[rgb(var(--color-error))]" aria-label={`${s.sku} entfernen`}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Katalog-Suche */}
        <div>
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU / Produkt suchen zum Hinzufügen…" className="pl-9" />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
            {loadingCat ? (
              <div className="px-3 py-6 text-center text-[13px] text-[var(--text-secondary)]">Katalog lädt…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-[var(--text-secondary)]">Keine Treffer</div>
            ) : (
              filtered.map((c) => (
                <button key={c.sku} onClick={() => add(c)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary-500/[0.06]">
                  <Thumb url={c.imageUrl} alt={c.sku} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] text-[var(--text-primary)] truncate">{c.productTitle || c.title || c.sku}</div>
                    <div className="text-[12px] text-[var(--text-secondary)] truncate font-mono">{c.sku}</div>
                  </div>
                  <Plus size={16} className="text-primary-600 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Abbrechen</Button>
          <Button variant="primary" leftIcon={<Check size={16} />} loading={saving} onClick={onSave}>Regel speichern</Button>
        </div>
      </CardBody>
    </Card>
  );
}
