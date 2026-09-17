'use strict';

/**
 * Erzeugt das App-Icon aus dem vorhandenen Logo-SVG.
 *
 * Warum mit Electron: Auf diesem Rechner ist kein SVG-Konverter installiert
 * (kein rsvg-convert, kein ImageMagick, kein Inkscape). Electron bringt
 * Chromium mit und rendert das SVG damit sauber — kein zusaetzliches
 * Werkzeug noetig.
 *
 * Wichtig: Das Quell-SVG hat seinen Inhalt NICHT zentriert in der 512er
 * Flaeche, sondern im unteren Bereich. Ein blosses Einbetten ergaebe ein
 * winziges, verschobenes Motiv mit viel Totraum. Deshalb laesst dieses Skript
 * Chromium per getBBox() die tatsaechliche Ausdehnung des Inhalts messen und
 * setzt daraus eine passgenaue viewBox.
 *
 * Aufruf:
 *   npx electron scripts/make-icon.js           → volles Logo (Marke + Schrift)
 *   npx electron scripts/make-icon.js mark      → nur die Bildmarke
 */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const QUELLE = path.resolve(__dirname, '..', '..', 'logo-normal.svg');
const VARIANTE = process.argv.includes('mark') ? 'mark' : 'full';
const ZIEL = path.resolve(
  __dirname, '..', 'build',
  VARIANTE === 'mark' ? 'icon-mark.png' : 'icon.png',
);

const GROESSE = 1024;
// macOS-Raster: die Kachel fuellt nicht die ganze Flaeche. Apple nutzt fuer
// die meisten App-Icons etwa 824 von 1024 Punkten, Eckradius rund 22,4 %.
const KACHEL = 824;
const RADIUS = Math.round(KACHEL * 0.2237);
// Anteil der Kachel, den das Motiv einnehmen soll. Die Wortmarke ist breit
// und flach, deshalb etwas mehr Luft als bei einer kompakten Bildmarke.
const FUELLUNG = VARIANTE === 'mark' ? 0.62 : 0.76;

/**
 * Seite, die das SVG einbettet und im Browser vermisst.
 * Die Messung passiert VOR der Aufnahme, damit die viewBox exakt sitzt.
 */
function html(svgInhalt) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body { margin:0; padding:0; width:${GROESSE}px; height:${GROESSE}px;
              background:transparent; overflow:hidden; }
  #kachel {
    position:absolute;
    left:${(GROESSE - KACHEL) / 2}px; top:${(GROESSE - KACHEL) / 2}px;
    width:${KACHEL}px; height:${KACHEL}px;
    background:#ffffff;
    border-radius:${RADIUS}px;
    display:flex; align-items:center; justify-content:center;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
  }
  #buehne { width:${Math.round(KACHEL * FUELLUNG)}px; height:${Math.round(KACHEL * FUELLUNG)}px; }
  #buehne svg { width:100%; height:100%; display:block; }
</style></head>
<body>
  <div id="kachel"><div id="buehne">${svgInhalt}</div></div>
  <script>
    (function () {
      var svg = document.querySelector('#buehne svg');
      // Nur die Bildmarke: der Schriftzug ist ein <path> mit text-Attribut,
      // die Marke eine <g>. Fuer die Marken-Variante wird der Text entfernt.
      if (${VARIANTE === 'mark' ? 'true' : 'false'}) {
        var text = svg.querySelector('path[text]');
        if (text) text.remove();
      }
      // Ausdehnung am SVG-WURZELELEMENT messen.
      //
      // Wichtig: getBBox() auf den Kindern liefert Koordinaten in deren
      // EIGENEM System und ignoriert ihre transform-Matrizen. Dieses SVG
      // arbeitet durchgehend mit matrix(...)-Transformationen, eine Messung
      // an den Kindern ergibt daher voellig falsche Werte. getBBox() am
      // <svg> selbst liefert die Vereinigung aller Kinder IM Benutzersystem
      // des SVG, also mit angewandten Transformationen.
      var box = null;
      try {
        var b = svg.getBBox();
        if (b && b.width > 0 && b.height > 0) {
          box = { x: b.x, y: b.y, x2: b.x + b.width, y2: b.y + b.height };
        }
      } catch (e) { box = null; }
      if (box) {
        var breite = box.x2 - box.x;
        var hoehe = box.y2 - box.y;
        // Quadratische viewBox um den Inhalt, damit nichts verzerrt wird.
        var seite = Math.max(breite, hoehe);
        var mx = box.x + breite / 2;
        var my = box.y + hoehe / 2;
        svg.setAttribute('viewBox',
          (mx - seite / 2) + ' ' + (my - seite / 2) + ' ' + seite + ' ' + seite);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        document.title = 'ok ' + Math.round(breite) + 'x' + Math.round(hoehe);
      } else {
        document.title = 'keine-bbox';
      }
    })();
  </script>
</body></html>`;
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  if (!fs.existsSync(QUELLE)) {
    console.error(`Logo nicht gefunden: ${QUELLE}`);
    app.exit(1);
    return;
  }

  const svg = fs.readFileSync(QUELLE, 'utf8');

  const win = new BrowserWindow({
    width: GROESSE,
    height: GROESSE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true, sandbox: false },
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html(svg)));
  await new Promise((r) => setTimeout(r, 700));

  const gemessen = win.webContents.getTitle();
  const bild = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
  fs.writeFileSync(ZIEL, bild.toPNG());

  const { width, height } = bild.getSize();
  console.log(`Variante: ${VARIANTE}`);
  console.log(`Inhaltsmessung: ${gemessen}`);
  console.log(`geschrieben: ${width}x${height} → ${ZIEL}`);

  win.destroy();
  app.exit(0);
});
