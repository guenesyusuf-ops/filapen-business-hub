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
 * "Gehe zu" fuehrt die 20 Hauptbereiche. Alle 111 Einzelseiten aufzunehmen
 * waere unbedienbar — die Feinnavigation bleibt in der Sidebar und in der
 * Schnellsuche (Cmd+K), die die Web-App selbst mitbringt.
 *
 * Bewusst KEINE Cmd+1…4-Kuerzel: diese Kombinationen sind systemseitig fuer
 * Tab-Wechsel konventioniert.
 */

/** Die 20 Hauptbereiche, Reihenfolge wie in der Sidebar der Web-App. */
const BEREICHE = [
  ['Start', '/home'],
  ['Finance Hub', '/finance'],
  ['Creator Hub', '/creators'],
  ['Influencer Hub', '/influencers'],
  ['Content Hub', '/content'],
  ['Aufgaben', '/work-management'],
  ['Whiteboard', '/whiteboard'],
  ['Einkauf', '/purchases'],
  ['E-Mail-Marketing', '/email-marketing'],
  ['Versand', '/shipping'],
  ['Verkauf', '/sales'],
  ['NFC', '/nfc'],
  ['Retouren', '/returns'],
  ['Rechnungen', '/invoices'],
  ['Dokumente', '/documents'],
  ['Screen Share', '/screen-share'],
  ['Filapen Send', '/send'],
  ['Passwörter', '/passwords'],
  ['Gewinnanalyse', '/profit-analysis'],
  ['Einstellungen', '/settings'],
];

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
        { label: 'Drucken …', accelerator: 'Cmd+P', click: () => getMainWindow()?.webContents.print() },
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
      label: 'Gehe zu',
      submenu: [
        ...BEREICHE.map(([label, pfad]) => ({
          label,
          click: () => (label === 'Screen Share' ? screenShareHinweis() : geheZu(pfad)),
        })),
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

module.exports = { buildMenu, geheZu, BEREICHE };
