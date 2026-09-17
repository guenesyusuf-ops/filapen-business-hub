'use strict';

const { shell } = require('electron');
const { INTERNAL_HOSTS } = require('./config');

/**
 * Navigationsregeln.
 *
 * Die wichtigste Eigenschaft dieses Moduls ist, was es NICHT tut: Es prueft
 * ausschliesslich Navigationen des Hauptfensters. Unterressourcen bleiben
 * unangetastet — kein Bild, keine Schrift, kein fetch und kein WebSocket
 * laeuft hier durch. Eine pauschale Domain-Sperre wuerde sonst die
 * Railway-API, Google Fonts, Supabase-Anhaenge und die Liveblocks-Verbindung
 * mit abschneiden.
 *
 * Regel: eigene Domain bleibt in der App, alles andere geht still an den
 * Standardbrowser bzw. an die zustaendige Systemanwendung.
 */

/** Protokolle, die an das Betriebssystem uebergeben werden. */
const SYSTEM_PROTOCOLS = ['mailto:', 'tel:', 'sms:', 'facetime:'];

function isInternal(urlString) {
  try {
    const url = new URL(urlString);
    // Nur HTTPS, plus HTTP ausschliesslich fuer localhost im Dev-Modus.
    const protokollOk = url.protocol === 'https:'
      || (url.protocol === 'http:' && url.hostname === 'localhost');
    if (!protokollOk) return false;
    return INTERNAL_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

function isSystemProtocol(urlString) {
  return SYSTEM_PROTOCOLS.some((p) => urlString.startsWith(p));
}

/** Oeffnet eine Adresse ausserhalb der App. Fehler werden geschluckt — ein
 *  nicht oeffenbarer Link darf die App nicht stoeren. */
function openExternally(urlString) {
  shell.openExternal(urlString).catch(() => { /* bewusst still */ });
}

/**
 * Haengt die Regeln an ein webContents.
 * @param {import('electron').WebContents} contents
 * @param {(url: string) => void} onBlockedNavigation Meldung fuer die Diagnose
 */
function applyNavigationPolicy(contents, onBlockedNavigation) {
  // 1) Navigation des Hauptfensters: fremde Ziele verlassen die App.
  contents.on('will-navigate', (event, url) => {
    if (isInternal(url)) return;            // eigene Domain: durchlassen
    event.preventDefault();
    if (isSystemProtocol(url)) {
      openExternally(url);                  // Mail, Telefon
    } else {
      openExternally(url);                  // Fremdseite im Browser
    }
    onBlockedNavigation?.(url);
  });

  // 2) target="_blank" und window.open: niemals ein zweites App-Fenster.
  //    Die App ist bewusst Single-Window. Interne Ziele laden im Hauptfenster,
  //    externe gehen an den Browser.
  contents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      contents.loadURL(url).catch(() => { /* Ladefehler behandelt der Aufrufer */ });
    } else {
      openExternally(url);
      onBlockedNavigation?.(url);
    }
    return { action: 'deny' };
  });

  // 3) Sicherheitsnetz: sollte trotz allem ein untergeordnetes Frame auf eine
  //    fremde Adresse navigieren wollen, wird das abgelehnt.
  contents.on('will-frame-navigate', (event) => {
    if (!isInternal(event.url)) {
      event.preventDefault();
      openExternally(event.url);
    }
  });
}

module.exports = { applyNavigationPolicy, isInternal, openExternally };
