'use strict';

const { shell } = require('electron');
const { INTERNAL_HOSTS } = require('./config');
const { log } = require('./diagnostics');

/**
 * Navigationsregeln.
 *
 * Die wichtigste Eigenschaft dieses Moduls ist, was es NICHT tut: Es prueft
 * ausschliesslich Navigationen des HAUPTRAHMENS. Unterressourcen bleiben
 * unangetastet — kein Bild, keine Schrift, kein fetch und kein WebSocket
 * laeuft hier durch. Eine pauschale Domain-Sperre wuerde sonst die
 * Railway-API, Google Fonts, Supabase-Anhaenge und die Liveblocks-Verbindung
 * mit abschneiden.
 *
 * Regel: eigene Domain bleibt in der App, alles andere geht still an den
 * Standardbrowser bzw. an die zustaendige Systemanwendung.
 *
 * ------------------------------------------------------------------
 * Warum hier KEINE Sperre fuer Unterrahmen steht
 * ------------------------------------------------------------------
 * Frueher hing hier zusaetzlich ein `will-frame-navigate`-Handler, der jeden
 * eingebetteten Rahmen gegen INTERNAL_HOSTS geprueft hat. Das war als
 * Sicherheitsnetz gedacht und war keines:
 *
 *   - Der Hauptrahmen ist durch `will-navigate` abgedeckt.
 *   - `window.open` und target="_blank" sind durch den
 *     setWindowOpenHandler abgedeckt, auch aus Unterrahmen heraus.
 *   - Ein Unterrahmen kann das Hauptdokument nicht ersetzen. Versucht er es
 *     ueber `top.location`, ist das eine Navigation des Hauptrahmens und
 *     landet wieder bei `will-navigate`.
 *
 * Geschuetzt hat der Handler also nichts, was die anderen beiden nicht schon
 * schuetzen. Blockiert hat er dafuer SAEMTLICHE Dokumentvorschauen der
 * Web-App — neun Stellen, von der Rechnungsansicht ueber Einkauf und Verkauf
 * bis zu den Anhaengen der Arbeitsverwaltung. Die laufen entweder ueber eine
 * `blob:`-Adresse oder ueber die Speicheradresse der Datei; beide fallen bei
 * einer Host-Pruefung durch.
 *
 * Eine Ausnahmeliste fuer diese Hosts waere die falsche Loesung: ein neuer
 * Bucket oder ein CDN-Wechsel wuerde die Vorschauen erneut stillschweigend
 * abschalten, und die Huelle wuesste wieder etwas ueber Interna, die sich
 * jederzeit weiterdeployen.
 */

/** Protokolle, die an das Betriebssystem uebergeben werden. */
const SYSTEM_PROTOCOLS = ['mailto:', 'tel:', 'sms:', 'facetime:'];

/** Schemata, die der Standardbrowser tatsaechlich oeffnen kann. */
const BROWSER_SCHEMATA = ['http:', 'https:'];

/**
 * Zeitfenster, in dem dieselbe Adresse nur einmal nach draussen geht.
 *
 * Hintergrund: Die Web-App ruft an mehreren Stellen dem Muster
 * `const w = window.open(url); if (!w) window.open(url);` folgend zweimal
 * auf, weil sie einen blockierten Popup vermutet. In der Huelle liefert
 * `window.open` aber IMMER null — wir erlauben kein zweites Fenster. Ohne
 * Entprellung oeffnet das Label-PDF sich dadurch zweimal im Browser.
 */
const ENTPRELL_MS = 1500;
let zuletztGeoeffnet = { schluessel: '', zeit: 0 };

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

function schemaVon(urlString) {
  try {
    return new URL(urlString).protocol;
  } catch {
    return '';
  }
}

/**
 * Oeffnet eine Adresse ausserhalb der App.
 *
 * Gibt zurueck, ob tatsaechlich etwas geoeffnet wurde. Das ist wichtig: eine
 * `blob:`- oder `data:`-Adresse kann das Betriebssystem NICHT oeffnen. Der
 * frueher bedingungslose Aufruf verpuffte in genau diesen Faellen still und
 * verdeckte, dass gar nichts passiert war.
 */
function openExternally(urlString) {
  const schema = schemaVon(urlString);
  if (!BROWSER_SCHEMATA.includes(schema) && !isSystemProtocol(urlString)) {
    log(`Nicht extern oeffenbar, uebergangen: ${schema || '(unbekannt)'}`);
    return false;
  }

  // Entprellen ohne Textmarke: `datei.pdf#print` und `datei.pdf` sind fuer
  // das Betriebssystem dieselbe Datei.
  const schluessel = urlString.split('#')[0];
  const jetzt = Date.now();
  if (schluessel === zuletztGeoeffnet.schluessel && jetzt - zuletztGeoeffnet.zeit < ENTPRELL_MS) {
    log('Doppelter Oeffnen-Aufruf innerhalb der Entprellzeit — uebergangen');
    return true;
  }
  zuletztGeoeffnet = { schluessel, zeit: jetzt };

  shell.openExternal(urlString).catch(() => { /* bewusst still */ });
  return true;
}

/**
 * Haengt die Regeln an ein webContents.
 * @param {import('electron').WebContents} contents
 * @param {(url: string) => void} onBlockedNavigation Meldung fuer die Diagnose
 */
function applyNavigationPolicy(contents, onBlockedNavigation) {
  // 1) Navigation des Hauptrahmens: fremde Ziele verlassen die App.
  contents.on('will-navigate', (event, url) => {
    if (isInternal(url)) return;            // eigene Domain: durchlassen
    event.preventDefault();
    if (openExternally(url)) onBlockedNavigation?.(url);
  });

  // 2) target="_blank" und window.open: niemals ein zweites App-Fenster.
  //    Die App ist bewusst Single-Window. Interne Ziele laden im Hauptfenster,
  //    externe gehen an den Browser.
  //
  //    Bei `blob:` und `data:` passiert hier absichtlich nichts weiter: die
  //    Web-App faengt das zurueckgegebene null selbst ab und laedt die Datei
  //    stattdessen herunter. Wuerden wir hier zusaetzlich einen Download
  //    anstossen, kaeme die Datei doppelt.
  contents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      contents.loadURL(url).catch(() => { /* Ladefehler behandelt der Aufrufer */ });
    } else if (openExternally(url)) {
      onBlockedNavigation?.(url);
    }
    return { action: 'deny' };
  });
}

module.exports = { applyNavigationPolicy, isInternal, openExternally };
