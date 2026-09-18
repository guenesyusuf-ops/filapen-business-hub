/**
 * Die aktuell verteilte Desktop-App (Filapen Hub fuer macOS).
 *
 * ============================================================
 * BEIM AUSTAUSCH DER INSTALLATIONSDATEI
 * ============================================================
 * Genau drei Werte anfassen: `version`, `released` und `sizeMb`.
 *
 * Die Download-Seite zeigt daraufhin von selbst den Hinweis
 * „Neues Update" samt Datum — fuer jeden, der noch eine aeltere Version
 * heruntergeladen hatte. Wird `version` vergessen, bleibt der Hinweis aus
 * und niemand bemerkt die neue Datei.
 *
 * Die Datei selbst liegt NICHT im Repository. 122 MB Binaerdatei in Git
 * waeren in jedem Klon fuer immer enthalten. Sie liegt im oeffentlichen
 * Read-only-Bucket — derselbe Kanal, der auch fuer die spaeteren
 * Auto-Updates vorgesehen ist: oeffentlich ausschliesslich lesen, Upload
 * nur mit geschuetzten Admin-Zugangsdaten.
 */

export const DESKTOP_APP = {
  /** Muss der Version in desktop/package.json entsprechen. */
  version: '1.0.1',

  /** Datum der Installationsdatei (ISO). Erscheint hinter „Neues Update". */
  released: '2026-09-18',

  /** Ungefaehre Groesse in MB, nur zur Anzeige. */
  sizeMb: 121,

  /** Systemvoraussetzungen, wie in electron-builder.yml festgelegt. */
  minMacOS: '14',
  arch: 'Apple Silicon',

  /**
   * Adresse der Installationsdatei. Wird als Umgebungsvariable gesetzt,
   * damit ein Wechsel des Speicherorts keinen Codeeingriff braucht.
   * Ist sie leer, zeigt die Seite das ehrlich an statt eines toten Knopfes.
   */
  url: process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ?? '',

  /**
   * Solange die App nicht signiert und notarisiert ist, blockiert macOS den
   * ersten Start. Steht das hier auf true, zeigt die Seite die noetigen
   * Schritte. Nach der Notarisierung auf false setzen — dann genuegt ein
   * Doppelklick und der Hinweis verschwindet.
   */
  unsigned: true,
} as const;

/** 2026-09-18 -> 18.09.2026 */
export function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** Schluessel, unter dem sich der Browser die zuletzt geholte Version merkt. */
export const DOWNLOAD_VERSION_KEY = 'filapen-app-download-version';
