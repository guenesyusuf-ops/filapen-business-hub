# Filapen Hub — macOS-App

Native Hülle um die bestehende Web-Anwendung unter `business.filapen.de`.

## Grundsatz

Dieses Verzeichnis ist ein **eigenständiges Node-/Electron-Projekt**. Es liegt
absichtlich unter `/desktop` und **nicht** unter `apps/desktop`:

Die Root-`package.json` deklariert `workspaces: ["apps/*", "packages/*"]`, und
Vercel installiert mit `cd ../.. && npm install`. Läge das Projekt unter
`apps/desktop`, würde **jeder Web-Deploy Electron mitinstallieren** — rund
200 MB zusätzlich, langsamere Builds, und die Root-`package.json` müsste
geändert werden. Unter `/desktop` greift kein Workspace-Glob.

**Alle Installationen ausschließlich hier drin ausführen:**

```bash
cd desktop
npm install
```

Niemals `npm install` im Repo-Root für Desktop-Abhängigkeiten. Dieses Projekt
hat eigene `package.json`, eigene `package-lock.json` und eigene
`node_modules`.

## Entwicklung

```bash
cd desktop
npm install
npm run dev     # zeigt auf http://localhost:3000, DevTools aktiv
npm start       # zeigt auf https://business.filapen.de
```

Der Entwicklungsmodus wird über `FILAPEN_ENV=development` gesetzt. Im
ausgelieferten Build ist diese Variable nicht gesetzt — die App kann dort
niemals auf `localhost` zeigen, und die Entwicklerwerkzeuge sind nicht
erreichbar.

## Build

```bash
cd desktop
npm run build   # erzeugt dist/Filapen Hub-1.0.0-arm64.dmg
```

Ohne Zertifikat entsteht ein **unsignierter lokaler Testbau**. Der ist
ausschließlich zum eigenen Ansehen gedacht und wird an niemanden verteilt.

### Signierung und Notarisierung

Für die verteilte Fassung werden diese Variablen gesetzt:

```bash
export CSC_LINK=/pfad/zum/zertifikat.p12
export CSC_KEY_PASSWORD='…'
export APPLE_ID='…'
export APPLE_APP_SPECIFIC_PASSWORD='…'
export APPLE_TEAM_ID='…'
npm run build
```

Nichts davon gehört ins Repository.

## Architektur

| Datei | Aufgabe |
|---|---|
| `src/main.js` | Einstiegspunkt, App-Lebenszyklus, Sicherheitsregeln anwenden |
| `src/config.js` | Adressen, Fenstermaße, Grenzwerte — eine einzige Stelle |
| `src/window.js` | Fenster, gemerkter Zustand, Monitor-Rückkehr, Zoom |
| `src/menu.js` | Deutsche Menüleiste inkl. „Gehe zu" über 20 Bereiche |
| `src/navigation.js` | Eigene Domain bleibt drin, Fremdes geht an den Browser |
| `src/permissions.js` | Lehnt **alle** Berechtigungen ab |
| `src/downloads.js` | Download-Ordner ohne Dialog, Namenskollisionen |
| `src/download-toast.js` | Eigenes Hinweis-Fenster, ohne Web-Kopplung |
| `src/toast-preload.js` | Enge Brücke **nur** für das eigene Toast-Fenster |
| `src/connectivity.js` | Unterscheidet „kein Internet" von „Filapen weg" |
| `src/updater.js` | Vorbereitet, **nicht aktiviert** |
| `src/diagnostics.js` | Logs mit Rotation, Diagnose-Kopie |
| `static/*` | Eigene Seiten: offline, Serverfehler, Download-Hinweis |

## Sicherheitsmodell

Das Hauptfenster lädt fremd gehosteten Remote-Inhalt. Entsprechend:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- **kein Preload für das Hauptfenster** — die Web-App bekommt keine Brücke
- alle Berechtigungen abgelehnt
- Entwicklerwerkzeuge nur im Entwicklungsmodus

Jede native Funktion läuft im Hauptprozess und wird durch Electron-Ereignisse
ausgelöst, nicht durch Aufrufe der Web-App. Das einzige Preload im Projekt
gehört zum eigenen Toast-Fenster und kennt drei feste Aktionen ohne freie
Parameter.

## Was diese Version nicht tut

Screen Share, direkte Etikettendrucker-Ansteuerung, aktive Auto-Updates,
Pflichtupdates, Dock-Badges, Systembenachrichtigungen, eigene
Download-Verwaltung, integrierte Titelleiste, angepasste Scrollbars,
Deep Links, mehrere Fenster.

## Was am Web-Projekt geändert wurde

**Nichts.** Keine Datei unter `apps/`, `packages/`, keine Root-`package.json`,
keine `turbo.json`, keine `vercel.json`. Der Rollback der gesamten
Desktop-Arbeit ist das Löschen dieses Verzeichnisses.
