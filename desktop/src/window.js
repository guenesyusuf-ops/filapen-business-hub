'use strict';

const { BrowserWindow, screen, app, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { WINDOW, ZOOM } = require('./config');
const { log } = require('./diagnostics');

/**
 * Fensterverwaltung.
 *
 * Single-Window nach Spezifikation. Groesse und Position werden gemerkt; ist
 * der gespeicherte Monitor beim naechsten Start nicht mehr vorhanden — etwa
 * weil ein externer Bildschirm abgezogen wurde — kehrt das Fenster auf den
 * Hauptmonitor zurueck, statt unsichtbar ausserhalb zu liegen.
 */

let fenster = null;

function zustandPfad() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function zustandLesen() {
  try {
    const rohdaten = fs.readFileSync(zustandPfad(), 'utf8');
    const s = JSON.parse(rohdaten);
    if (typeof s?.width !== 'number' || typeof s?.height !== 'number') return null;
    return s;
  } catch {
    return null;   // erster Start oder beschaedigte Datei
  }
}

function zustandSchreiben(s) {
  try {
    fs.writeFileSync(zustandPfad(), JSON.stringify(s), 'utf8');
  } catch (err) {
    log(`Fensterzustand konnte nicht gespeichert werden: ${err?.message}`);
  }
}

/**
 * Prueft, ob die gespeicherte Position noch auf einem vorhandenen Bildschirm
 * liegt. Ohne diese Pruefung startet die App nach dem Abziehen eines Monitors
 * in einem Bereich, den niemand sehen kann.
 */
function liegtAufEinemBildschirm(s) {
  if (typeof s.x !== 'number' || typeof s.y !== 'number') return false;
  return screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    // Es genuegt, wenn die Titelleiste erreichbar ist.
    return s.x >= b.x - 40
      && s.y >= b.y - 10
      && s.x < b.x + b.width - 80
      && s.y < b.y + b.height - 40;
  });
}

function createMainWindow(preloadPfad) {
  const gespeichert = zustandLesen();
  const nutzbar = gespeichert && liegtAufEinemBildschirm(gespeichert);
  if (gespeichert && !nutzbar) {
    log('Gespeicherte Fensterposition liegt auf keinem vorhandenen Bildschirm — zurueck auf den Hauptmonitor');
  }

  fenster = new BrowserWindow({
    width: gespeichert?.width ?? WINDOW.defaultWidth,
    height: gespeichert?.height ?? WINDOW.defaultHeight,
    x: nutzbar ? gespeichert.x : undefined,
    y: nutzbar ? gespeichert.y : undefined,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    center: !nutzbar,
    // Native macOS-Titelleiste. Keine integrierte Leiste in V1 — dadurch ist
    // kein injiziertes CSS und kein Hook in der Web-App noetig.
    titleBarStyle: 'default',
    title: 'Filapen Hub',
    // Fensterfarbe folgt dem Systemthema. Hart auf Weiss gesetzt blitzt sie
    // bei dunklem Thema durch — sichtbar als Flackern bei jedem Neuaufbau,
    // Scrollen oder Navigieren. Der Wert muss zur Grundfarbe der Web-App
    // passen: #0f1117 ist deren dunkler Body-Hintergrund.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1117' : '#ffffff',
    // Fenster erst zeigen, wenn Inhalt da ist. Wirkt hochwertiger als ein
    // Splashscreen und verhindert die weisse Flaeche beim Start.
    show: false,
    webPreferences: {
      preload: preloadPfad,
      // --- Sicherheitsmodell, siehe Spezifikation Abschnitt 04 ---
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // DevTools nur im Entwicklungsmodus
      devTools: process.env.FILAPEN_ENV === 'development',
      spellcheck: true,
    },
  });

  if (gespeichert?.maximized) fenster.maximize();

  // Zustand bei jeder Aenderung sichern, gedrosselt.
  let sicherTimer = null;
  const sichern = () => {
    if (sicherTimer) clearTimeout(sicherTimer);
    sicherTimer = setTimeout(() => {
      if (!fenster || fenster.isDestroyed()) return;
      if (fenster.isFullScreen()) return;   // Vollbildmasse nicht speichern
      const b = fenster.getNormalBounds();
      zustandSchreiben({
        x: b.x, y: b.y, width: b.width, height: b.height,
        maximized: fenster.isMaximized(),
        zoom: fenster.webContents.getZoomLevel(),
      });
    }, 400);
  };
  fenster.on('resize', sichern);
  fenster.on('move', sichern);
  fenster.on('maximize', sichern);
  fenster.on('unmaximize', sichern);

  // Gemerkte Zoom-Stufe wiederherstellen, innerhalb der Grenzen.
  fenster.webContents.on('did-finish-load', () => {
    const z = gespeichert?.zoom;
    if (typeof z === 'number') {
      fenster.webContents.setZoomLevel(Math.max(ZOOM.min, Math.min(ZOOM.max, z)));
    }
  });

  // Systemthema-Wechsel mitnehmen, damit die Fensterfarbe weiter passt.
  const themaHandler = () => {
    if (!fenster || fenster.isDestroyed()) return;
    fenster.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0f1117' : '#ffffff');
  };
  nativeTheme.on('updated', themaHandler);

  fenster.on('closed', () => {
    nativeTheme.off('updated', themaHandler);
    fenster = null;
  });

  return fenster;
}

function getMainWindow() {
  return fenster && !fenster.isDestroyed() ? fenster : null;
}

/** Holt das bestehende Fenster nach vorn — fuer Dock-Klick und Zweitstart. */
function focusMainWindow() {
  const w = getMainWindow();
  if (!w) return false;
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
  return true;
}

/** Zoom in festen Schritten, begrenzt auf 75–150 %. */
function adjustZoom(delta) {
  const w = getMainWindow();
  if (!w) return;
  const jetzt = w.webContents.getZoomLevel();
  const neu = Math.max(ZOOM.min, Math.min(ZOOM.max, jetzt + delta));
  w.webContents.setZoomLevel(neu);
}

function resetZoom() {
  getMainWindow()?.webContents.setZoomLevel(0);
}

module.exports = {
  createMainWindow, getMainWindow, focusMainWindow,
  adjustZoom, resetZoom, zustandSchreiben,
};
