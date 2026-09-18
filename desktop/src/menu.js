'use strict';

const { Menu, app, dialog, shell } = require('electron');
const { APP_ORIGIN, ZOOM, isDev } = require('./config');
const { getMainWindow, adjustZoom, resetZoom } = require('./window');
const { diagnoseKopieren, logVerzeichnis, log } = require('./diagnostics');

/**
 * macOS-Menueleiste, auf Deutsch.
 *
 * Sie ist keine Kosmetik: OHNE eigene Menueleiste funktionieren Kopieren und
 * Einfuegen in Electron nicht. Deshalb sind die Standard-Rollen Pflicht.
 *
 * Bewusst OHNE "Gehe zu"-Menue mit allen Bereichen.
 *
 * Eine rollenabhaengige Filterung haette eine Kopie der Berechtigungslogik
 * aus apps/web/src/lib/permissions.ts in die Huelle gebracht. Aendert sich
 * die Zuordnung im Web, wird das sofort deployt, waehrend eine aeltere
 * Desktop-App die alte Zuordnung kennt — eine unnoetige Versionskopplung.
 * Der Hauptprozess soll so wenig wie moeglich ueber interne Strukturen der
 * Web-App wissen.
 *
 * Als Sprungziele bleiben daher nur Pfade, die STRUKTURELL immer erreichbar
 * sind und keine Rollenkenntnis brauchen:
 *   /home            — der Redirect-Fallback der Web-App selbst
 *   /settings        — steht in pathToPermission nicht, hat also keine Schranke
 *   /settings/manual — Unterseite davon
 * Die Feinnavigation bleibt in der Sidebar und in der Schnellsuche (Cmd+K),
 * die die Web-App ohnehin mitbringt.
 *
 * Bewusst KEINE Cmd+1…4-Kuerzel: diese Kombinationen sind systemseitig fuer
 * Tab-Wechsel konventioniert.
 */

/** Navigiert im Hauptfenster auf einen Pfad der eigenen Domain. */
function geheZu(pfad) {
  const w = getMainWindow();
  if (!w) return;
  w.webContents.loadURL(`${APP_ORIGIN}${pfad}`)
    .catch((err) => log(`Navigation zu ${pfad} fehlgeschlagen: ${err?.message}`));
}

/**
 * Loest die Schnellsuche der Web-App aus, indem Cmd+K an die Seite gesendet
 * wird. Kein Eingriff in die Web-App — nur ein synthetisches Tastenereignis
 * auf dem bestehenden Kuerzel.
 */
function schnellsuche() {
  const w = getMainWindow();
  if (!w) return;
  const c = w.webContents;
  c.sendInputEvent({ type: 'keyDown', keyCode: 'k', modifiers: ['cmd'] });
  c.sendInputEvent({ type: 'keyUp', keyCode: 'k', modifiers: ['cmd'] });
}

/**
 * Zurueck und Vorwaerts im Verlauf.
 *
 * In einer App ohne Adressleiste gibt es sonst KEINEN Weg zurueck ausser
 * ueber die Sidebar. In Electron 44 laeuft das ueber webContents.
 * navigationHistory; die alten Methoden am webContents sind veraltet.
 *
 * Bewusst nur innerhalb der eigenen Domain: fremde Ziele landen ohnehin im
 * Browser und stehen damit nie im Verlauf des Hauptfensters.
 */
function zurueck() {
  const h = getMainWindow()?.webContents.navigationHistory;
  if (h?.canGoBack()) h.goBack();
}

function vorwaerts() {
  const h = getMainWindow()?.webContents.navigationHistory;
  if (h?.canGoForward()) h.goForward();
}

/**
 * Drucken.
 *
 * Bewusst NICHT webContents.print(): Die Gewinnanalyse ruft window.print()
 * erst nach einem setTimeout auf, damit React einen Repaint-Tick bekommt,
 * falls ein State-Update noch nicht uebernommen war (siehe printAsPdf() in
 * profit-analysis/page.tsx). Ein direkter webContents.print() ueberspringt
 * diesen Tick und koennte einen veralteten Stand drucken.
 *
 * Stattdessen wird window.print() IN der Seite ausgeloest — identisch zum
 * Knopf der Web-App, inklusive ihrer Print-CSS und ihres Timings.
 */
function drucken() {
  const c = getMainWindow()?.webContents;
  if (!c) return;
  c.executeJavaScript('setTimeout(function(){ window.print(); }, 0);', true)
    .catch((err) => {
      log(`window.print() fehlgeschlagen, nutze Fallback: ${err?.message}`);
      c.print();
    });
}

function ueberDialog() {
  const w = getMainWindow();
  dialog.showMessageBox(w, {
    type: 'none',
    message: 'Filapen Hub',
    detail: [
      `Version ${app.getVersion()}`,
      `Electron ${process.versions.electron}`,
      `Chromium ${process.versions.chrome}`,
    ].join('\n'),
    buttons: ['Diagnoseinformationen kopieren', 'Logs im Finder zeigen', 'Schließen'],
    defaultId: 2,
    cancelId: 2,
    noLink: true,
  }).then(({ response }) => {
    if (response === 0) {
      diagnoseKopieren({ Adresse: APP_ORIGIN });
      dialog.showMessageBox(w, {
        type: 'info',
        message: 'Kopiert',
        detail: 'Die Diagnoseinformationen liegen in der Zwischenablage.',
        buttons: ['OK'],
        noLink: true,
      });
    } else if (response === 1) {
      shell.openPath(logVerzeichnis());
    }
  });
}

function screenShareHinweis() {
  const w = getMainWindow();
  dialog.showMessageBox(w, {
    type: 'info',
    message: 'Screen Share im Browser nutzen',
    detail: 'Die Bildschirmfreigabe ist in dieser Version der App noch nicht '
      + 'enthalten. Öffne Filapen dafür bitte im Browser — dort funktioniert '
      + 'sie unverändert.',
    buttons: ['Im Browser öffnen', 'Schließen'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  }).then(({ response }) => {
    if (response === 0) shell.openExternal(`${APP_ORIGIN}/screen-share`);
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Filapen Hub',
      submenu: [
        { label: 'Über Filapen Hub', click: ueberDialog },
        { type: 'separator' },
        { label: 'Start', accelerator: 'Cmd+Shift+H', click: () => geheZu('/home') },
        { label: 'Einstellungen …', accelerator: 'Cmd+,', click: () => geheZu('/settings') },
        { type: 'separator' },
        { role: 'hide', label: 'Filapen Hub ausblenden' },
        { role: 'hideOthers', label: 'Andere ausblenden' },
        { role: 'unhide', label: 'Alle anzeigen' },
        { type: 'separator' },
        { role: 'quit', label: 'Filapen Hub beenden' },
      ],
    },
    {
      label: 'Datei',
      submenu: [
        { label: 'Drucken …', accelerator: 'Cmd+P', click: drucken },
        { type: 'separator' },
        { role: 'close', label: 'Fenster schließen' },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        // Diese Rollen sind zwingend — sonst kein Kopieren/Einfuegen.
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'pasteAndMatchStyle', label: 'Einfügen und Stil anpassen' },
        { role: 'delete', label: 'Löschen' },
        { role: 'selectAll', label: 'Alles auswählen' },
        { type: 'separator' },
        { label: 'Schnellsuche', accelerator: 'Cmd+K', click: schnellsuche },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Zurück', accelerator: 'Cmd+Left', click: zurueck },
        { label: 'Vorwärts', accelerator: 'Cmd+Right', click: vorwaerts },
        { type: 'separator' },
        { label: 'Neu laden', accelerator: 'Cmd+R', click: () => getMainWindow()?.webContents.reload() },
        { type: 'separator' },
        { label: 'Vergrößern', accelerator: 'Cmd+Plus', click: () => adjustZoom(ZOOM.step) },
        { label: 'Verkleinern', accelerator: 'Cmd+-', click: () => adjustZoom(-ZOOM.step) },
        { label: 'Originalgröße', accelerator: 'Cmd+0', click: resetZoom },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
        // DevTools ausschliesslich im Entwicklungsmodus.
        ...(isDev ? [
          { type: 'separator' },
          { role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' },
          { role: 'forceReload', label: 'Vollständig neu laden' },
        ] : []),
      ],
    },
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize', label: 'Minimieren' },
        { role: 'zoom', label: 'Zoomen' },
        { type: 'separator' },
        { role: 'front', label: 'Alle nach vorne bringen' },
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        { label: 'Handbuch', click: () => geheZu('/settings/manual') },
        { label: 'Bildschirmfreigabe …', click: screenShareHinweis },
        { type: 'separator' },
        {
          label: 'Rechtliche Hinweise',
          click: () => {
            dialog.showMessageBox(getMainWindow(), {
              type: 'none',
              message: 'Rechtliche Hinweise',
              detail: 'Diese Anwendung nutzt Electron und Chromium, beide als '
                + 'Open-Source-Software unter ihren jeweiligen Lizenzen '
                + '(MIT bzw. BSD-3-Clause). Die vollständigen Lizenztexte '
                + 'liegen im Programmpaket unter LICENSES.chromium.html.',
              buttons: ['OK'],
              noLink: true,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  log('Menueleiste gesetzt');
}

module.exports = { buildMenu, geheZu };
