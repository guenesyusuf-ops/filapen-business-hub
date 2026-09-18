'use strict';

const { log } = require('./diagnostics');

/**
 * Berechtigungen.
 *
 * Grundhaltung: ALLES ablehnen. Die App laedt fremd gehosteten Remote-Inhalt;
 * der bekommt keinen Zugriff auf Kamera, Mikrofon, Standort, Zwischenablage,
 * Benachrichtigungen, Midi oder Bildschirmaufnahme.
 *
 * Screen Share ist bewusst NICHT Teil von Version 1. Deshalb steht hier
 * ausdruecklich keine Ausnahme fuer 'display-capture' — auch nicht
 * vorbereitend. Keine Berechtigung auf Vorrat.
 */

/**
 * Berechtigungen, die niemals gebraucht werden. Nur zur Dokumentation im Log —
 * abgelehnt wird ohnehin alles, was nicht ausdruecklich erlaubt ist.
 */
const NIEMALS = [
  'media',              // Kamera + Mikrofon
  'display-capture',    // Bildschirmaufnahme (kommt erst mit Screen Share)
  'geolocation',
  'notifications',
  'midi',
  'midiSysex',
  'pointerLock',
  'openExternal',
  'clipboard-read',
  'hid',
  'serial',
  'usb',
  'bluetooth',
];

function applyPermissionPolicy(session) {
  // Laufende Anfragen: alles ablehnen.
  session.setPermissionRequestHandler((webContents, permission, callback) => {
    log(`Berechtigung abgelehnt: ${permission}`);
    callback(false);
  });

  // Vorab-Pruefungen (z.B. navigator.permissions.query): ebenfalls verneinen,
  // damit die Web-App gar nicht erst einen Dialog anstoesst.
  session.setPermissionCheckHandler((webContents, permission) => {
    if (NIEMALS.includes(permission)) return false;
    return false;
  });

  // Geraetezugriff (WebHID, WebSerial, WebUSB) vollstaendig sperren.
  session.setDevicePermissionHandler(() => false);

  // Bildschirmquellen: kein Handler registriert. Damit schlaegt getDisplayMedia
  // definiert fehl, statt still ins Leere zu laufen. Screen Share wird
  // weiterhin im Browser genutzt — die Menueleiste weist darauf hin.
  log('Berechtigungs-Policy aktiv: alles abgelehnt');
}

module.exports = { applyPermissionPolicy };
