'use strict';

const { app, session, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { APP_ORIGIN, START_URL, isDev } = require('./config');
const { initLogging, log } = require('./diagnostics');
const { createMainWindow, getMainWindow, focusMainWindow } = require('./window');
const { applyNavigationPolicy } = require('./navigation');
const { applyPermissionPolicy } = require('./permissions');
const { applyDownloadPolicy, dateiOeffnen, imFinderZeigen } = require('./downloads');
const { registerToastIpc } = require('./download-toast');
const { applyConnectivityPolicy } = require('./connectivity');
const { buildMenu } = require('./menu');
const { initUpdater } = require('./updater');

/**
 * Filapen Hub — Einstiegspunkt.
 *
 * Die App ist eine native Huelle um die bestehende Web-Anwendung unter
 * business.filapen.de. Sie enthaelt KEINE Kopie des Frontends: jeder
 * Web-Deploy erscheint automatisch, ohne dass eine neue DMG verteilt werden
 * muss.
 *
 * Sicherheitsmodell (siehe Spezifikation Abschnitt 04):
 *   nodeIntegration aus, contextIsolation an, Sandbox an, webSecurity an,
 *   KEINE Preload-Bruecke fuer den Remote-Inhalt, alle Berechtigungen
 *   abgelehnt. Jede native Funktion laeuft im Hauptprozess und wird durch
 *   Electron-Ereignisse ausgeloest, nicht durch Aufrufe der Web-App.
 */

// Ein einziges Fenster. Ein zweiter Start holt das bestehende nach vorn,
// statt eine zweite Instanz zu oeffnen.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Zweiter Start — bestehendes Fenster nach vorn');
    focusMainWindow();
  });
}

app.setName('Filapen Hub');

/**
 * Kennzeichnet die App im User-Agent. Bewusst nur ein Suffix, kein Ersatz:
 * der Rest des User-Agents bleibt ein normaler Chromium-String, damit die
 * Web-App sich unveraendert verhaelt.
 *
 * In Version 1 wertet die Web-App das NICHT aus — sie ist unangetastet. Das
 * Suffix ist die Grundlage fuer einen spaeteren, minimalen Desktop-Hook,
 * falls wir uns fuer die integrierte Titelleiste entscheiden.
 */
function userAgentSetzen() {
  const original = app.userAgentFallback;
  app.userAgentFallback = `${original} FilapenHub/${app.getVersion()}`;
}

/**
 * Dock-Icon im Entwicklungsmodus setzen.
 *
 * Nur fuer die lokale Ansicht: im gebauten Paket kommt das Icon aus dem
 * App-Bundle, dort ist das unnoetig. Ohne diesen Aufruf zeigt `npm start`
 * das Electron-Standardsymbol, was beim Ansehen irritiert.
 */
function dockIconImDevModus() {
  // Gilt fuer jeden Start aus dem Quellcode — im gepackten Bundle kommt das
  // Icon aus der App selbst und dieser Aufruf ist unnoetig.
  if (app.isPackaged || !app.dock) return;
  const p = path.join(__dirname, '..', 'build', 'icon.png');
  try {
    if (fs.existsSync(p)) app.dock.setIcon(p);
  } catch (err) {
    log(`Dock-Icon konnte nicht gesetzt werden: ${err?.message}`);
  }
}

/**
 * Einrichtung, die genau EINMAL pro Prozess gehoert.
 *
 * Diese Trennung ist keine Kosmetik. Vorher lag alles in einer Funktion, die
 * sowohl beim Start als auch beim Dock-Klick nach Cmd+W lief. Beim zweiten
 * Durchgang warf `ipcMain.handle('toast:abfragen')` — ein Kanal darf nur
 * einmal registriert werden. Die Ausnahme riss den Rest des Ablaufs ab, also
 * auch `loadURL`: das Fenster entstand mit `show: false`, lud nie etwas und
 * wurde nie gezeigt. Erst der zweite Dock-Klick holte es per `show()` nach
 * vorn — als schwarze Flaeche, weil nur die Fensterfarbe zu sehen war.
 *
 * Zwei weitere Folgen desselben Fehlers: `applyDownloadPolicy` haengte bei
 * jedem Durchgang einen zusaetzlichen `will-download`-Listener an, und
 * `userAgentSetzen` verlaengerte den User-Agent jedes Mal erneut.
 */
let eingerichtet = false;

function einmaligEinrichten() {
  if (eingerichtet) return;
  eingerichtet = true;

  initLogging();
  dockIconImDevModus();
  log(`Start — Modus ${isDev ? 'development' : 'production'}, Ziel ${APP_ORIGIN}`);

  userAgentSetzen();

  const sitzung = session.defaultSession;
  applyPermissionPolicy(sitzung);
  applyDownloadPolicy(sitzung);

  registerToastIpc({ dateiOeffnen, imFinderZeigen });
  buildMenu();
  initUpdater();
}

/** Oeffnet das Hauptfenster. Darf beliebig oft laufen. */
function fensterOeffnen() {
  einmaligEinrichten();

  // WICHTIG: kein Preload fuer das Hauptfenster. Der Remote-Inhalt erhaelt
  // keinerlei Bruecke ins Betriebssystem.
  const fenster = createMainWindow(undefined);

  applyNavigationPolicy(fenster.webContents, (url) => {
    log(`Extern geoeffnet: ${new URL(url).hostname}`);
  });
  applyConnectivityPolicy(fenster);

  // Fenster erst zeigen, wenn Inhalt da ist — verhindert die weisse Flaeche
  // beim Start und wirkt hochwertiger als ein Splashscreen.
  fenster.once('ready-to-show', () => {
    fenster.show();
    log('Fenster sichtbar');
  });

  fenster.webContents.loadURL(START_URL).catch((err) => {
    // Der Fehlerfall laeuft ueber did-fail-load in connectivity.js; hier nur
    // protokollieren, damit nichts still verschwindet.
    log(`Initiales Laden fehlgeschlagen: ${err?.message}`);
  });
}

app.whenReady().then(fensterOeffnen);

/**
 * macOS-Verhalten: Das Schliessen des letzten Fensters beendet die App NICHT.
 * Sie bleibt im Dock, ein Klick oeffnet wieder — wie bei Mail. Beendet wird
 * ueber Cmd+Q, und zwar sofort und ohne Rueckfrage.
 */
app.on('window-all-closed', () => {
  log('Letztes Fenster geschlossen — App bleibt im Dock');
});

app.on('activate', () => {
  if (!focusMainWindow()) {
    log('Dock-Klick ohne Fenster — neues Fenster');
    fensterOeffnen();
  }
});

/**
 * Zusaetzliche Absicherung: sollte irgendwo doch ein weiteres webContents
 * entstehen, bekommt es dieselben Regeln. Ohne das waere ein neu erzeugtes
 * Fenster ungeschuetzt.
 */
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'window' && BrowserWindow.fromWebContents(contents) === getMainWindow()) {
    return;   // Hauptfenster ist oben schon versorgt
  }
  applyNavigationPolicy(contents, () => {});
  // Attach-Versuche von webview-Tags grundsaetzlich ablehnen.
  contents.on('will-attach-webview', (event) => {
    log('will-attach-webview abgelehnt');
    event.preventDefault();
  });
});

process.on('uncaughtException', (err) => {
  log(`Unbehandelter Fehler im Hauptprozess: ${err?.message}`);
});

process.on('unhandledRejection', (reason) => {
  log(`Unbehandelte Rejection im Hauptprozess: ${reason?.message ?? reason}`);
});
