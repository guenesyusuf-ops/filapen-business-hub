'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload AUSSCHLIESSLICH fuer unser eigenes Toast-Fenster.
 *
 * Wichtig zur Abgrenzung: Das Hauptfenster, das die Web-App laedt, bekommt
 * KEIN Preload und KEINE Bruecke. Dieses hier gilt nur fuer statisches HTML
 * aus dem eigenen Paket — kein Remote-Inhalt.
 *
 * Die Schnittstelle ist absichtlich winzig: eine Abfrage, drei feste
 * Aktionen, keine freien Parameter. Der Dateipfad bleibt im Hauptprozess,
 * damit von hier aus keine beliebige Datei geoeffnet werden kann.
 */
contextBridge.exposeInMainWorld('toastApi', {
  /** Liefert Dateiname und Erfolgsstatus des letzten Downloads. */
  abfragen: () => ipcRenderer.invoke('toast:abfragen'),

  /** Wird bei einem neuen Download gerufen. */
  beiDaten: (callback) => {
    ipcRenderer.on('toast:daten', (_event, daten) => callback(daten));
  },

  oeffnen: () => ipcRenderer.send('toast:aktion', 'oeffnen'),
  imFinderZeigen: () => ipcRenderer.send('toast:aktion', 'finder'),
  schliessen: () => ipcRenderer.send('toast:aktion', 'schliessen'),
});
