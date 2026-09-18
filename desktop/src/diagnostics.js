'use strict';

const { app, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Logging und Diagnose.
 *
 * DATENSCHUTZ: Hier landen ausschliesslich Zeitstempel, Eventnamen, Zaehler,
 * Statuscodes und Fehlermeldungen. NIEMALS Tokens, Passwoerter,
 * Authorization-Header, API-Antworten, E-Mail-Adressen oder
 * Geschaeftsdaten. Fehlertexte werden vor dem Schreiben entschaerft.
 *
 * Die Logdatei rotiert taeglich, sieben Tage werden aufgehoben.
 */

const MAX_TAGE = 7;
let logPfad = null;
let stream = null;

function logVerzeichnis() {
  return path.join(app.getPath('userData'), 'logs');
}

function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Schneidet Query-Strings ab (koennten Parameter tragen) und kuerzt. */
function safe(text) {
  return String(text ?? '')
    .replace(/\?[^\s]*/g, '?…')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .slice(0, 300);
}

function initLogging() {
  try {
    const dir = logVerzeichnis();
    fs.mkdirSync(dir, { recursive: true });

    // Alte Dateien aufraeumen
    const grenze = Date.now() - MAX_TAGE * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).mtimeMs < grenze) fs.unlinkSync(p);
      } catch { /* einzelne Datei ueberspringen */ }
    }

    logPfad = path.join(dir, `filapen-hub-${heute()}.log`);
    stream = fs.createWriteStream(logPfad, { flags: 'a' });
    log(`--- Start ${app.getVersion()} auf macOS ${os.release()} (${process.arch}) ---`);
  } catch (err) {
    // Logging darf die App niemals verhindern.
    // eslint-disable-next-line no-console
    console.error('[filapen] Logging konnte nicht gestartet werden:', err?.message);
  }
}

function log(nachricht) {
  const zeile = `[${new Date().toISOString()}] ${safe(nachricht)}`;
  // eslint-disable-next-line no-console
  console.log(zeile);
  try { stream?.write(zeile + '\n'); } catch { /* ignorieren */ }
}

/**
 * Text fuer den Menuepunkt "Diagnoseinformationen kopieren".
 * Bewusst ohne Nutzerbezug — nur Technik.
 */
function diagnoseText(extra = {}) {
  const zeilen = [
    `Filapen Hub ${app.getVersion()}`,
    `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
    `macOS ${os.release()} · ${process.arch}`,
    `Sprache ${app.getLocale()}`,
    `Logdatei ${logPfad ?? '(keine)'}`,
  ];
  for (const [k, v] of Object.entries(extra)) zeilen.push(`${k}: ${safe(v)}`);
  return zeilen.join('\n');
}

function diagnoseKopieren(extra) {
  const text = diagnoseText(extra);
  clipboard.writeText(text);
  log('Diagnoseinformationen in die Zwischenablage kopiert');
  return text;
}

module.exports = { initLogging, log, safe, diagnoseText, diagnoseKopieren, logVerzeichnis };
