'use client';

import { useEffect, useState } from 'react';
import { MonitorDown, Download, ShieldAlert, Info, CheckCircle2, Sparkles } from 'lucide-react';
import {
  DESKTOP_APP,
  formatReleaseDate,
  DOWNLOAD_VERSION_KEY,
} from '@/lib/desktop-app';

/**
 * App Download — Installationsdatei der macOS-App fuer das Team.
 *
 * Bewusst ohne Server und ohne Datenbank: die Datei liegt im oeffentlichen
 * Read-only-Bucket, die Seite verlinkt sie. Ob jemand schon eine aeltere
 * Version geholt hat, merkt sich ausschliesslich sein eigener Browser —
 * dafuer braucht es keine Tabelle und keinen Abgleich.
 */
export default function AppDownloadPage() {
  // Welche Version hat dieser Browser zuletzt geholt? null = noch keine.
  const [geholteVersion, setGeholteVersion] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    try {
      setGeholteVersion(localStorage.getItem(DOWNLOAD_VERSION_KEY));
    } catch {
      // Privates Fenster oder gesperrter Speicher — dann gilt „noch keine".
    }
    setGeladen(true);
  }, []);

  const istNeu = geladen && geholteVersion !== DESKTOP_APP.version;
  const datum = formatReleaseDate(DESKTOP_APP.released);
  const verfuegbar = DESKTOP_APP.url.length > 0;

  function merkeDownload() {
    try {
      localStorage.setItem(DOWNLOAD_VERSION_KEY, DESKTOP_APP.version);
    } catch {
      // Nicht schlimm — dann erscheint der Hinweis eben weiterhin.
    }
    setGeholteVersion(DESKTOP_APP.version);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center shadow-md flex-shrink-0">
          <MonitorDown className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            App Download
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Filapen Hub als Programm für den Mac — gleiche Oberfläche, eigenes Fenster im Dock.
          </p>
        </div>
      </div>

      {/* Download-Karte */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Filapen Hub für macOS
              </h2>
              {istNeu && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-500/10 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-500/20">
                  <Sparkles className="h-3 w-3" />
                  Neues Update · {datum}
                </span>
              )}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex gap-1.5">
                <dt>Version</dt>
                <dd className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                  {DESKTOP_APP.version}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Stand</dt>
                <dd className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{datum}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Größe</dt>
                <dd className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                  ca. {DESKTOP_APP.sizeMb} MB
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Voraussetzung</dt>
                <dd className="font-semibold text-gray-700 dark:text-gray-200">
                  macOS {DESKTOP_APP.minMacOS} oder neuer, {DESKTOP_APP.arch}
                </dd>
              </div>
            </dl>
          </div>

          {verfuegbar ? (
            <a
              href={DESKTOP_APP.url}
              download
              onClick={merkeDownload}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors flex-shrink-0"
            >
              <Download className="h-4 w-4" />
              App herunterladen
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-gray-400 dark:text-gray-500 flex-shrink-0 cursor-not-allowed">
              <Download className="h-4 w-4" />
              Noch nicht hinterlegt
            </span>
          )}
        </div>

        {!verfuegbar && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Die Installationsdatei ist noch nicht hochgeladen. Sobald sie im Bucket liegt und
            <code className="mx-1 rounded bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">
              NEXT_PUBLIC_APP_DOWNLOAD_URL
            </code>
            gesetzt ist, wird hier ein Knopf daraus.
          </p>
        )}

        {verfuegbar && !istNeu && geholteVersion && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            Version {geholteVersion} wurde von diesem Rechner schon heruntergeladen.
          </p>
        )}
      </div>

      {/* Erster Start — nur solange unsigniert */}
      {DESKTOP_APP.unsigned && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Beim ersten Start: einmal freigeben
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Die App ist noch nicht bei Apple registriert. macOS blockiert deshalb den ersten
                Start — das ist erwartet und kein Fehler. Einmal pro Rechner:
              </p>
              <ol className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-300 list-decimal list-inside">
                <li>DMG öffnen und <strong>Filapen Hub</strong> in den Programme-Ordner ziehen.</li>
                <li>App starten. Es erscheint ein Hinweis, dass sie nicht geöffnet werden kann.</li>
                <li>
                  <strong>Systemeinstellungen → Datenschutz &amp; Sicherheit</strong> öffnen, ganz
                  nach unten scrollen und bei „Filapen Hub" auf <strong>Dennoch öffnen</strong>
                  {' '}klicken.
                </li>
                <li>Danach startet die App normal, auch nach jedem Neustart.</li>
              </ol>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Sobald die App signiert und bei Apple registriert ist, entfällt dieser Schritt und
                dieser Hinweis verschwindet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Was die App ist — und was sie nicht braucht */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Gut zu wissen
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Die App zeigt denselben Hub wie der Browser — sie lädt ihn live. Neue Module und
              Änderungen erscheinen dort automatisch, <strong>ohne</strong> dass jemand etwas neu
              installieren muss.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Eine neue Installationsdatei gibt es nur, wenn sich am Programm selbst etwas ändert.
              Dann steht hier oben <strong>„Neues Update"</strong> mit dem Datum — und nur dann
              lohnt der Download erneut.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Anmeldung, Rechte und Daten sind identisch zur Web-Version. Wer sich in der App
              anmeldet, bleibt angemeldet, auch nach einem Neustart des Macs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
