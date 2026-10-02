'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';
import { btnPrimary, btnGhost } from './MetaUI';
import { useAnalyzeImport, useCommitImport, AnalyzeResult, CommitRow } from '@/hooks/meta-ads/useMetaImport';

/**
 * Ad-scoped Schnell-Import im Ad-Detail: der bestehende Importer, aber mit der
 * geöffneten Ad als festem Zielkontext. Nur passende Zeilen werden übernommen,
 * andere Ads werden ignoriert. Kein zweites Importsystem.
 */
export function AdQuickImportModal({ open, onClose, adId, adName, adMetaId }: {
  open: boolean; onClose: () => void; adId: string; adName: string; adMetaId: string | null;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const analyze = useAnalyzeImport();
  const commit = useCommitImport();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [fileName, setFileName] = useState('');

  if (!open) return null;

  const matched = (result?.rows ?? []).filter((r) => r.matchedAdId === adId && r.date);
  const ignored = (result?.rows ?? []).length - matched.length;
  const fileHasOtherIds = (result?.rows ?? []).some((r) => r.metaAdId && (!adMetaId || r.metaAdId !== adMetaId));

  const reset = () => { setResult(null); setFileName(''); if (fileRef.current) fileRef.current.value = ''; };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    setFileName(file.name);
    try { setResult(await analyze.mutateAsync({ type: 'meta', file })); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Analyse fehlgeschlagen'); setResult(null); }
  };

  const doImport = async () => {
    if (!result || !matched.length) return;
    const rows: CommitRow[] = matched.map((r) => ({
      date: r.date as string,
      values: r.values,
      action: r.status === 'duplicate' ? 'update' : 'insert',
      adId, // Zielkontext erzwingen: immer die geöffnete Ad
    }));
    try {
      const res = await commit.mutateAsync({ type: 'meta', filename: result.filename, mappingConfig: result.mapping, rows });
      toast.success(`${res.summary.created + res.summary.updated} Tageswerte übernommen (${res.summary.created} neu, ${res.summary.updated} aktualisiert)`);
      // Refetch: Tageswerte, Retention, Components/Overlap, Baselines/Signale
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ad-metrics', adId] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'retention', adId] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ad-components', adId] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'overview'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'creative-lab'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
      close();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Import fehlgeschlagen'); }
  };

  const inp = 'h-[38px] rounded-[9px] border border-gray-200 bg-white px-3 text-[13px] dark:border-white/[0.1] dark:bg-[var(--card-bg)] dark:text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/45 p-4 sm:p-8" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="my-2 w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(20,20,30,.3)] dark:border-white/[0.12] dark:bg-[var(--card-bg)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-white/[0.07]">
          <div>
            <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">Meta-Datei hochladen</h2>
            <p className="mt-0.5 text-[13px] text-gray-500 dark:text-white/50">Zielkontext: <b>{adName}</b>{adMetaId ? ` · Meta Ad ID ${adMetaId}` : ' · ohne Meta Ad ID → Zuordnung über exakten Ad-Namen'}</p>
          </div>
          <button onClick={close} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className={cn(inp, 'flex-1')}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            {analyze.isPending && <Loader2 className="h-4 w-4 animate-spin text-accent-meta" />}
          </div>

          {result && (
            <>
              {matched.length > 0 ? (
                <div className="rounded-[10px] border border-green-200 bg-green-50 px-3.5 py-2.5 text-[12.5px] text-green-800 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300">
                  <b>{matched.length}</b> Tageswert{matched.length === 1 ? '' : 'e'} für diese Ad gefunden.{ignored > 0 ? ` ${ignored} Zeile${ignored === 1 ? '' : 'n'} anderer Ads werden ignoriert.` : ''}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Keine Zeile passt zu dieser Ad.{fileHasOtherIds ? ' Die Datei enthält andere Meta Ad IDs/Namen — prüfe, ob du die richtige Datei/Ad gewählt hast.' : ' Prüfe Ad-Name bzw. Meta Ad ID.'} ({(result.rows ?? []).length} Zeilen gesamt)</span>
                </div>
              )}

              {matched.length > 0 && (
                <div className="max-h-[220px] overflow-auto rounded-[10px] border border-gray-200 dark:border-white/[0.08]">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-white/50">
                      <tr><th className="px-3 py-1.5 text-left">Datum</th><th className="px-3 py-1.5 text-right">Spend</th><th className="px-3 py-1.5 text-right">Impr.</th><th className="px-3 py-1.5 text-right">Hook%</th><th className="px-3 py-1.5 text-left">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                      {matched.slice(0, 60).map((r) => (
                        <tr key={r.rowIndex}>
                          <td className="px-3 py-1.5 tabular-nums">{r.date}{r.dateAmbiguous ? ' ⚠' : ''}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{r.values.spend ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{r.values.impressions ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{r.values.hookRate ?? '—'}</td>
                          <td className="px-3 py-1.5 text-gray-400 dark:text-white/40">{r.status === 'duplicate' ? 'Update' : 'Neu'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-gray-400 dark:text-white/40">Regeln: leere Felder überschreiben nicht · 0 wird geschrieben · Hyros-Werte bleiben unberührt · gleiche Ad + Datum = Upsert.</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.07]">
          <button onClick={close} className={btnGhost}>Abbrechen</button>
          <button onClick={doImport} disabled={!matched.length || commit.isPending} className={btnPrimary}>
            {commit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {matched.length ? `${matched.length} übernehmen` : 'Importieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
