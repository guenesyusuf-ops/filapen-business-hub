'use strict';

const { net } = require('electron');
const path = require('node:path');
const { START_URL, RETRY_MS, SLOW_LOAD_MS } = require('./config');
const { log } = require('./diagnostics');

/**
 * Verbindungszustaende.
 *
 * Es wird bewusst unterschieden zwischen "dein Internet ist weg" und
 * "Filapen ist nicht erreichbar" — das erspart Rueckfragen aus dem Team.
 *
 * Grundlage ist der Electron-Fehlercode zusammen mit einer echten
 * Erreichbarkeitspruefung: Erst wird ein neutraler Host geprueft. Antwortet
 * der, liegt das Internet an und das Problem sitzt bei Filapen.
 *
 * Alle Zustandsseiten sind eigene HTML-Dateien im Paket. Es erscheint niemals
 * eine rohe Chromium-Fehlerseite.
 */

/** Neutraler Host fuer die Internetpruefung. Apple nutzt ihn selbst dafuer. */
const PROBE_URL = 'https://captive.apple.com/hotspot-detect.html';

function statischeSeite(name) {
  return path.join(__dirname, '..', 'static', name);
}

/** Prueft in hoechstens 4 Sekunden, ob ueberhaupt Internet vorhanden ist. */
function internetVorhanden() {
  return new Promise((resolve) => {
    let erledigt = false;
    const fertig = (wert) => { if (!erledigt) { erledigt = true; resolve(wert); } };
    const timer = setTimeout(() => fertig(false), 4000);

    try {
      const anfrage = net.request({ method: 'HEAD', url: PROBE_URL });
      anfrage.on('response', () => { clearTimeout(timer); fertig(true); });
      anfrage.on('error', () => { clearTimeout(timer); fertig(false); });
      anfrage.end();
    } catch {
      clearTimeout(timer);
      fertig(false);
    }
  });
}

/**
 * Haengt die Fehlerbehandlung an ein Fenster.
 * Liefert Hilfsfunktionen fuer den erneuten Versuch.
 */
function applyConnectivityPolicy(fenster) {
  const contents = fenster.webContents;
  let wiederholTimer = null;
  let zeigtFehlerseite = false;
  let langsamTimer = null;
  /**
   * Chromium feuert did-finish-load AUCH fuer seine eigene Fehlerseite, und
   * zwar mit der urspruenglichen http-Adresse. Ohne diese Markierung galt ein
   * fehlgeschlagener Ladevorgang danach als "wiederhergestellt", der
   * Fehlerzustand wurde zurueckgesetzt und die Wiederholung gestoppt.
   * did-fail-load laeuft immer VOR did-finish-load — genau darauf baut das hier.
   */
  let navigationFehlgeschlagen = false;

  const stoppeWiederholung = () => {
    if (wiederholTimer) { clearInterval(wiederholTimer); wiederholTimer = null; }
  };

  /** Laedt die App neu. Wird vom Knopf und von der Automatik gerufen. */
  const erneutVersuchen = () => {
    log('Erneuter Verbindungsversuch');
    contents.loadURL(START_URL).catch(() => { /* Fehler laeuft in did-fail-load */ });
  };

  /**
   * Startet den stummen Hintergrundversuch. Alle RETRY_MS, ohne den Nutzer
   * zu behelligen — sobald es klappt, ist die App einfach wieder da.
   */
  const starteWiederholung = () => {
    stoppeWiederholung();
    wiederholTimer = setInterval(async () => {
      if (!zeigtFehlerseite) { stoppeWiederholung(); return; }
      const netzDa = await internetVorhanden();
      if (netzDa) erneutVersuchen();
    }, RETRY_MS);
  };

  contents.on('did-start-loading', () => {
    // Dezenter Ladehinweis erst nach SLOW_LOAD_MS — bei schneller Verbindung
    // sieht der Nutzer nie ein Zwischenbild.
    if (langsamTimer) clearTimeout(langsamTimer);
    langsamTimer = setTimeout(() => {
      if (contents.isLoading()) log('Laden dauert ungewoehnlich lange');
    }, SLOW_LOAD_MS);
  });

  contents.on('did-stop-loading', () => {
    if (langsamTimer) { clearTimeout(langsamTimer); langsamTimer = null; }
  });

  contents.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Nur echte Fehlschlaege des Hauptdokuments. errorCode -3 ist ein
    // abgebrochener Ladevorgang (z.B. weil der Nutzer weiternavigiert hat)
    // und kein Fehler.
    if (!isMainFrame || errorCode === -3) return;

    log(`Laden fehlgeschlagen (${errorCode} ${errorDescription})`);
    navigationFehlgeschlagen = true;
    const netzDa = await internetVorhanden();
    zeigtFehlerseite = true;

    const seite = netzDa ? 'server-error.html' : 'offline.html';
    // origin als Query mitgeben: die Zustandsseite braucht die App-Adresse
    // fuer ihren Erneut-versuchen-Knopf, ohne sie hartcodieren zu muessen
    // und ohne Preload-Bruecke.
    contents.loadFile(statischeSeite(seite), { query: { origin: START_URL } })
      .then(() => { fenster.show(); starteWiederholung(); })
      .catch((err) => log(`Zustandsseite konnte nicht geladen werden: ${err?.message}`));
  });

  // Erfolgreicher Ladevorgang der echten App: Fehlerzustand aufheben.
  contents.on('did-finish-load', () => {
    // Fehlerseite von Chromium: did-fail-load hat gerade markiert. Kein Erfolg.
    if (navigationFehlgeschlagen) {
      navigationFehlgeschlagen = false;
      return;
    }
    const url = contents.getURL();
    if (url.startsWith('file://')) return;   // eine unserer Zustandsseiten
    if (zeigtFehlerseite) log('Verbindung wiederhergestellt');
    zeigtFehlerseite = false;
    stoppeWiederholung();
  });

  // Renderer abgestuerzt — ohne Behandlung bliebe ein weisses Fenster.
  contents.on('render-process-gone', (_event, details) => {
    log(`Renderer beendet: ${details?.reason}`);
    contents.loadFile(statischeSeite('server-error.html')).catch(() => {});
  });

  return { erneutVersuchen, stoppeWiederholung, internetVorhanden };
}

module.exports = { applyConnectivityPolicy, internetVorhanden };
