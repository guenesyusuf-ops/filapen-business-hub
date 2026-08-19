import { D, toD, HUNDRED, round2 } from './decimal';
import { margin, roas } from './margin';

// -----------------------------------------------------------------------------
// Gemeinsame Typen
// -----------------------------------------------------------------------------

export interface ChannelProfitResult {
  netSales: D;              // Netto-Umsatz des Kanals (nach Retouren)
  productCosts: D;
  shippingCosts: D;
  platformFees: D;          // Payment Fee / Amazon-Gebuehr / TikTok-Gebuehr
  totalCostsWithoutAds: D;  // Master-Prompt §24/25/26
  adsAttributed: D;         // Summe der Werbekosten die dem Kanal zugerechnet werden
  profit: D;                // Netto - totalCostsWithoutAds - adsAttributed
  margin: D | null;         // Profit / netSales × 100
  roasGross: D | null;
  roasNet: D | null;
}

// -----------------------------------------------------------------------------
// Shopify Webshop (§27)
// -----------------------------------------------------------------------------

export interface WebshopProfitInput {
  netSales: number | string | D;     // Shopify Netto-Umsatz
  grossSales: number | string | D;   // Shopify Brutto-Umsatz (fuer ROAS)
  productCosts: number | string | D;
  shippingCosts: number | string | D; // DHL-Pakete × DHL-Preis
  paymentFeeRatePercent: number | string | D; // z.B. 3.0
  metaAds: number | string | D;
  googleAds: number | string | D;
  influencer: number | string | D;
}

/**
 * §27 Webshop Profit:
 *   Shopify Netto
 *   − Payment Fees (auf Netto-Umsatz gerechnet, User-Entscheidung)
 *   − Produktkosten
 *   − DHL Versand
 *   − Meta Ads
 *   − Google Ads
 *   − Influencer
 *
 * §29: ROAS beruecksichtigt NUR Meta + Google (nicht Influencer, nicht Payment).
 */
export function webshopProfit(input: WebshopProfitInput): ChannelProfitResult {
  const net = toD(input.netSales);
  const gross = toD(input.grossSales);
  const productCosts = toD(input.productCosts);
  const shipping = toD(input.shippingCosts);
  const feeRate = toD(input.paymentFeeRatePercent);
  const meta = toD(input.metaAds);
  const google = toD(input.googleAds);
  const inf = toD(input.influencer);

  const paymentFees = net.times(feeRate).div(HUNDRED);
  const totalCostsWithoutAds = productCosts.plus(shipping).plus(paymentFees);
  const adsExclInfluencer = meta.plus(google);
  const adsAttributed = adsExclInfluencer.plus(inf);
  const profit = net.minus(totalCostsWithoutAds).minus(adsAttributed);

  return {
    netSales: net,
    productCosts,
    shippingCosts: shipping,
    platformFees: paymentFees,
    totalCostsWithoutAds,
    adsAttributed,
    profit,
    margin: margin(profit, net),
    roasGross: roas(gross, adsExclInfluencer),
    roasNet: roas(net, adsExclInfluencer),
  };
}

// -----------------------------------------------------------------------------
// Amazon (§30)
// -----------------------------------------------------------------------------

export interface AmazonProfitInput {
  netSales: number | string | D;
  grossSales: number | string | D;
  productCosts: number | string | D;
  fulfillmentCosts: number | string | D;    // Stueckzahl × produkt-spezifische Amazon-Fulfillment-Kosten
  feeRatePercent: number | string | D;      // Amazon Plattformgebuehr, z.B. 15.0
  amazonPpc: number | string | D;
}

/**
 * §30 Amazon Profit:
 *   Amazon Netto
 *   − Produktkosten
 *   − Fulfillment (Stueckzahl × Amazon-Fulfillment-Pauschale)
 *   − Amazon-Gebuehr (auf Netto gerechnet)
 *   − Amazon PPC
 */
export function amazonProfit(input: AmazonProfitInput): ChannelProfitResult {
  const net = toD(input.netSales);
  const gross = toD(input.grossSales);
  const productCosts = toD(input.productCosts);
  const fulfillment = toD(input.fulfillmentCosts);
  const feeRate = toD(input.feeRatePercent);
  const ppc = toD(input.amazonPpc);

  const platformFees = net.times(feeRate).div(HUNDRED);
  const totalCostsWithoutAds = productCosts.plus(fulfillment).plus(platformFees);
  const profit = net.minus(totalCostsWithoutAds).minus(ppc);

  return {
    netSales: net,
    productCosts,
    shippingCosts: fulfillment,
    platformFees,
    totalCostsWithoutAds,
    adsAttributed: ppc,
    profit,
    margin: margin(profit, net),
    roasGross: roas(gross, ppc),
    roasNet: roas(net, ppc),
  };
}

// -----------------------------------------------------------------------------
// TikTok Shop (§33)
// -----------------------------------------------------------------------------

export interface TiktokProfitInput {
  netSales: number | string | D;
  grossSales: number | string | D;
  productCosts: number | string | D;
  shippingCosts: number | string | D;     // TikTok-Pakete × DHL-Preis
  feeRatePercent: number | string | D;    // TikTok Plattformgebuehr, z.B. 10.0
  tiktokAds: number | string | D;
}

export function tiktokProfit(input: TiktokProfitInput): ChannelProfitResult {
  const net = toD(input.netSales);
  const gross = toD(input.grossSales);
  const productCosts = toD(input.productCosts);
  const shipping = toD(input.shippingCosts);
  const feeRate = toD(input.feeRatePercent);
  const ads = toD(input.tiktokAds);

  const platformFees = net.times(feeRate).div(HUNDRED);
  const totalCostsWithoutAds = productCosts.plus(shipping).plus(platformFees);
  const profit = net.minus(totalCostsWithoutAds).minus(ads);

  return {
    netSales: net,
    productCosts,
    shippingCosts: shipping,
    platformFees,
    totalCostsWithoutAds,
    adsAttributed: ads,
    profit,
    margin: margin(profit, net),
    roasGross: roas(gross, ads),
    roasNet: roas(net, ads),
  };
}

// -----------------------------------------------------------------------------
// Tages-Aggregat (§36, §37) — ohne Grosshandel, ohne Gemeinkosten
// -----------------------------------------------------------------------------

export interface DayAggregateInput {
  webshop: ChannelProfitResult;
  amazon: ChannelProfitResult;
  tiktok: ChannelProfitResult;
}

export interface DayAggregateResult {
  totalNetSales: D;
  totalProfit: D;                // Master-Prompt §36 Tagesgewinn
  totalMargin: D | null;         // Master-Prompt §37 Gesamtmarge vor Gemeinkosten
}

export function aggregateDay(input: DayAggregateInput): DayAggregateResult {
  const totalNetSales = input.webshop.netSales
    .plus(input.amazon.netSales)
    .plus(input.tiktok.netSales);
  const totalProfit = input.webshop.profit
    .plus(input.amazon.profit)
    .plus(input.tiktok.profit);
  return {
    totalNetSales,
    totalProfit,
    totalMargin: margin(totalProfit, totalNetSales),
  };
}

/** Runden aller Beträge auf 2 Nachkommastellen für Api-Response. */
export function roundChannelProfit(r: ChannelProfitResult): ChannelProfitResult {
  return {
    netSales: round2(r.netSales),
    productCosts: round2(r.productCosts),
    shippingCosts: round2(r.shippingCosts),
    platformFees: round2(r.platformFees),
    totalCostsWithoutAds: round2(r.totalCostsWithoutAds),
    adsAttributed: round2(r.adsAttributed),
    profit: round2(r.profit),
    margin: r.margin,
    roasGross: r.roasGross,
    roasNet: r.roasNet,
  };
}
