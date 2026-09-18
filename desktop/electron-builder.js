'use strict';

/**
 * Build-Konfiguration fuer Filapen Hub (macOS).
 *
 * Bewusst JavaScript und nicht YAML: zwei Werte muessen davon abhaengen, ob
 * ein Developer-ID-Zertifikat vorliegt. In YAML waere das nur ueber
 * Kommandozeilen-Schalter moeglich, die jemand beim Release-Build vergessen
 * kann — und genau dieser Fehler macht das Paket unbrauchbar. Siehe den
 * Abschnitt "Signierung" weiter unten.
 *
 * Bewusst arm64-only: alle eingesetzten iMacs laufen auf der jeweils neuesten
 * macOS-Version, und macOS 26 unterstuetzt keine Intel-Macs mehr. Ein
 * Universal-Build wuerde Dateigroesse und Testaufwand verdoppeln, ohne einen
 * Rechner zusaetzlich zu erreichen. Nachziehbar, falls doch ein Intel-Mac
 * dazukommt.
 */

/**
 * Liegt ein echtes Zertifikat vor? Die Zugangsdaten kommen ausschliesslich
 * aus Umgebungsvariablen, damit nichts davon im Repository landet:
 *   CSC_LINK, CSC_KEY_PASSWORD                            — Zertifikat
 *   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID  — Notarisierung
 */
const hatZertifikat = Boolean(process.env.CSC_LINK || process.env.CSC_NAME);

/**
 * ============================================================
 * SIGNIERUNG — warum das hier von hatZertifikat abhaengt
 * ============================================================
 *
 * Ohne Zertifikat MUSS ad-hoc signiert werden (identity: '-').
 * Ohne diesen Eintrag ueberspringt electron-builder das Signieren ganz. Im
 * Bundle bleibt dann die Signatur des mitgelieferten Electron-Binaers stehen
 * (Identifier=Electron), die nach dem Austausch der Inhalte nicht mehr passt.
 * Gatekeeper meldet daraufhin nicht "unbekannter Entwickler", sondern eine
 * BESCHAEDIGTE Signatur — und dafuer bietet macOS die Freigabe in den
 * Systemeinstellungen nicht an. Die App ist auf fremden Rechnern dann
 * unbenutzbar. Nachgemessen am ersten Testbuild:
 *   spctl -> "code has no resources but signature indicates they must be present"
 *
 * Ohne Zertifikat MUSS Hardened Runtime AUS sein.
 * Hardened Runtime erzwingt Library Validation, und die verlangt
 * uebereinstimmende Team-IDs zwischen Prozess und geladener Bibliothek. Eine
 * Ad-hoc-Signatur hat gar keine Team-ID — es gibt nichts, was uebereinstimmen
 * koennte. Die Helferprozesse koennen das Electron Framework dann nicht laden:
 *   dyld: Library not loaded: @rpath/Electron Framework.framework/...
 *   Reason: ... (non-platform) have different Team IDs
 * Ergebnis: GPU-Prozess stirbt, Renderer stirbt, Chromium gibt auf
 * ("GPU process isn't usable. Goodbye."). Die App startet nicht. Ebenfalls
 * nachgemessen.
 *
 * MIT Zertifikat gilt das Umgekehrte: Hardened Runtime ist Voraussetzung fuer
 * die Notarisierung, und identity darf NICHT gesetzt sein, damit
 * electron-builder das echte Zertifikat verwendet.
 */

module.exports = {
  appId: 'de.filapen.hub',
  productName: 'Filapen Hub',
  copyright: '© 2026 Filapen GmbH',

  directories: {
    output: 'dist',
    buildResources: 'build',
  },

  /**
   * Kein Rebuild nativer Module.
   *
   * Es gibt keine: electron-updater ist reines JavaScript. Der Schritt ist
   * also ohnehin unnoetig — und er ist schaedlich. electron-builder erkennt
   * wegen des "workspaces"-Feldes der Root-package.json einen
   * Workspace-Wurzelordner, obwohl /desktop gar kein Mitglied ist. In diesem
   * Modus schreibt es beim Rebuild die fuer das Paket getrimmte Metadatei
   * UEBER die Quelldatei und entfernt dabei "scripts" und "devDependencies" —
   * ein zweiter `npm run build` scheitert danach, weil das Skript nicht mehr
   * existiert. Nachgewiesen beim ersten Testbuild.
   */
  npmRebuild: false,

  // Nur was die App zur Laufzeit braucht. Kein Web-Frontend, keine Kopie des
  // Hubs — die App laedt business.filapen.de.
  files: [
    'src/**/*',
    'static/**/*',
    'package.json',
  ],

  mac: {
    category: 'public.app-category.business',
    target: [{ target: 'dmg', arch: ['arm64'] }],

    // macOS 14 als Minimum: hoch genug fuer moderne System-APIs, tief genug
    // damit ein aufgeschobenes Update oder ein neuer Rechner nicht aussperrt.
    // Electron 44 verlangt technisch nur macOS 12.
    minimumSystemVersion: '14.0',

    // --- siehe Abschnitt "SIGNIERUNG" oben ---
    hardenedRuntime: hatZertifikat,
    ...(hatZertifikat ? {} : { identity: '-' }),

    gatekeeperAssess: false,

    entitlements: 'build/entitlements.mac.plist',
    // Die Helferprozesse brauchen com.apple.security.inherit und NICHT die
    // Haupt-Entitlements. Zeigten beide Eintraege auf dieselbe Datei, erhielten
    // die Helfer die Haupt-Entitlements und kein `inherit`.
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',

    // Aus build/icon.png (1024x1024) erzeugt electron-builder die .icns selbst.
    // Erstellt von scripts/make-icon.js aus logo-normal.svg.
    icon: 'build/icon.png',
  },

  dmg: {
    title: 'Filapen Hub',
    // Schlicht, mit Verknuepfung zum Programme-Ordner. Kein Hintergrundbild.
    contents: [
      { x: 140, y: 180, type: 'file' },
      { x: 400, y: 180, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 360 },
  },

  afterSign: null,

  /**
   * Auto-Update ist in V1 nur VORBEREITET, nicht aktiviert. Der Kanal wird
   * erst konfiguriert, wenn Signierung, Notarisierung und das Hosting stehen.
   * Ohne publish-Eintrag erzeugt electron-builder keine Update-Metadaten.
   */
  publish: null,
};
