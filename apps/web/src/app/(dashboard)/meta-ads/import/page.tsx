'use client';

import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Copy, ArrowLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { useMetaProducts } from '@/hooks/meta-ads/useMetaAds';
import {
  useAnalyzeImport, useCommitImport, useImportHistory,
  ImportType, AnalyzeResult, PreviewRow, CommitRow, RowStatus,
  IMPORT_FIELD_LABELS, META_FIELD_KEYS, HYROS_FIELD_KEYS,
} from '@/hooks/meta-ads/useMetaImport';

const CARD = 'rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[var(--card-bg)] shadow-card';

type Tab = 'meta' | 'hyros' | 'history';
type Step = 'upload' | 'review';
type DupStrategy = 'update' | 'skip';
type UnknownStrategy = 'create' | 'skip';

const STATUS_META: Record<RowStatus, { label: string; cls: string; icon: any }> = {
  ready: { label: 'Bereit', cls: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/15', icon: CheckCircle2 },
  warning: { label: 'Warnung', cls: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15', icon: AlertTriangle },
  unknown: { label: 'Unbekannte Ad', cls: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/15', icon: HelpCircle },
  duplicate: { label: 'Duplikat', cls: 'text-violet-700 bg-violet-100 dark:text-violet-400 dark:bg-violet-500/15', icon: Copy },
  invalid: { label: 'Ungültig', cls: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/15', icon: XCircle },
  skipped: { label: 'Übersprungen', cls: 'text-gray-600 bg-gray-100 dark:text-white/50 dark:bg-white/10', icon: XCircle },
};

export default function MetaAdsImportPage() {
  const [tab, setTab] = useState<Tab>('meta');

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Import</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-white/50">
          Meta- und Hyros-Reports als CSV/XLSX importieren. Nichts wird ungeprüft gespeichert — erst Vorschau, dann Bestätigung.
        </p>
      </header>

      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-white/5 p-1 self-start">
        {([['meta', 'Meta Report'], ['hyros', 'Hyros Report'], ['history', 'Import-Verlauf']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === t ? 'bg-white dark:bg-white/15 text-accent-meta shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white',
          )}>{l}</button>
        ))}
      </div>

      {tab === 'history' ? <HistoryPanel /> : <ImportFlow key={tab} type={tab} />}
    </div>
  );
}

function ImportFlow({ type }: { type: ImportType }) {
  const toast = useToast();
  const analyze = useAnalyzeImport();
  const commit = useCommitImport();
  const { data: products } = useMetaProducts();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'all'>('all');
  const [dup, setDup] = useState<DupStrategy>('update');
  const [unknown, setUnknown] = useState<UnknownStrategy>('skip');
  const [newAdProductId, setNewAdProductId] = useState<string>('');

  const fieldKeys = type === 'meta' ? META_FIELD_KEYS : HYROS_FIELD_KEYS;

  const runAnalyze = useCallback(async (f: File, mapping?: Record<string, string | null>) => {
    try {
      const res = await analyze.mutateAsync({ type, file: f, mapping });
      setResult(res);
      setStep('review');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analyse fehlgeschlagen');
    }
  }, [analyze, type, toast]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    runAnalyze(f);
  };

  const summary = result?.summary;
  const rows = result?.rows ?? [];
  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);

  const plan = useMemo(() => buildCommitRows(rows, dup, unknown, newAdProductId || null), [rows, dup, unknown, newAdProductId]);
  const willImport = plan.filter((p) => p.action !== 'skip').length;

  const doCommit = async () => {
    if (!result) return;
    if (unknown === 'create' && !newAdProductId && summary && summary.unknown > 0) {
      toast.error('Produkt für neue Ads wählen oder unbekannte Ads überspringen'); return;
    }
    try {
      const res = await commit.mutateAsync({ type, filename: result.filename, mappingConfig: result.mapping, rows: plan });
      const s = res.summary;
      toast.success(`Import ${res.status === 'completed' ? 'abgeschlossen' : res.status === 'partial' ? 'teilweise' : 'fehlgeschlagen'}: ${s.created} neu, ${s.updated} aktualisiert, ${s.skipped} übersprungen, ${s.errors} Fehler`);
      if (res.errorDetails?.length) res.errorDetails.slice(0, 3).forEach((d) => toast.info(`Zeile ${d.row}: ${d.message}`));
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import fehlgeschlagen');
    }
  };

  const reset = () => { setStep('upload'); setFile(null); setResult(null); setStatusFilter('all'); };

  if (step === 'upload') {
    return (
      <div className={cn(CARD, 'p-8')}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0]); }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
            dragOver ? 'border-accent-meta bg-accent-meta/5' : 'border-gray-300 dark:border-white/15 hover:border-accent-meta/50',
          )}
        >
          <div className="rounded-full bg-accent-meta/10 p-4"><UploadCloud className="h-7 w-7 text-accent-meta" /></div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {analyze.isPending ? 'Datei wird analysiert…' : `${type === 'meta' ? 'Meta' : 'Hyros'}-Report hierher ziehen`}
            </div>
            <div className="mt-1 text-xs text-gray-400 dark:text-white/40">oder klicken — CSV oder XLSX</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
        </div>
        <p className="mt-4 text-xs text-gray-400 dark:text-white/40">
          Zuordnung über Meta Ad ID (sonst eindeutiger Ad-Name). Datei wird nur verarbeitet, nicht gespeichert.
        </p>
      </div>
    );
  }

  // step === 'review'
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Andere Datei
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
          <FileSpreadsheet className="h-4 w-4" /> {file?.name}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {summary && (['ready', 'warning', 'duplicate', 'unknown', 'invalid'] as RowStatus[]).map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset',
              statusFilter === s ? 'ring-accent-meta' : 'ring-transparent', STATUS_META[s].cls)}>
            {STATUS_META[s].label}: {(summary as any)[s]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-white/60">
          {summary?.total} Zeilen gesamt
        </div>
      </div>

      {/* Mapping */}
      <details className={cn(CARD, 'p-4')}>
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-white">Spalten-Zuordnung {result?.unmapped.length ? `(${result.unmapped.length} unzugeordnet)` : ''}</summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fieldKeys.map((fk) => (
            <div key={fk} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-white/50">{IMPORT_FIELD_LABELS[fk]}</span>
              <select
                value={result?.mapping[fk] ?? ''}
                onChange={(e) => {
                  if (!result || !file) return;
                  const next = { ...result.mapping, [fk]: e.target.value || null };
                  runAnalyze(file, next);
                }}
                className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent-meta/30"
              >
                <option value="">— nicht zuordnen —</option>
                {result?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>
      </details>

      {/* Resolution controls */}
      <div className={cn(CARD, 'flex flex-wrap items-center gap-x-6 gap-y-3 p-4')}>
        <Control label="Duplikate (Ad + Datum)">
          <Segmented value={dup} onChange={(v) => setDup(v as DupStrategy)} options={[['update', 'Aktualisieren'], ['skip', 'Überspringen']]} />
        </Control>
        {!!summary?.unknown && (
          <Control label="Unbekannte Ads">
            <div className="flex items-center gap-2">
              <Segmented value={unknown} onChange={(v) => setUnknown(v as UnknownStrategy)} options={[['create', 'Neu anlegen'], ['skip', 'Überspringen']]} />
              {unknown === 'create' && (
                <select value={newAdProductId} onChange={(e) => setNewAdProductId(e.target.value)}
                  className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-meta/30">
                  <option value="">Produkt für neue Ads…</option>
                  {products?.items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              )}
            </div>
          </Control>
        )}
      </div>

      {/* Preview table */}
      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-gray-100 dark:border-white/8 bg-gray-50/60 dark:bg-white/[0.02]">
              <tr>
                {['#', 'Status', 'Ad', 'Meta Ad ID', 'Datum', 'Match', 'Werte / Hinweise'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {filtered.slice(0, 500).map((r) => <PreviewRowView key={r.rowIndex} r={r} />)}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && <div className="border-t border-gray-100 dark:border-white/8 px-3 py-2 text-xs text-gray-400">… {filtered.length - 500} weitere Zeilen (Vorschau begrenzt; Import umfasst alle).</div>}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/8 bg-white/90 dark:bg-[var(--card-bg)]/90 px-4 py-3 shadow-card backdrop-blur">
        <div className="text-sm text-gray-600 dark:text-white/60">
          <strong className="text-gray-900 dark:text-white">{willImport}</strong> Zeilen werden importiert
          {summary?.invalid ? <span className="text-red-600 dark:text-red-400"> · {summary.invalid} ungültig (übersprungen)</span> : null}
        </div>
        <button onClick={doCommit} disabled={commit.isPending || willImport === 0}
          className="rounded-lg bg-accent-meta px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
          {commit.isPending ? 'Importiere…' : 'Import bestätigen'}
        </button>
      </div>
    </div>
  );
}

function PreviewRowView({ r }: { r: PreviewRow }) {
  const s = STATUS_META[r.status];
  const Icon = s.icon;
  const td = 'px-3 py-2 align-top whitespace-nowrap';
  const vals = Object.entries(r.values).slice(0, 5).map(([k, v]) => `${IMPORT_FIELD_LABELS[k] ?? k}: ${v}`).join(' · ');
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
      <td className={cn(td, 'text-xs text-gray-400')}>{r.rowIndex}</td>
      <td className={td}>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}><Icon className="h-3 w-3" />{s.label}</span>
      </td>
      <td className={cn(td, 'max-w-[220px] truncate text-gray-700 dark:text-white/80')}>{r.adName ?? '—'}</td>
      <td className={cn(td, 'text-xs text-gray-500 dark:text-white/50')}>{r.metaAdId ?? '—'}</td>
      <td className={cn(td, 'text-gray-700 dark:text-white/80')}>
        {r.date ?? '—'}{r.dateAmbiguous && <span className="ml-1 text-amber-500" title="Mehrdeutiges Datumsformat">⚠</span>}
      </td>
      <td className={cn(td, 'text-xs')}>
        {r.matchedAdName ? <span className="text-gray-600 dark:text-white/60">{r.matchedAdName}{r.matchedBy === 'name' && <em className="text-amber-500"> (Name)</em>}</span> : <span className="text-gray-400">—</span>}
      </td>
      <td className={cn('px-3 py-2 align-top text-xs', r.errors.length ? 'text-red-600 dark:text-red-400' : r.warnings.length ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-white/50')}>
        {r.errors.length ? r.errors.join('; ') : r.warnings.length ? r.warnings.join('; ') : vals || '—'}
      </td>
    </tr>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-white/50">{label}</span>
      {children}
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-white/5 p-0.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          value === v ? 'bg-white dark:bg-white/15 text-accent-meta shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white',
        )}>{l}</button>
      ))}
    </div>
  );
}

function buildCommitRows(rows: PreviewRow[], dup: DupStrategy, unknown: UnknownStrategy, newAdProductId: string | null): CommitRow[] {
  const out: CommitRow[] = [];
  for (const r of rows) {
    const base = { date: r.date ?? '', values: r.values };
    if (r.status === 'invalid') { out.push({ ...base, action: 'skip' }); continue; }
    if (r.status === 'unknown') {
      const name = r.adName || r.metaAdId;
      if (unknown === 'skip' || !newAdProductId || !name) { out.push({ ...base, action: 'skip' }); continue; }
      out.push({ ...base, action: 'insert', createAd: { name, productId: newAdProductId, metaAdId: r.metaAdId ?? null } });
      continue;
    }
    if (r.status === 'duplicate') {
      if (dup === 'skip') { out.push({ ...base, action: 'skip' }); continue; }
      out.push({ ...base, action: 'update', adId: r.matchedAdId });
      continue;
    }
    // ready | warning
    out.push({ ...base, action: 'insert', adId: r.matchedAdId });
  }
  return out;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function HistoryPanel() {
  const { data, isLoading } = useImportHistory();
  const [open, setOpen] = useState<string | null>(null);
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
  const td = 'px-3 py-2.5 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';
  const statusCls: Record<string, string> = {
    completed: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/15',
    partial: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15',
    failed: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/15',
  };

  if (isLoading) return <div className={cn(CARD, 'h-40 animate-pulse bg-gray-50 dark:bg-white/5')} />;
  if (!data?.items.length) return (
    <div className={cn(CARD, 'flex flex-col items-center gap-2 py-16 text-center')}>
      <Clock className="h-8 w-8 text-gray-300 dark:text-white/20" />
      <div className="text-sm font-medium text-gray-700 dark:text-white/70">Noch kein Report importiert.</div>
    </div>
  );

  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-gray-100 dark:border-white/8 bg-gray-50/60 dark:bg-white/[0.02]">
            <tr>
              {['Datum', 'Typ', 'Datei', 'Status', 'Zeilen', 'Neu', 'Aktual.', 'Übersprungen', 'Fehler', ''].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {data.items.map((im) => (
              <Fragment key={im.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className={td}>{im.createdAt ? new Date(im.createdAt).toLocaleString('de-DE') : '—'}</td>
                  <td className={cn(td, 'uppercase text-xs font-medium')}>{im.type}</td>
                  <td className={cn(td, 'max-w-[220px] truncate')}>{im.filename}</td>
                  <td className={td}><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusCls[im.status] ?? '')}>{im.status}</span></td>
                  <td className={cn(td, 'text-right')}>{im.rowCount}</td>
                  <td className={cn(td, 'text-right')}>{im.successCount}</td>
                  <td className={cn(td, 'text-right')}>{im.updatedCount}</td>
                  <td className={cn(td, 'text-right')}>{im.skippedCount}</td>
                  <td className={cn(td, 'text-right', im.errorCount ? 'text-red-600 dark:text-red-400' : '')}>{im.errorCount}</td>
                  <td className={cn(td, 'text-right')}>
                    {(im.errorSummary?.length || im.mappingConfig) ? (
                      <button onClick={() => setOpen(open === im.id ? null : im.id)} className="text-xs font-medium text-accent-meta hover:underline">Details</button>
                    ) : null}
                  </td>
                </tr>
                {open === im.id && (
                  <tr>
                    <td colSpan={10} className="bg-gray-50/60 dark:bg-white/[0.02] px-4 py-3">
                      {im.errorSummary?.length ? (
                        <div className="mb-2">
                          <div className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">Fehler ({im.errorSummary.length})</div>
                          <ul className="space-y-0.5 text-xs text-gray-600 dark:text-white/60">
                            {im.errorSummary.slice(0, 20).map((e, i) => <li key={i}>Zeile {e.row}: {e.message}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {im.mappingConfig ? (
                        <div className="text-xs text-gray-500 dark:text-white/50">
                          <span className="font-semibold">Mapping:</span>{' '}
                          {Object.entries(im.mappingConfig).filter(([, v]) => v).map(([k, v]) => `${IMPORT_FIELD_LABELS[k] ?? k} ← ${v}`).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
