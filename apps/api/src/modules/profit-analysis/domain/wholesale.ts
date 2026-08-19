import { D, toD, ONE, HUNDRED, round2 } from './decimal';
import { margin } from './margin';

export interface WholesaleItemInput {
  quantity: number;
  unitPriceGross: number | string | D;
  vatRate: number | string | D;
  productCostSnapshot: number | string | D;
}

export interface WholesaleItemResult {
  quantity: number;
  vatRate: D;
  totalGross: D;
  totalNet: D;
  totalVat: D;
  totalCost: D;         // Stueckzahl × frozen Produktkosten
  totalProfit: D;
}

export interface WholesaleOrderTotals {
  itemCount: number;
  totalGross: D;
  totalNet: D;
  totalVat: D;
  totalCost: D;
  totalProfit: D;
  margin: D | null;
  items: WholesaleItemResult[];
}

/**
 * §48: Grosshandelsgewinn = Nettobestellsumme − Produktkosten.
 *
 * Master-Prompt §47 verlangt USt 19/7 auch fuer Grosshandel — pro Position
 * konfigurierbar. Netto wird PRO POSITION aus Brutto herausgerechnet.
 */
export function calculateWholesaleOrder(items: WholesaleItemInput[]): WholesaleOrderTotals {
  const results = items.map((it): WholesaleItemResult => {
    const qty = it.quantity;
    const unitGross = toD(it.unitPriceGross);
    const rate = toD(it.vatRate);
    const totalGross = unitGross.times(qty);
    const totalNet = rate.isZero() ? totalGross : totalGross.div(ONE.plus(rate.div(HUNDRED)));
    const totalVat = totalGross.minus(totalNet);
    const totalCost = toD(it.productCostSnapshot).times(qty);
    const totalProfit = totalNet.minus(totalCost);
    return {
      quantity: qty,
      vatRate: rate,
      totalGross,
      totalNet,
      totalVat,
      totalCost,
      totalProfit,
    };
  });

  const totalGross = results.reduce((acc, r) => acc.plus(r.totalGross), toD(0));
  const totalNet   = results.reduce((acc, r) => acc.plus(r.totalNet),   toD(0));
  const totalVat   = results.reduce((acc, r) => acc.plus(r.totalVat),   toD(0));
  const totalCost  = results.reduce((acc, r) => acc.plus(r.totalCost),  toD(0));
  const totalProfit = totalNet.minus(totalCost);

  return {
    itemCount: results.length,
    totalGross,
    totalNet,
    totalVat,
    totalCost,
    totalProfit,
    margin: margin(totalProfit, totalNet),
    items: results,
  };
}

/** Runden fuer Api-Ausgabe. */
export function roundWholesaleOrder(o: WholesaleOrderTotals): WholesaleOrderTotals {
  return {
    ...o,
    totalGross: round2(o.totalGross),
    totalNet: round2(o.totalNet),
    totalVat: round2(o.totalVat),
    totalCost: round2(o.totalCost),
    totalProfit: round2(o.totalProfit),
    items: o.items.map((r) => ({
      ...r,
      totalGross: round2(r.totalGross),
      totalNet: round2(r.totalNet),
      totalVat: round2(r.totalVat),
      totalCost: round2(r.totalCost),
      totalProfit: round2(r.totalProfit),
    })),
  };
}
