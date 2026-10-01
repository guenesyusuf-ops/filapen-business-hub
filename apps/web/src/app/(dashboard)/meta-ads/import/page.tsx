'use client';

import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Copy,
  ArrowLeft, ArrowRight, Clock, Check, PartyPopper, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { MetaPageHeader, MetaSectionHeader, MetaEmptyState, META_CARD } from '@/components/meta-ads/MetaUI';
import { useMetaProducts } from '@/hooks/meta-ads/useMetaAds';
import {
  useAnalyzeImport, useCommitImport, useImportHistory,
  ImportType, AnalyzeResult, PreviewRow, CommitRow, CommitResult, RowStatus,
  IMPORT_FIELD_LABELS, META_FIELD_KEYS, HYROS_FIELD_KEYS,
} from '@/hooks/meta-ads/useMetaImport';

type Tab = 'meta' | 'hyros' | 'history';
type Step = 'upload' | 'mapping' | 'preview' | 'done';
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
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-4 sm:p-6">
      <MetaPageHeader
        eyebrow="Meta Ads"
        title="Import"
        description="Meta- und Hyros-Reports als CSV/XLSX importieren. Nichts wird ungeprüft gespeichert — erst Vorschau, dann Bestätigung."
      >
        <div className="flex gap-1 self-start rounded-xl bg-gray-100 p-1 dark:bg-white/5">
          {([['meta', 'Meta Report'], ['hyros', 'Hyros Report'], ['history', 'Import-Verlauf']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-white text-accent-meta shadow-sm dark:bg-white/15' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white',
            )}>{l}</button>
          ))}
        </div>
      </MetaPageHeader>

      {tab === 'history' ? <HistoryPanel /> : <ImportFlow key={tab} type={tab} onViewHistory={() => setTab('history')} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'mapping', label: 'Zuordnung' },
  { key: 'preview', label: 'Vorschau' },
  { key: 'done', label: 'Bestätigt' },
];

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <Fragment key={s.key}>
            <div className="flex items-center gap-2">
              <span className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                done ? 'bg-accent-meta text-white' : active ? 'bg-accent-meta/15 text-accent-meta ring-2 ring-accent-meta/30' : 'bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-white/40',
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('text-sm font-medium', active ? 'text-gray-900 dark:text-white' : done ? 'text-gray-600 dark:text-white/60' : 'text-gray-400 dark:text-white/40')}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={cn('mx-3 h-px flex-1 min-w-[16px]', done ? 'bg-accent-meta/40' : 'bg-gray-200 dark:bg-white/10')} />}
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import flow
// ---------------------------------------------------------------------------

function ImportFlow({ type, onViewHistory }: { type: ImportType; onViewHistory: () => void }) {
  const toast = useToast();
  const analyze = useAnalyzeImport();
  const commit = useCommitImport();
  const { data: products } = useMetaProducts();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [detected, setDetected] = useState<Record<string, string | null>>({});
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'all'>('all');
  const [dup, setDup] = useState<DupStrategy>('update');
  const [unknown, setUnknown] = useState<UnknownStrategy>('skip');
  const [newAdProductId, setNewAdProductId] = useState('');
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const fieldKeys = type === 'meta' ? META_FIELD_KEYS : HYROS_FIELD_KEYS;

  const runAnalyze = useCallback(async (f: File, mapping?: Record<string, string | null>, goTo?: Step) => {
    try {
      const res = await analyze.mutateAsync({ type, file: f, mapping });
      setResult(res);
      if (!mapping) setDetected(res.mapping);
      if (goTo) setStep(goTo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analyse fehlgeschlagen');
    }
  }, [analyze, type, toast]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f); setEdited(new Set());
    runAnalyze(f, undefined, 'mapping');
  };

  const changeMapping = (field: string, header: string) => {
    if (!result || !file) return;
    const next = { ...result.mapping, [field]: header || null };
    setEdited((s) => new Set(s).add(field));
    runAnalyze(file, next);
  };

  const summary = result?.summary;
  const rows = result?.rows ?? [];
  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);
  const plan = useMemo(() => buildCommitRows(rows, dup, unknown, newAdProductId || null), [rows, dup, unknown, newAdProductId]);
  const willImport = plan.filter((p) => p.action !== 'skip').length;

  const reset = () => {
    setStep('upload'); setFile(null); setResult(null); setDetected({}); setEdited(new Set());
    setStatusFilter('all'); setCommitResult(null); setNewAdProductId('');
  };

  const doCommit = async () => {
    if (!result) return;
    if (unknown === 'create' && !newAdProductId && summary && summary.unknown > 0) {
      toast.error('Produkt für neue Ads wählen oder unbekannte Ads überspringen'); return;
    }
    try {
      const res = await commit.mutateAsync({ type, filename: result.filename, mappingConfig: result.mapping, rows: plan });
      setCommitResult(res);
      setStep('done');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import fehlgeschlagen');
    }
  };

  const mapStatus = (field: string): 'erkannt' | 'manuell' | 'offen' => {
    if (!result?.mapping[field]) return 'offen';
    if (edited.has(field)) return 'manuell';
    return 'erkannt';
  };

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(META_CARD, 'px-5 py-4')}><Stepper current={step} /></div>

      {/* STEP: Upload */}
      {step === 'upload' && (
        <div className={cn(META_CARD, 'p-8')}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
              dragOver ? 'border-accent-meta bg-accent-meta/5' : 'border-gray-300 hover:border-accent-meta/50 dark:border-white/15')}
          >
            <div className="rounded-full bg-accent-meta/10 p-4"><UploadCloud className="h-7 w-7 text-accent-meta" /></div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {analyze.isPending ? 'Datei wird analysiert…' : `${type === 'meta' ? 'Meta' : 'Hyros'}-Report hierher ziehen`}
              </div>
              <div className="mt-1 text-xs text-gray-400 dark:text-white/40">oder klicken — CSV oder XLSX</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
          </div>
          <p className="mt-4 text-xs text-gray-400 dark:text-white/40">
            Zuordnung über Meta Ad ID (sonst eindeutiger Ad-Name). Die Datei wird nur verarbeitet, nicht gespeichert.
          </p>
        </div>
      )}

      {/* STEP: Mapping */}
      {step === 'mapping' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Andere Datei</button>
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50"><FileSpreadsheet className="h-4 w-4" /> {file?.name}</span>
          </div>
          <div className={cn(META_CARD, 'p-5')}>
            <MetaSectionHeader title="Spalten-Zuordnung" description="Quellspalte → Filapen-Feld. Vorschlag ist editierbar." className="mb-4" />
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {fieldKeys.map((fk) => {
                const st = mapStatus(fk);
                return (
                  <div key={fk} className="flex items-center gap-3 rounded-lg px-1 py-1">
                    <span className="w-36 shrink-0 text-sm font-medium text-gray-700 dark:text-white/80">{IMPORT_FIELD_LABELS[fk]}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-white/20" />
                    <select value={result.mapping[fk] ?? ''} onChange={(e) => changeMapping(fk, e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-meta/30">
                      <option value="">— nicht zuordnen —</option>
                      {result.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className={cn('w-20 shrink-0 text-right text-[11px] font-medium',
                      st === 'erkannt' ? 'text-green-600 dark:text-green-400' : st === 'manuell' ? 'text-accent-meta' : 'text-gray-400 dark:text-white/40')}>
                      {st === 'erkannt' ? 'erkannt' : st === 'manuell' ? 'manuell' : 'offen'}
                    </span>
                  </div>
                );
              })}
            </div>
            {result.unmapped.length > 0 && (
              <p className="mt-3 text-xs text-gray-400 dark:text-white/40">Nicht zugeordnete Spalten: {result.unmapped.join(', ')}</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-white/50">{summary?.total} Zeilen erkannt</span>
            <button onClick={() => setStep('preview')} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-5 py-2 text-sm font-medium text-white hover:opacity-90">
              Weiter zur Vorschau <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP: Preview */}
      {step === 'preview' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('mapping')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Zuordnung</button>
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50"><FileSpreadsheet className="h-4 w-4" /> {file?.name}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {summary && (['ready', 'warning', 'duplicate', 'unknown', 'invalid'] as RowStatus[]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset',
                  statusFilter === s ? 'ring-accent-meta' : 'ring-transparent', STATUS_META[s].cls)}>
                {STATUS_META[s].label}: {(summary as any)[s]}
              </button>
            ))}
            <div className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-white/60">{summary?.total} Zeilen gesamt</div>
          </div>

          <div className={cn(META_CARD, 'flex flex-wrap items-center gap-x-6 gap-y-3 p-4')}>
            <Control label="Duplikate (Ad + Datum)">
              <Segmented value={dup} onChange={(v) => setDup(v as DupStrategy)} options={[['update', 'Aktualisieren'], ['skip', 'Überspringen']]} />
            </Control>
            {!!summary?.unknown && (
              <Control label="Unbekannte Ads">
                <div className="flex items-center gap-2">
                  <Segmented value={unknown} onChange={(v) => setUnknown(v as UnknownStrategy)} options={[['create', 'Neu anlegen'], ['skip', 'Überspringen']]} />
                  {unknown === 'create' && (
                    <select value={newAdProductId} onChange={(e) => setNewAdProductId(e.target.value)} className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-meta/30">
                      <option value="">Produkt für neue Ads…</option>
                      {products?.items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  )}
                </div>
              </Control>
            )}
          </div>

          <div className={cn(META_CARD, 'overflow-hidden')}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/50 dark:border-white/8 dark:bg-white/[0.02]">
                  <tr>{['#', 'Status', 'Ad', 'Meta Ad ID', 'Datum', 'Match', 'Werte / Hinweise'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                  {filtered.slice(0, 500).map((r) => <PreviewRowView key={r.rowIndex} r={r} />)}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400 dark:border-white/8">… {filtered.length - 500} weitere (Vorschau begrenzt; Import umfasst alle).</div>}
          </div>

          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-card backdrop-blur dark:border-white/8 dark:bg-[var(--card-bg)]/90">
            <div className="text-sm text-gray-600 dark:text-white/60">
              <strong className="text-gray-900 dark:text-white">{willImport}</strong> Zeilen werden importiert
              {summary?.invalid ? <span className="text-red-600 dark:text-red-400"> · {summary.invalid} ungültig</span> : null}
            </div>
            <button onClick={doCommit} disabled={commit.isPending || willImport === 0} className="rounded-lg bg-accent-meta px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
              {commit.isPending ? 'Importiere…' : 'Import bestätigen'}
            </button>
          </div>
        </div>
      )}

      {/* STEP: Done */}
      {step === 'done' && commitResult && (
        <div className={cn(META_CARD, 'flex flex-col items-center gap-5 px-6 py-12 text-center')}>
          <div className={cn('rounded-full p-4', commitResult.status === 'failed' ? 'bg-red-100 text-red-600 dark:bg-red-500/15' : 'bg-green-100 text-green-600 dark:bg-green-500/15')}>
            {commitResult.status === 'failed' ? <XCircle className="h-8 w-8" /> : <PartyPopper className="h-8 w-8" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {commitResult.status === 'completed' ? 'Import abgeschlossen' : commitResult.status === 'partial' ? 'Import teilweise abgeschlossen' : 'Import fehlgeschlagen'}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-white/50">{result?.filename}</p>
          </div>
          <div className="grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="Neu" value={commitResult.summary.created} tone="green" />
            <ResultStat label="Aktualisiert" value={commitResult.summary.updated} tone="blue" />
            <ResultStat label="Übersprungen" value={commitResult.summary.skipped} />
            <ResultStat label="Fehler" value={commitResult.summary.errors} tone={commitResult.summary.errors ? 'red' : undefined} />
          </div>
          {commitResult.errorDetails.length > 0 && (
            <div className="w-full max-w-lg rounded-lg bg-red-50 p-3 text-left text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {commitResult.errorDetails.slice(0, 5).map((d, i) => <div key={i}>Zeile {d.row}: {d.message}</div>)}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/meta-ads/ads" className="inline-flex items-center gap-1.5 rounded-lg bg-accent-meta px-4 py-2 text-sm font-medium text-white hover:opacity-90">Zu den Ads</Link>
            <button onClick={onViewHistory} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent-meta/40"><ListChecks className="h-4 w-4" /> Import-Verlauf</button>
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent-meta/40"><UploadCloud className="h-4 w-4" /> Weiterer Report</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'blue' | 'red' }) {
  const cls = tone === 'green' ? 'text-green-600 dark:text-green-400' : tone === 'blue' ? 'text-accent-meta' : tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-3 dark:bg-white/5">
      <div className={cn('text-2xl font-semibold tabular-nums', cls)}>{value}</div>
      <div className="mt-0.5 text-xs text-gray-500 dark:text-white/50">{label}</div>
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
      <td className={td}><span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}><Icon className="h-3 w-3" />{s.label}</span></td>
      <td className={cn(td, 'max-w-[220px] truncate text-gray-700 dark:text-white/80')}>{r.adName ?? '—'}</td>
      <td className={cn(td, 'text-xs text-gray-500 dark:text-white/50')}>{r.metaAdId ?? '—'}</td>
      <td className={cn(td, 'text-gray-700 dark:text-white/80')}>{r.date ?? '—'}{r.dateAmbiguous && <span className="ml-1 text-amber-500" title="Mehrdeutiges Datumsformat">⚠</span>}</td>
      <td className={cn(td, 'text-xs')}>{r.matchedAdName ? <span className="text-gray-600 dark:text-white/60">{r.matchedAdName}{r.matchedBy === 'name' && <em className="text-amber-500"> (Name)</em>}</span> : <span className="text-gray-400">—</span>}</td>
      <td className={cn('px-3 py-2 align-top text-xs', r.errors.length ? 'text-red-600 dark:text-red-400' : r.warnings.length ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-white/50')}>
        {r.errors.length ? r.errors.join('; ') : r.warnings.length ? r.warnings.join('; ') : vals || '—'}
      </td>
    </tr>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><span className="text-xs font-medium text-gray-500 dark:text-white/50">{label}</span>{children}</div>;
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          value === v ? 'bg-white text-accent-meta shadow-sm dark:bg-white/15' : 'text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white')}>{l}</button>
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
      out.push({ ...base, action: 'update', adId: r.matchedAdId }); continue;
    }
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
  const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/40 whitespace-nowrap';
  const td = 'px-3 py-2.5 text-sm tabular-nums whitespace-nowrap text-gray-700 dark:text-white/80';
  const statusCls: Record<string, string> = {
    completed: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/15',
    partial: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15',
    failed: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/15',
  };

  if (isLoading) return <div className={cn(META_CARD, 'h-40 animate-pulse bg-gray-50 dark:bg-white/5')} />;
  if (!data?.items.length) return <MetaEmptyState icon={Clock} title="Noch kein Report importiert" description="Importierte Meta-/Hyros-Reports erscheinen hier mit Zusammenfassung und Fehlern." />;

  return (
    <div className={cn(META_CARD, 'overflow-hidden')}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-gray-100 bg-gray-50/50 dark:border-white/8 dark:bg-white/[0.02]">
            <tr>{['Datum', 'Typ', 'Datei', 'Status', 'Zeilen', 'Neu', 'Aktual.', 'Übersprungen', 'Fehler', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {data.items.map((im) => (
              <Fragment key={im.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className={td}>{im.createdAt ? new Date(im.createdAt).toLocaleString('de-DE') : '—'}</td>
                  <td className={cn(td, 'text-xs font-medium uppercase')}>{im.type}</td>
                  <td className={cn(td, 'max-w-[220px] truncate')}>{im.filename}</td>
                  <td className={td}><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusCls[im.status] ?? '')}>{im.status}</span></td>
                  <td className={cn(td, 'text-right')}>{im.rowCount}</td>
                  <td className={cn(td, 'text-right')}>{im.successCount}</td>
                  <td className={cn(td, 'text-right')}>{im.updatedCount}</td>
                  <td className={cn(td, 'text-right')}>{im.skippedCount}</td>
                  <td className={cn(td, 'text-right', im.errorCount ? 'text-red-600 dark:text-red-400' : '')}>{im.errorCount}</td>
                  <td className={cn(td, 'text-right')}>{(im.errorSummary?.length || im.mappingConfig) ? <button onClick={() => setOpen(open === im.id ? null : im.id)} className="text-xs font-medium text-accent-meta hover:underline">Details</button> : null}</td>
                </tr>
                {open === im.id && (
                  <tr>
                    <td colSpan={10} className="bg-gray-50/50 px-4 py-3 dark:bg-white/[0.02]">
                      {im.errorSummary?.length ? (
                        <div className="mb-2">
                          <div className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">Fehler ({im.errorSummary.length})</div>
                          <ul className="space-y-0.5 text-xs text-gray-600 dark:text-white/60">{im.errorSummary.slice(0, 20).map((e, i) => <li key={i}>Zeile {e.row}: {e.message}</li>)}</ul>
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
