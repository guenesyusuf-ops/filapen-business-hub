'use strict';

/**
 * Gemeinsamer Renderer fuer Offline- und Serverfehler-Seite.
 *
 * Bewusst ohne Preload und ohne IPC: Der Knopf navigiert direkt zur
 * App-Adresse. Die bekommt die Seite als Query-Parameter vom Hauptprozess,
 * damit hier keine Adresse hartcodiert ist und der Entwicklungsmodus
 * genauso funktioniert.
 *
 * Diese Navigation ist fuer die Navigationsregeln "intern" und wird daher
 * im Hauptfenster geladen — keine Sonderbehandlung noetig.
 */

const knopf = document.getElementById('btn-retry');
const status = document.getElementById('status');
const ziel = new URLSearchParams(window.location.search).get('origin');

let laeuft = false;

function versuchen() {
  if (laeuft || !ziel) return;
  laeuft = true;
  knopf.disabled = true;
  status.textContent = 'Verbinde …';
  window.location.href = ziel;
}

knopf.addEventListener('click', versuchen);

// Enter und Leertaste ebenfalls, fuer Tastaturbedienung.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); versuchen(); }
});

// Sichtbarer Hinweis, dass im Hintergrund weiter versucht wird.
let sekunden = 0;
setInterval(() => {
  if (laeuft) return;
  sekunden += 1;
  status.textContent = `Automatischer Versuch läuft … (${sekunden} s)`;
}, 1000);
