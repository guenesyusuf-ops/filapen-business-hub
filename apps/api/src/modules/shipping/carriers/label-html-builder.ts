import type { ShipmentCreateInput } from './carrier-adapter.interface';

/**
 * Produces a printable HTML label that renders at 100×150 mm on most browsers
 * (configurable via @page size). Works as a fallback for any carrier
 * without API integration. Prints correctly on thermal printers when the
 * user selects "Actual size" in the print dialog.
 *
 * @param format 'pdf_100x150' | 'pdf_103x199' | 'pdf_a4'
 */
export function buildLabelHtml(
  input: ShipmentCreateInput,
  opts: {
    carrier: string;
    trackingNumber: string;
    format: 'pdf_100x150' | 'pdf_103x199' | 'pdf_a4';
    note?: string;
  },
): string {
  const sizes = {
    pdf_100x150: { width: 100, height: 150, padding: 6 },
    pdf_103x199: { width: 103, height: 199, padding: 6 },
    pdf_a4: { width: 210, height: 297, padding: 15 },
  };
  const s = sizes[opts.format];

  const recipient = input.recipient;
  const sender = input.sender;
  const date = new Date().toLocaleDateString('de-DE');
  const trackingBarcode = trackingBarcodeSvg(opts.trackingNumber);

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>Versandlabel ${esc(opts.trackingNumber)}</title>
<style>
  @page { size: ${s.width}mm ${s.height}mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  .label {
    width: ${s.width}mm;
    height: ${s.height}mm;
    padding: ${s.padding}mm;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .carrier-bar {
    font-size: 11pt;
    font-weight: bold;
    letter-spacing: 0.5px;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
    padding: 2mm 0;
    text-align: center;
    margin-bottom: 3mm;
  }
  .sender {
    font-size: 7pt;
    color: #222;
    border-bottom: 0.5px solid #000;
    padding-bottom: 1.5mm;
    margin-bottom: 2mm;
  }
  .recipient-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 1mm; }
  .recipient {
    font-size: 11pt;
    line-height: 1.4;
    margin-bottom: 3mm;
  }
  .recipient .name { font-weight: bold; font-size: 12pt; }
  .tracking {
    border: 1.5px solid #000;
    padding: 2mm;
    text-align: center;
    margin-top: auto;
  }
  .tracking .code { font-family: 'Courier New', monospace; font-weight: bold; font-size: 11pt; letter-spacing: 1px; margin-bottom: 1mm; }
  .tracking .label-text { font-size: 6pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { font-size: 6pt; color: #777; margin-top: 2mm; text-align: right; }
  .barcode-svg { width: 100%; height: 12mm; }
  .weight-row { display:flex; justify-content: space-between; font-size: 7pt; margin-top: 1.5mm; border-top: 0.5px solid #ccc; padding-top: 1mm; }
  @media screen {
    body { background: #f3f4f6; padding: 20px; }
    .label { box-shadow: 0 2px 12px rgba(0,0,0,0.15); border: 1px solid #e5e7eb; background: #fff; }
  }
</style>
</head>
<body>
<div class="label">
  <div class="carrier-bar">${esc(opts.carrier.toUpperCase())}${input.shippingMethod ? ' · ' + esc(input.shippingMethod) : ''}</div>

  <div class="sender">
    <strong>Absender:</strong> ${esc(sender.name)}, ${esc(sender.address.street)}${sender.address.houseNumber ? ' ' + esc(sender.address.houseNumber) : ''}, ${esc(sender.address.zip)} ${esc(sender.address.city)}, ${esc(sender.address.country)}
  </div>

  <div class="recipient-label">Empfänger</div>
  <div class="recipient">
    <div class="name">${esc(recipient.name)}</div>
    <div>${esc(recipient.address.street)}${recipient.address.houseNumber ? ' ' + esc(recipient.address.houseNumber) : ''}</div>
    ${recipient.address.address2 ? `<div>${esc(recipient.address.address2)}</div>` : ''}
    <div>${esc(recipient.address.zip)} ${esc(recipient.address.city)}</div>
    <div><strong>${esc(recipient.address.country)}</strong></div>
    ${recipient.phone ? `<div style="font-size:7pt;color:#666;margin-top:1mm;">Tel: ${esc(recipient.phone)}</div>` : ''}
  </div>

  <div class="tracking">
    <div class="barcode-svg">${trackingBarcode}</div>
    <div class="code">${esc(opts.trackingNumber)}</div>
    <div class="label-text">Tracking-Nummer</div>
  </div>

  <div class="weight-row">
    <span>Gewicht: ${(input.weightG / 1000).toFixed(2)} kg</span>
    ${input.lengthMm && input.widthMm && input.heightMm ? `<span>${input.lengthMm}×${input.widthMm}×${input.heightMm} mm</span>` : ''}
  </div>

  <div class="meta">
    ${esc(date)} · Ref ${esc(input.reference || input.orderId.slice(0, 8))}
    ${opts.note ? '<br/>' + esc(opts.note) : ''}
  </div>
</div>
<script>
  // Auto-focus printing when opened directly (skipped if embedded via iframe/ask)
  if (window.location.hash === '#print') { setTimeout(() => window.print(), 100); }
</script>
</body>
</html>`;
}

function esc(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Very simple Code-128-ish visual barcode — NOT machine-scannable.
 * Real carriers produce actual scannable barcodes via their label API.
 * This renders a visual placeholder that looks like a barcode so the
 * stub labels don't look empty.
 */
function trackingBarcodeSvg(text: string): string {
  // Deterministic stripe pattern from text — pseudo-barcode
  const bars: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bars.push((c % 3) + 1, ((c >> 2) % 2) + 1, ((c >> 4) % 3) + 1);
  }
  let x = 0;
  const rects: string[] = [];
  for (let i = 0; i < bars.length; i++) {
    const w = bars[i];
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="100" fill="#000" />`);
    x += w + 1;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 100" preserveAspectRatio="none">${rects.join('')}</svg>`;
}
