'use strict';

/**
 * Zentrale Konfiguration. Eine einzige Stelle fuer Adressen und Grenzwerte,
 * damit nichts im Code verstreut liegt.
 */

const isDev = process.env.FILAPEN_ENV === 'development';

/**
 * Die Production-Adresse. Die App laedt die ECHTE Web-App — kein file://-Build,
 * keine Kopie des Frontends. Dadurch erscheint jeder Web-Deploy automatisch
 * auch in der Desktop-App, ohne dass eine neue DMG verteilt werden muss.
 */
const PRODUCTION_ORIGIN = 'https://business.filapen.de';

/**
 * Nur im Entwicklungsmodus erreichbar. Der ausgelieferte Build kann hier
 * niemals landen, weil FILAPEN_ENV im Paket nicht gesetzt ist.
 */
const DEV_ORIGIN = 'http://localhost:3000';

const APP_ORIGIN = isDev ? DEV_ORIGIN : PRODUCTION_ORIGIN;

/**
 * Womit die App startet — und zwar NICHT mit der nackten Adresse.
 *
 * `/` ist eine statische Werbeseite ohne jede Anmeldepruefung. Wer die App
 * oeffnete, landete dort und musste sich erst weiterklicken; wer gerade
 * neugestartet hatte, hielt das verstaendlicherweise fuer einen verlorenen
 * Login.
 *
 * `/home` ist der richtige Einstieg: die Seite liegt hinter dem
 * Dashboard-Layout, und das leitet von sich aus auf `/login` weiter, wenn
 * keine gueltige Anmeldung vorliegt. Beide Faelle sind damit abgedeckt,
 * ohne dass die Huelle etwas ueber den Anmeldezustand wissen muss.
 */
const START_PATH = '/home';
const START_URL = `${APP_ORIGIN}${START_PATH}`;

/**
 * Hosts, deren Navigation IM Hauptfenster erlaubt ist.
 *
 * Wichtig: Diese Liste steuert ausschliesslich Navigationen des Hauptfensters.
 * Unterressourcen — Bilder, Schriften, fetch, XHR, WebSocket — werden NIEMALS
 * geprueft oder blockiert. Eine pauschale Domain-Sperre gaebe es sonst
 * versehentlich auch fuer die Railway-API, Google Fonts, Supabase-Anhaenge
 * und die Liveblocks-Verbindung.
 */
const INTERNAL_HOSTS = [
  'business.filapen.de',
  'localhost',
];

/** Fenster-Vorgaben aus der Spezifikation. */
const WINDOW = {
  defaultWidth: 1440,
  defaultHeight: 900,
  minWidth: 1100,
  minHeight: 700,
};

/** Zoom-Grenzen: 75 % bis 150 %, wie festgelegt. */
const ZOOM = {
  min: -1.5,   // entspricht etwa 75 %
  max: 1.75,   // entspricht etwa 150 %
  step: 0.25,
};

/** Wie lange der Download-Hinweis stehen bleibt. */
const TOAST_MS = 8000;

/** Abstand zwischen automatischen Verbindungsversuchen im Offline-Zustand. */
const RETRY_MS = 5000;

/** Nach dieser Zeit ohne Inhalt erscheint ein dezenter Ladehinweis. */
const SLOW_LOAD_MS = 2000;

module.exports = {
  isDev,
  APP_ORIGIN,
  START_PATH,
  START_URL,
  PRODUCTION_ORIGIN,
  INTERNAL_HOSTS,
  WINDOW,
  ZOOM,
  TOAST_MS,
  RETRY_MS,
  SLOW_LOAD_MS,
};
