'use strict';

const { app, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { log } = require('./diagnostics');
const { zeigeToast } = require('./download-toast');

/**
 * Downloads — Safari-Muster.
 *
 * Datei landet direkt im normalen Download-Ordner, ohne Dialog. Bei
 * Namenskollision wird eine Nummer angehaengt. Danach erscheint ein dezenter
 * Hinweis mit "Oeffnen" und "Im Finder zeigen". Nichts oeffnet sich
 * automatisch.
 *
 * Die Web-App merkt davon nichts: sie ruft weiter ihr a.download mit
 * Blob-URL auf, Electron faengt den Vorgang ab.
 */

/**
 * Namen, die einem laufenden Download schon zugeteilt sind.
 *
 * Ohne diese Menge genuegt `fs.existsSync` nicht: zwischen der Pruefung und
 * dem ersten geschriebenen Byte liegt ein Zeitfenster. Starten zwei
 * Downloads mit demselben Dateinamen gleichzeitig, sieht der zweite die
 * Datei des ersten noch nicht, waehlt denselben Pfad — und ueberschreibt
 * ihn. Nachgemessen: aus zwei "rechnung.pdf" wurde EINE Datei.
 */
const vergebenePfade = new Set();

/**
 * Sucht einen freien Dateinamen und reserviert ihn sofort. "rechnung.pdf"
 * wird zu "rechnung (2).pdf", damit ein zweiter Download nichts
 * ueberschreibt — auch dann nicht, wenn beide zeitgleich laufen.
 */
function freierPfad(ordner, dateiname) {
  const ext = path.extname(dateiname);
  const basis = path.basename(dateiname, ext);
  let kandidat = path.join(ordner, dateiname);
  let n = 2;
  while (fs.existsSync(kandidat) || vergebenePfade.has(kandidat)) {
    kandidat = path.join(ordner, `${basis} (${n})${ext}`);
    n += 1;
    if (n > 999) break;   // Sicherheitsnetz gegen Endlosschleifen
  }
  vergebenePfade.add(kandidat);
  return kandidat;
}

function applyDownloadPolicy(session) {
  session.on('will-download', (event, item) => {
    let zielPfad;
    try {
      const downloads = app.getPath('downloads');
      fs.mkdirSync(downloads, { recursive: true });
      zielPfad = freierPfad(downloads, item.getFilename());
      // setSavePath unterdrueckt den "Speichern unter"-Dialog.
      item.setSavePath(zielPfad);
    } catch (err) {
      log(`Download-Ziel konnte nicht bestimmt werden: ${err?.message}`);
      // Reservierung nicht liegen lassen, sonst waechst der Name bei jedem
      // weiteren Versuch um eine Nummer.
      if (zielPfad) vergebenePfade.delete(zielPfad);
      return;   // Electron zeigt dann seinen Standarddialog
    }

    const name = path.basename(zielPfad);
    log(`Download gestartet: ${name}`);

    item.once('done', (_e, state) => {
      vergebenePfade.delete(zielPfad);
      if (state === 'completed') {
        log(`Download fertig: ${name}`);
        zeigeToast({
          dateiname: name,
          pfad: zielPfad,
          erfolg: true,
        });
      } else {
        log(`Download fehlgeschlagen (${state}): ${name}`);
        zeigeToast({
          dateiname: name,
          pfad: null,
          erfolg: false,
        });
      }
    });
  });

  log('Download-Policy aktiv: Download-Ordner, kein Dialog');
}

/** Datei in der Standardanwendung oeffnen — nur auf Klick des Nutzers. */
function dateiOeffnen(pfad) {
  shell.openPath(pfad).then((fehler) => {
    if (fehler) log(`Oeffnen fehlgeschlagen: ${fehler}`);
  });
}

/** Datei im Finder zeigen. */
function imFinderZeigen(pfad) {
  shell.showItemInFolder(pfad);
}

module.exports = { applyDownloadPolicy, dateiOeffnen, imFinderZeigen };
