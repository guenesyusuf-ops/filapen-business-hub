'use client';

import { useState } from 'react';
import { Download, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { salesApi } from '@/lib/sales';
import { PageHeader, btn } from '@/components/sales/SalesUI';

// Default: current month — häufigster Anwendungsfall (monatliche Abrechnung).
function defaultFromTo(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

export default function SalesExportPage() {
  const init = defaultFromTo();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    if (!from || !to) {
      setError('Bitte Zeitraum wählen.');
      return;
    }
    if (from > to) {
      setError('Das "Bis"-Datum darf nicht vor dem "Von"-Datum liegen.');
      return;
    }
    setBusy(true);
    try {
      const { blob, filename } = await salesApi.downloadExport(from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Quick-select Zeiträume — spart dem User Klicks bei den Standard-Fällen
  function setPreset(kind: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_30') {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (kind === 'this_month') {
      setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (kind === 'last_month') {
      setFrom(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setTo(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else if (kind === 'this_quarter') {
      const q = Math.floor(now.getMonth() / 3);
      setFrom(iso(new Date(now.getFullYear(), q * 3, 1)));
      setTo(iso(new Date(now.getFullYear(), q * 3 + 3, 0)));
    } else if (kind === 'this_year') {
      setFrom(iso(new Date(now.getFullYear(), 0, 1)));
      setTo(iso(new Date(now.getFullYear(), 11, 31)));
    } else if (kind === 'last_30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setFrom(iso(d));
      setTo(iso(now));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Export"
        subtitle="CSV-Export aller B2B-Bestellungen für den gewählten Zeitraum (Excel-kompatibel)"
      />

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Zeitraum</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setPreset('this_month')} className={btn('ghost', 'text-xs')}>Dieser Monat</button>
            <button onClick={() => setPreset('last_month')} className={btn('ghost', 'text-xs')}>Letzter Monat</button>
            <button onClick={() => setPreset('this_quarter')} className={btn('ghost', 'text-xs')}>Dieses Quartal</button>
            <button onClick={() => setPreset('this_year')} className={btn('ghost', 'text-xs')}>Dieses Jahr</button>
            <button onClick={() => setPreset('last_30')} className={btn('ghost', 'text-xs')}>Letzte 30 Tage</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
            <label className="text-xs">
              <div className="text-gray-500 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Von
              </div>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs">
              <div className="text-gray-500 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Bis
              </div>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200/60 dark:border-white/5 pt-4">
          <div className="text-xs text-gray-500">
            <strong>24 Spalten:</strong> Bestellnummer, externe Nr., Bestelldatum, Liefertermin, Kunde,
            Produkte, Status, Beträge, Tracking, Zahlungsbedingungen, easybill-Refs uvm. Summe in
            der letzten Zeile.
          </div>
          <button onClick={download} disabled={busy} className={btn('primary')}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            CSV herunterladen
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <div><strong>Format:</strong> CSV mit Semikolon als Trennzeichen, UTF-8 mit BOM.</div>
        <div><strong>In Excel öffnen:</strong> Datei doppelklicken, Umlaute werden korrekt angezeigt.</div>
        <div><strong>In Google Sheets:</strong> Datei → Importieren → Trennzeichen "Semikolon" wählen.</div>
      </div>
    </div>
  );
}
