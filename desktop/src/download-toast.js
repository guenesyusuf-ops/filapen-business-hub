'use strict';

const { BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { TOAST_MS } = require('./config');
const { log } = require('./diagnostics');
const { getMainWindow } = require('./window');

/**
 * Der Download-Hinweis.
 *
 * Bewusst KEIN Element in der Webseite, sondern ein eigenes rahmenloses
 * Fenster mit eigenem HTML. Damit gibt es null Abhaengigkeit vom Markup der
 * Web-App — ein Web-Deploy kann diesen Hinweis nicht brechen, und es war
 * keine Zeile im Web-Projekt noetig.
 *
 * Das Fenster haengt am Hauptfenster, schwebt unten rechts darueber und
 * verschwindet nach TOAST_MS von selbst.
 */

const BREITE = 380;
const HOEHE = 92;
const RAND = 20;

let toast = null;
let versteckTimer = null;
/** Letzter Download — der Renderer fragt ihn beim Laden ab. */
let aktuell = null;

function positionieren() {
  const haupt = getMainWindow();
  if (!haupt || !toast || toast.isDestroyed()) return;
  const b = haupt.getBounds();
  toast.setBounds({
    x: b.x + b.width - BREITE - RAND,
    y: b.y + b.height - HOEHE - RAND,
    width: BREITE,
    height: HOEHE,
  });
}

function erzeugen() {
  const haupt = getMainWindow();
  if (!haupt) return null;

  toast = new BrowserWindow({
    width: BREITE,
    height: HOEHE,
    parent: haupt,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,     // klaut dem Hauptfenster nicht den Fokus
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'toast-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  toast.loadFile(path.join(__dirname, '..', 'static', 'toast.html'))
    .catch((err) => log(`Toast konnte nicht geladen werden: ${err?.message}`));

  toast.on('closed', () => { toast = null; });

  // Mitwandern, wenn das Hauptfenster bewegt oder skaliert wird.
  haupt.on('move', positionieren);
  haupt.on('resize', positionieren);

  return toast;
}

function verstecken() {
  if (versteckTimer) { clearTimeout(versteckTimer); versteckTimer = null; }
  if (toast && !toast.isDestroyed()) toast.hide();
}

/**
 * Zeigt den Hinweis.
 * @param {{dateiname: string, pfad: string|null, erfolg: boolean}} info
 */
function zeigeToast(info) {
  aktuell = info;
  if (!toast || toast.isDestroyed()) {
    if (!erzeugen()) return;
  }
  positionieren();

  const senden = () => {
    if (toast && !toast.isDestroyed()) {
      toast.webContents.send('toast:daten', info);
      toast.showInactive();     // sichtbar, ohne Fokus zu stehlen
    }
  };

  if (toast.webContents.isLoading()) {
    toast.webContents.once('did-finish-load', senden);
  } else {
    senden();
  }

  if (versteckTimer) clearTimeout(versteckTimer);
  versteckTimer = setTimeout(verstecken, TOAST_MS);
}

/**
 * IPC fuer den Toast. Bewusst eng: drei feste Aktionen, keine freien
 * Parameter. Der Pfad kommt aus dem Hauptprozess, nicht vom Renderer —
 * damit kann der Toast keine beliebige Datei oeffnen.
 */
function registerToastIpc({ dateiOeffnen, imFinderZeigen }) {
  ipcMain.handle('toast:abfragen', () => aktuell);

  ipcMain.on('toast:aktion', (_event, aktion) => {
    if (!aktuell?.pfad) return;
    if (aktion === 'oeffnen') dateiOeffnen(aktuell.pfad);
    else if (aktion === 'finder') imFinderZeigen(aktuell.pfad);
    else if (aktion !== 'schliessen') return;
    verstecken();
  });
}

module.exports = { zeigeToast, registerToastIpc, verstecken };
