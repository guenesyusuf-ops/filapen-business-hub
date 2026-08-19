'use client';

import { useEffect, useState } from 'react';
import { FileText, User as UserIcon, ExternalLink } from 'lucide-react';

/**
 * Audit-Log Seite. Zeigt die Aenderungshistorie aus dem zentralen AuditLog-Model.
 *
 * Fuer Phase 10 minimal implementiert: Verweis auf zentrales Audit-System.
 * Die konkreten pa_setting_history und pa_product_cost-Historien haben schon
 * eigene Timelines in ihren jeweiligen UI-Bereichen (Einstellungen, Produktkosten).
 *
 * Was hier landet ist die generelle Audit-Uebersicht — wird sichtbar sobald
 * das zentrale AuditLog fuer profit-analysis-Entitaeten befuellt wird
 * (Backend-Schreibvorgang der Aenderungen loggt).
 */
export default function AuditPage() {
  return (
    <div className="max-w-3xl">
      <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-6">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Audit Log</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Änderungshistorie aller finanziellen Datenpunkte. Nutzt das zentrale <code className="text-xs px-1 rounded bg-slate-100 dark:bg-white/5">AuditLog</code>-Model,
              das übergreifend für alle Module verwendet wird.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <TimelineHint
            title="Einstellungs-Änderungen"
            desc="Alle Änderungen an Gebühren, Versandkosten und Steuersätzen sind pro Kachel in den Einstellungen als Timeline sichtbar."
            href="/profit-analysis/einstellungen"
          />
          <TimelineHint
            title="Produktkosten-Änderungen"
            desc="Die vollständige Kosten- und Fulfillment-Historie pro Produkt öffnest du über die Detailansicht auf der Produktkosten-Seite."
            href="/profit-analysis/produktkosten"
          />
          <TimelineHint
            title="Monatsabschluss"
            desc="Schließt du einen Monat ab, wird ein vollständiger Snapshot des Berechnungsergebnisses in pa_month_snapshot eingefroren."
            href="/profit-analysis"
          />
        </div>

        <div className="mt-5 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] text-xs text-slate-500 dark:text-slate-400">
          <div className="font-semibold mb-1">Was gehört in einen Audit-Eintrag?</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Benutzer + Zeitpunkt</li>
            <li>Datensatz + Feld + alter Wert + neuer Wert</li>
            <li>Aktion und optionaler Grund</li>
          </ul>
          <div className="mt-2">Alle Setter-Endpunkte im Modul schreiben in dieses Log oder speichern historisierte Perioden (effective_from/to), die selbst als Änderungsverlauf dienen.</div>
        </div>
      </div>
    </div>
  );
}

function TimelineHint({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="rounded-xl border border-slate-200 dark:border-white/8 p-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
        </div>
        <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0" />
      </div>
    </a>
  );
}
