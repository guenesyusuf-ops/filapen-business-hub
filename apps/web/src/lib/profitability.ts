import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/finance/profitability${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ProfitInput {
  productName: string;
  purchasePrice: number;        // EK netto pro Einheit
  shippingCost: number;          // Speditionskosten GESAMT (gesamte Bestellung)
  orderQuantity: number;         // Bestellmenge — Spedition wird hierauf umgelegt
  customsRate: number;           // Zollsatz %
  salesPrice: number;            // VK brutto
  vatRate: number;               // MwSt %
  shippingToCustomer: number;    // Versand zum Kunden
  paymentRate: number;           // Payment %
  adCost?: number | null;        // Werbekosten pro Verkauf (optional)
  notes?: string | null;
}

export interface ProfitCalculation extends ProfitInput {
  id: string;
  orgId: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Profitabilitaets-Berechnung. Alle Werte in €.
 *
 * Wichtige Annahmen:
 *  - VK ist BRUTTO (inkl. MwSt) — der Kunde zahlt diesen Preis
 *  - Paymentkosten + Werbung berechnen sich auf den BRUTTO-VK
 *    (PSP-Gebuehren laufen ueber den vom Kunden gezahlten Betrag)
 *  - MwSt geht durch — du musst sie abfuehren, also nicht im Gewinn
 *  - Speditionskosten + Zoll sind NETTO (keine MwSt im B2B-Import)
 */
export function compute(input: ProfitInput) {
  const ek = Number(input.purchasePrice) || 0;
  const shipTotal = Number(input.shippingCost) || 0;
  const qty = Math.max(1, Math.floor(Number(input.orderQuantity) || 1));
  const customsRate = Number(input.customsRate) || 0;
  const vk = Number(input.salesPrice) || 0;
  const vatRate = Number(input.vatRate) || 0;
  const shipCust = Number(input.shippingToCustomer) || 0;
  const payRate = Number(input.paymentRate) || 0;
  const ads = Number(input.adCost ?? 0) || 0;

  // Spedition wird auf alle Einheiten der Bestellung umgelegt
  const ship = shipTotal / qty;

  // 1. Zollgebuehren auf (EK + Spedition) pro Einheit
  const customsFee = (ek + ship) * (customsRate / 100);

  // 2. Produktpreis bei Ankunft pro Einheit
  const arrivedCost = ek + ship + customsFee;

  // 3. MwSt aus VK herausrechnen (VK ist Brutto)
  const vatAmount = vk * vatRate / (100 + vatRate);
  const vkNetto = vk - vatAmount;

  // 4. Paymentkosten auf VK brutto (PSP-Gebuehr auf gezahlten Betrag)
  const paymentFee = vk * (payRate / 100);

  // 5. Gewinn ohne Werbung
  const profit = vkNetto - arrivedCost - shipCust - paymentFee;

  // 6. Marge auf Netto-VK (Industrie-Standard fuer Margenrechnung)
  const margin = vkNetto > 0 ? (profit / vkNetto) * 100 : 0;

  // 7. Break-even ROAS — wie viel Umsatz muss ich pro Werbe-Euro machen
  //    damit ich +/- 0 raus komme. ROAS = Umsatz / Werbeausgaben.
  //    Pro verkauftem Produkt: bei profit > 0 darf ich bis zu `profit`
  //    fuer Werbung ausgeben → break-even-ROAS = VK / profit.
  //    Niedrigere ROAS = besser (weniger Werbung pro Euro Umsatz noetig).
  const breakevenRoas = profit > 0 ? vk / profit : Infinity;

  // 8. Mit Werbung: tatsaechlicher Gewinn nach Ad-Spend
  const profitAfterAds = profit - ads;
  const marginAfterAds = vkNetto > 0 ? (profitAfterAds / vkNetto) * 100 : 0;
  // Effektiver ROAS bei gegebenen Ad-Kosten — der ROAS bei dem du genau
  // diesen Gewinn machst (= dein aktueller pro Sale)
  const effectiveRoas = ads > 0 ? vk / ads : Infinity;

  // Kostenaufschluesselung fuer Visualisierung — alle Werte pro Einheit
  const breakdown = [
    { label: 'Einkauf', value: ek, color: '#3b82f6' },
    { label: 'Spedition / Einheit', value: ship, color: '#06b6d4' },
    { label: 'Zoll', value: customsFee, color: '#8b5cf6' },
    { label: 'MwSt', value: vatAmount, color: '#94a3b8' },
    { label: 'Versand Kunde', value: shipCust, color: '#f59e0b' },
    { label: 'Payment', value: paymentFee, color: '#ec4899' },
    ...(ads > 0 ? [{ label: 'Werbung', value: ads, color: '#ef4444' }] : []),
    { label: 'Gewinn', value: Math.max(0, profitAfterAds), color: '#10b981' },
  ];

  return {
    customsFee,
    arrivedCost,
    vatAmount,
    vkNetto,
    paymentFee,
    profit,
    margin,
    breakevenRoas,
    ads,
    profitAfterAds,
    marginAfterAds,
    effectiveRoas,
    breakdown,
  };
}

/**
 * Loest "Welchen VK brauche ich fuer X% Marge?" zurueck:
 * profit/vkNetto = targetMargin/100
 * vkNetto * (1 - targetMargin/100) = arrivedCost + shipCust + paymentFee
 *
 * paymentFee haengt von VK ab → quadratisch loesbar, aber wir nutzen
 * iterativen Ansatz: paymentRate ist klein, 5 Iterationen reichen.
 */
export function solveForMargin(input: ProfitInput, targetMarginPct: number): number {
  const customsRate = Number(input.customsRate) || 0;
  const vatRate = Number(input.vatRate) || 0;
  const payRate = Number(input.paymentRate) || 0;
  const ek = Number(input.purchasePrice) || 0;
  const shipTotal = Number(input.shippingCost) || 0;
  const qty = Math.max(1, Math.floor(Number(input.orderQuantity) || 1));
  const ship = shipTotal / qty;
  const shipCust = Number(input.shippingToCustomer) || 0;
  const arrivedCost = ek + ship + (ek + ship) * (customsRate / 100);

  // Iterativ: starte mit VK = (arrivedCost + shipCust) / (1 - margin/100) * (1 + vat/100)
  const m = targetMarginPct / 100;
  let vk = (arrivedCost + shipCust) / (1 - m) * (1 + vatRate / 100);
  for (let i = 0; i < 8; i++) {
    const paymentFee = vk * (payRate / 100);
    const vkNetto = vk / (1 + vatRate / 100);
    const requiredNetProfit = m * vkNetto;
    const totalCost = arrivedCost + shipCust + paymentFee;
    const requiredVkNetto = totalCost + requiredNetProfit;
    vk = requiredVkNetto * (1 + vatRate / 100);
  }
  return vk;
}

export const profitabilityApi = {
  list: () => call<ProfitCalculation[]>(''),
  get: (id: string) => call<ProfitCalculation>(`/${id}`),
  create: (data: ProfitInput) => call<ProfitCalculation>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ProfitInput>) => call<ProfitCalculation>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => call(`/${id}`, { method: 'DELETE' }),
};

export const fmtEUR = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

export const fmtPct = (n: number, digits = 1): string => {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)} %`;
};
