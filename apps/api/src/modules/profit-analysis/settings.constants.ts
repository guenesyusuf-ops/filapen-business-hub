/**
 * Zentrale Definition aller Setting-Keys der Gewinnanalyse.
 *
 * WICHTIG: Die Keys sind Teil des DB-Schemas (pa_setting_history.key ist VARCHAR).
 * Umbenennen bricht historische Datensaetze — nur additiv erweitern.
 */

export const SETTING_KEYS = {
  // Verkaufsgebuehren — Prozentwerte auf Netto-Umsatz (§14-16 lt. User)
  PAYMENT_FEE_SHOPIFY: 'payment_fee_shopify',
  FEE_AMAZON: 'fee_amazon',
  FEE_TIKTOK: 'fee_tiktok',

  // Versand
  DHL_PRICE_PER_PACKAGE: 'dhl_price_per_package',

  // USt-Saetze (falls sich Gesetz aendert — 2020 gab es zeitweise 16/5%)
  VAT_STANDARD: 'vat_standard',
  VAT_REDUCED: 'vat_reduced',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/**
 * Sinnvolle Standardwerte, falls fuer die org noch nichts hinterlegt ist.
 * Werden vom Service beim ersten Lookup lazy in pa_setting_history geschrieben
 * mit effective_from = Anfang der Organisation (created_at der Org).
 */
export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  [SETTING_KEYS.PAYMENT_FEE_SHOPIFY]: '3.0',      // 3.0 % auf Netto
  [SETTING_KEYS.FEE_AMAZON]: '15.0',              // 15.0 % auf Netto
  [SETTING_KEYS.FEE_TIKTOK]: '10.0',              // 10.0 % auf Netto
  [SETTING_KEYS.DHL_PRICE_PER_PACKAGE]: '5.49',   // EUR pro Paket
  [SETTING_KEYS.VAT_STANDARD]: '19.0',            // 19 %
  [SETTING_KEYS.VAT_REDUCED]: '7.0',              // 7 %
};

/**
 * Menschenlesbare Metadaten fuer die UI. Wird von der Settings-Controller
 * zurueckgegeben, damit das Frontend Tooltips + Formeln + Erklaerungen
 * konsistent anzeigt.
 */
export interface SettingMeta {
  key: SettingKey;
  label: string;
  unit: 'percent' | 'eur';
  category: 'fees' | 'shipping' | 'vat';
  description: string;
  formula: string;
}

export const SETTING_META: SettingMeta[] = [
  {
    key: SETTING_KEYS.PAYMENT_FEE_SHOPIFY,
    label: 'Shopify Payment Fee',
    unit: 'percent',
    category: 'fees',
    description: 'Prozentsatz den Shopify Payments pro Transaktion einbehaelt.',
    formula: 'Payment Fee = Shopify Nettoumsatz × Prozentsatz',
  },
  {
    key: SETTING_KEYS.FEE_AMAZON,
    label: 'Amazon Plattformgebuehr',
    unit: 'percent',
    category: 'fees',
    description: 'Verkaufsgebuehr die Amazon pro Verkauf einbehaelt.',
    formula: 'Amazon Gebuehr = Amazon Nettoumsatz × Prozentsatz',
  },
  {
    key: SETTING_KEYS.FEE_TIKTOK,
    label: 'TikTok Plattformgebuehr',
    unit: 'percent',
    category: 'fees',
    description: 'Verkaufsgebuehr die TikTok Shop pro Verkauf einbehaelt.',
    formula: 'TikTok Gebuehr = TikTok Nettoumsatz × Prozentsatz',
  },
  {
    key: SETTING_KEYS.DHL_PRICE_PER_PACKAGE,
    label: 'DHL Versandkosten pro Paket',
    unit: 'eur',
    category: 'shipping',
    description: 'Pauschale die pro versendetem Paket (Shopify + TikTok Shop) anfaellt.',
    formula: 'Versandkosten = Anzahl Pakete × EUR pro Paket',
  },
  {
    key: SETTING_KEYS.VAT_STANDARD,
    label: 'USt-Satz Standard',
    unit: 'percent',
    category: 'vat',
    description: 'Regelsteuersatz fuer den Grossteil der Produkte.',
    formula: 'Netto = Brutto / (1 + Prozentsatz/100)',
  },
  {
    key: SETTING_KEYS.VAT_REDUCED,
    label: 'USt-Satz ermaessigt',
    unit: 'percent',
    category: 'vat',
    description: 'Ermaessigter Satz z.B. fuer Buecher.',
    formula: 'Netto = Brutto / (1 + Prozentsatz/100)',
  },
];
