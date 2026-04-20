'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, FileSpreadsheet, Eye, Check } from 'lucide-react';
import { purchasesApi } from '@/lib/purchases';
import { btn, input, label, PageHeader } from '@/components/purchases/PurchaseUI';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

const EXPORTS = [
  { type: 'tax', title: 'Steuerberater-Export', description: 'Vollständiger Hauptexport mit allen kaufmännisch relevanten Spalten + Konto-Vorschlag (SKR03/SKR04). Empfohlen für die monatliche/quartalsweise Übergabe.', accent: 'green', icon: FileSpreadsheet },
  { type: 'master', title: 'Bestellungen Master', description: 'Eine Zeile pro Bestellung mit Summen, Lieferant, Status und Zahlungen.', accent: 'blue', icon: FileText },
  { type: 'items', title: 'Bestellpositionen Detail', description: 'Eine Zeile pro Produkt-Position. Joinbar via Bestellnummer.', accent: 'indigo', icon: FileText },
  { type: 'payments', title: 'Zahlungen', description: 'Eine Zeile pro Zahlung — für die Bankabstimmung.', accent: 'green', icon: FileText },
  { type: 'invoices', title: 'Rechnungen', description: 'Alle erfassten Rechnungen.', accent: 'amber', icon: FileText },
  { type: 'open', title: 'Offene Posten', description: 'Nur Bestellungen mit offener Restsumme inkl. Tage-überfällig-Berechnung.', accent: 'red', icon: FileText },
  { type: 'datev', title: 'DATEV-Buchungsstapel', description: 'Vereinfachtes DATEV-CSV — Belege mit Konto/Gegenkonto. Direkt importierbar in den meisten Buchhaltungssystemen.', accent: 'purple', icon: FileSpreadsheet },
];

export default function ExportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [skr, setSkr] = useState<'SKR03' | 'SKR04'>('SKR03');
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [previewType, setPreviewType] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    purchasesApi.listSuppliers().then(setSuppliers);
  }, []);

  const params = { from, to, supplierId, skr };

  const onPreview = async (type: string) => {
    setPreviewType(type);
    setPreview(null);
    setLoadingPreview(true);
    try {
      const r = await purchasesApi.exportPreview(type, params as any);
      setPreview(r);
    } catch (e: any) { setPreview({ error: e.message }); }
    finally { setLoadingPreview(false); }
  };

  // Auth-protected download via fetch + blob
  const onDownload = async (type: string) => {
    const url = purchasesApi.exportDownloadUrl(type, params as any);
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) { alert('Download fehlgeschlagen'); return; }
    const blob = await res.blob();
    const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] || `${type}.csv`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Export-Center"
        subtitle="CSV-Exporte für Buchhaltung und Steuerberater (UTF-8 + BOM, Semikolon-Trenner, deutsche Zahlenformate)"
      />

      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={label()}>Von</label><input type="date" className={input()} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className={label()}>Bis</label><input type="date" className={input()} value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <label className={label()}>Lieferant</label>
            <select className={input()} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Alle</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className={label()}>Kontenrahmen (SKR)</label>
            <select className={input()} value={skr} onChange={(e) => setSkr(e.target.value as any)}>
              <option value="SKR03">SKR03 (Standard, Industrie)</option>
              <option value="SKR04">SKR04 (Branchen-spezifisch)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {[
            { label: 'Aktueller Monat', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() },
            { label: 'Letzter Monat', from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), to: new Date(new Date().getFullYear(), new Date().getMonth(), 0) },
            { label: 'Aktuelles Quartal', from: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), to: new Date() },
            { label: 'Aktuelles Jahr', from: new Date(new Date().getFullYear(), 0, 1), to: new Date() },
            { label: 'Alles', from: null, to: null },
          ].map((q) => (
            <button key={q.label} onClick={() => { setFrom(q.from ? q.from.toISOString().slice(0, 10) : ''); setTo(q.to ? q.to.toISOString().slice(0, 10) : ''); }} className="px-2.5 py-1 rounded-md text-xs bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10">{q.label}</button>
          ))}
        </div>
      </div>

      {/* Exports grid */}
      <div className="grid md:grid-cols-2 gap-3">
        {EXPORTS.map((ex) => {
          const Icon = ex.icon;
          return (
            <div key={ex.type} className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0 from-${ex.accent}-500 to-${ex.accent}-600`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{ex.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ex.description}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => onPreview(ex.type)} className={btn('secondary')}><Eye className="h-3.5 w-3.5" /> Vorschau</button>
                <button onClick={() => onDownload(ex.type)} className={btn('primary', 'flex-1 justify-center')}><Download className="h-3.5 w-3.5" /> CSV laden</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewType && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreviewType(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Vorschau: {EXPORTS.find(e => e.type === previewType)?.title}</h3>
                {preview?.totalLines !== undefined && <p className="text-xs text-gray-500 mt-0.5">{preview.totalLines} Zeile(n) gesamt · zeigt erste 10</p>}
              </div>
              <button onClick={() => setPreviewType(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingPreview ? <div className="text-center py-12 text-sm text-gray-400">Lädt …</div> :
               preview?.error ? <div className="text-sm text-red-600">{preview.error}</div> :
               preview?.preview ? (
                <pre className="text-xs font-mono whitespace-pre overflow-auto bg-gray-50 dark:bg-black/40 p-3 rounded-lg text-gray-700 dark:text-gray-200">{preview.preview}</pre>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
              <button onClick={() => setPreviewType(null)} className={btn('ghost')}>Schließen</button>
              <button onClick={() => { onDownload(previewType); }} className={btn('primary')}><Download className="h-4 w-4" /> CSV laden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
