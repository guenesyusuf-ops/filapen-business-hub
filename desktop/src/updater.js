'use strict';

const { log } = require('./diagnostics');

/**
 * Auto-Update — in Version 1 bewusst NUR VORBEREITET, nicht aktiviert.
 *
 * Begruendung: Ein Update-Kanal ohne Signierung und ohne geschuetztes Hosting
 * waere das offene Hintertuerchen der gesamten Sicherheitsarchitektur. Er wird
 * erst konfiguriert, wenn drei Dinge feststehen:
 *
 *   1. Developer-ID-Zertifikat und Notarisierung
 *   2. geschuetztes Hosting (privater Supabase-Bucket mit signierten URLs)
 *   3. ein getesteter Update-Durchlauf
 *
 * Wichtig fuer die Erwartung: Normale Web-Deploys brauchen ohnehin KEIN
 * App-Update — die App laedt business.filapen.de. Dieser Updater betrifft
 * ausschliesslich die Huelle selbst (Electron-Sicherheitsupdates, neue native
 * Funktionen).
 *
 * Wenn aktiviert, gilt laut Spezifikation: Pruefung beim Start und alle sechs
 * Stunden, dezenter Hinweis mit "Jetzt neu starten" und "Später".
 * KEINE Pflichtupdates, keine stillen Neustarts.
 */

const AKTIV = false;

function initUpdater() {
  if (!AKTIV) {
    log('Auto-Update: vorbereitet, aber nicht aktiviert (siehe updater.js)');
    return;
  }

  // Ab hier erst nach Freigabe. Bewusst nicht als toter Code ausgefuehrt,
  // damit keine unkonfigurierte Update-Pruefung nach draussen telefoniert.
  //
  // const { autoUpdater } = require('electron-updater');
  // autoUpdater.autoDownload = true;
  // autoUpdater.autoInstallOnAppQuit = true;
  // autoUpdater.on('update-downloaded', zeigeHinweisMitNeustart);
  // autoUpdater.checkForUpdates();
  // setInterval(() => autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000);
}

module.exports = { initUpdater, AKTIV };
