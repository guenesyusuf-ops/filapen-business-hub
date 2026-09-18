'use strict';

/**
 * Renderer des Download-Hinweises. Spricht ausschliesslich ueber die enge
 * toastApi aus toast-preload.js — kein Node, kein Dateizugriff.
 */

const karte = document.getElementById('karte');
const symbol = document.getElementById('symbol');
const dateiname = document.getElementById('dateiname');
const unter = document.getElementById('unter');
const aktionen = document.getElementById('aktionen');

function darstellen(daten) {
  if (!daten) return;
  dateiname.textContent = daten.dateiname ?? 'Datei';
  if (daten.erfolg) {
    karte.classList.remove('fehler');
    symbol.textContent = '✓';
    unter.textContent = 'Im Download-Ordner';
    aktionen.hidden = false;
  } else {
    karte.classList.add('fehler');
    symbol.textContent = '!';
    unter.textContent = 'Download fehlgeschlagen';
    aktionen.hidden = true;
  }
}

document.getElementById('btn-oeffnen').addEventListener('click', () => window.toastApi.oeffnen());
document.getElementById('btn-finder').addEventListener('click', () => window.toastApi.imFinderZeigen());
document.getElementById('btn-zu').addEventListener('click', () => window.toastApi.schliessen());

window.toastApi.beiDaten(darstellen);
window.toastApi.abfragen().then(darstellen).catch(() => {});
