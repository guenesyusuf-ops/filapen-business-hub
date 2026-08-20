'use client';

import { useState } from 'react';
import { Upload, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import { profitAnalysisApi, ImportPreviewResult, ImportPreviewRow } from '@/lib/profit-analysis/api';
import { cn } from '@/lib/utils';

export default function ImportPage() {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ written: number; skipped: number } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    await runPreview(text);
  }

  async function runPreview(text: string) {
    setLoading(true); setError(null); setPreview(null); setConfirmed(null);
    try {
      const res = await profitAnalysisApi.import.preview(text);
      setPreview(res);
      // Alle fehlerfreien Zeilen initial ausgewählt
      const ok = new Set(res.rows.filter((r) => r.errors.length === 0).map((r) => r.rowIndex));
      setSelectedRows(ok);
    } catch (e: any) { setError(e?.message ?? 'Preview fehlgeschlagen'); }
    finally { setLoading(false); }
  }

  async function runConfirm() {
    if (!preview) return;
    setLoading(true); setError(null);
    try {
      const rows = preview.rows.filter((r) => selectedRows.has(r.rowIndex));
      const res = await profitAnalysisApi.import.confirm(rows);
      setConfirmed(res);
    } catch (e: any) { setError(e?.message ?? 'Import fehlgeschlagen'); }
    finally { setLoading(false); }
  }

  function toggleRow(idx: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-lg font-bold">Import (CSV)</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Tageswerte via CSV importieren. Erst Vorschau, dann bestätigen — keine stillen Overrides.
        </p>
      </div>

      {/* CSV-Format-Hinweis */}
      <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50/50 dark:bg-white/[0.02] p-3 text-xs">
        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">CSV-Format</div>
        <div className="text-slate-600 dark:text-slate-400">Erste Zeile = Header. Trenner: Semikolon oder Komma. Erkannte Spalten (in beliebiger Reihenfolge):</div>
        <code className="block mt-1 bg-white dark:bg-white/5 p-2 rounded text-[11px] overflow-x-auto">
          Datum;Kanal;Brutto19;Brutto7;Retouren19;Retouren7;Meta;Google;Influencer;AmazonPPC;TikTokAds;ShopifyPakete;TikTokPakete
        </code>
        <div className="mt-1 text-slate-500">Datum: DD.MM.YYYY oder YYYY-MM-DD · Kanal: shopify|amazon|tiktok · Zahlen: 1.234,56 oder 1234.56</div>
      </div>

      {/* Upload */}
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center">
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" id="csv-upload" />
        <label htmlFor="csv-upload" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold cursor-pointer">
          <Upload className="h-4 w-4" /> CSV-Datei auswählen
        </label>
        <div className="text-xs text-slate-500 mt-2">oder Text unten einfügen und "Vorschau" klicken</div>
        <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={4}
          placeholder="Datum;Kanal;Brutto19;…"
          className="w-full mt-3 rounded-lg border border-slate-300 dark:border-white/10 dark:bg-white/5 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
        <button onClick={() => runPreview(csvText)} disabled={!csvText.trim() || loading}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
          Vorschau
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {confirmed && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          Import abgeschlossen: {confirmed.written} Zeilen geschrieben, {confirmed.skipped} übersprungen.
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Wird verarbeitet …</div>}

      {preview && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.02]">
            <div className="text-sm">
              <span className="font-semibold">{preview.totalRows} Zeilen</span>
              {preview.errorCount > 0 && <span className="text-red-600 ml-2">· {preview.errorCount} mit Fehlern</span>}
              <span className="text-slate-500 ml-2">· {selectedRows.size} ausgewählt</span>
            </div>
            <button onClick={runConfirm} disabled={selectedRows.size === 0 || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              Ausgewählte importieren
            </button>
          </div>

          {preview.warnings.length > 0 && (
            <div className="p-3 border-b border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/[0.05]">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">{preview.warnings.length} Warnung{preview.warnings.length !== 1 ? 'en' : ''}</div>
              <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5 list-disc list-inside">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-white/[0.02] text-slate-500 z-10">
                <tr>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2 text-left">Zeile</th>
                  <th className="px-2 py-2 text-left">Datum</th>
                  <th className="px-2 py-2 text-left">Kanal</th>
                  <th className="px-2 py-2 text-right">Brutto19</th>
                  <th className="px-2 py-2 text-right">Brutto7</th>
                  <th className="px-2 py-2 text-right">Ret.19</th>
                  <th className="px-2 py-2 text-right">Ret.7</th>
                  <th className="px-2 py-2 text-right">Meta</th>
                  <th className="px-2 py-2 text-right">Google</th>
                  <th className="px-2 py-2 text-right">Pakete Sh.</th>
                  <th className="px-2 py-2 text-right">Pakete TT</th>
                  <th className="px-2 py-2 text-left">Fehler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {preview.rows.map((r) => {
                  const isSel = selectedRows.has(r.rowIndex);
                  const hasErr = r.errors.length > 0;
                  return (
                    <tr key={r.rowIndex} className={cn(hasErr ? 'bg-red-50 dark:bg-red-500/[0.05]' : isSel ? 'bg-emerald-50/50 dark:bg-emerald-500/[0.03]' : '')}>
                      <td className="px-2 py-1"><input type="checkbox" checked={isSel} disabled={hasErr} onChange={() => toggleRow(r.rowIndex)} /></td>
                      <td className="px-2 py-1 tabular-nums">{r.rowIndex}</td>
                      <td className="px-2 py-1 tabular-nums">{r.date}</td>
                      <td className="px-2 py-1">{r.channel ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.gross19 ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.gross7 ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.returns19 ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.returns7 ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.meta ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.google ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.shopifyPackages ?? ''}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.parsed.tiktokPackages ?? ''}</td>
                      <td className="px-2 py-1 text-red-600">{r.errors.join('; ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
