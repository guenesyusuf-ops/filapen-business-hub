-- Gewinnanalyse Phase 3: Tages-Rohdaten
--
-- Fuenf Tabellen fuer die eigentlichen Tages-Eingaben:
--   pa_day                    — ein Container pro Tag (verweist auf pa_month)
--   pa_channel_sales          — Umsatz pro Kanal (shopify|amazon|tiktok)
--                                gross19 / gross7 / returns19 / returns7
--   pa_daily_ads              — Werbekosten (netto!) pro Tag
--   pa_daily_shipping         — Anzahl Pakete Shopify + TikTok
--   pa_daily_product_sale     — Stueckzahlen pro Kanal + Produkt
--
-- Netto-Umsatz + USt werden NICHT gespeichert — sie werden serverseitig
-- aus gross19/gross7/returns berechnet (Single Source of Truth).
--
-- Rein additive Migration. Rollback = alle 5 Tabellen + Enum droppen.

-- ---------------------------------------------------------------------------
-- Enum fuer die drei Verkaufskanaele
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_channel') THEN
    CREATE TYPE pa_channel AS ENUM ('shopify', 'amazon', 'tiktok');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- pa_day — Tages-Container
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_day (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month_id   uuid NOT NULL REFERENCES pa_month(id)      ON DELETE CASCADE,
  date       date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, date)
);
CREATE INDEX IF NOT EXISTS idx_pa_day_month ON pa_day(month_id);
CREATE INDEX IF NOT EXISTS idx_pa_day_org_date ON pa_day(org_id, date);

-- ---------------------------------------------------------------------------
-- pa_channel_sales — Umsatz pro Kanal
-- Brutto in zwei USt-Toepfen (19% + 7%) + Retouren in zwei USt-Toepfen.
-- Netto/USt werden serverseitig berechnet.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_channel_sales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_id     uuid NOT NULL REFERENCES pa_day(id)         ON DELETE CASCADE,
  channel    pa_channel NOT NULL,
  gross19    decimal(12, 2) NOT NULL DEFAULT 0 CHECK (gross19    >= 0),
  gross7     decimal(12, 2) NOT NULL DEFAULT 0 CHECK (gross7     >= 0),
  returns19  decimal(12, 2) NOT NULL DEFAULT 0 CHECK (returns19  >= 0),
  returns7   decimal(12, 2) NOT NULL DEFAULT 0 CHECK (returns7   >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (day_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_pa_channel_sales_day ON pa_channel_sales(day_id);
CREATE INDEX IF NOT EXISTS idx_pa_channel_sales_org ON pa_channel_sales(org_id);

-- ---------------------------------------------------------------------------
-- pa_daily_ads — Werbekosten (NETTO, User-Entscheidung: Meta/Google/TikTok/
-- Amazon PPC / Influencer sind immer netto durch Reverse-Charge).
-- Ein Datensatz pro Tag.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_daily_ads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_id      uuid UNIQUE NOT NULL REFERENCES pa_day(id) ON DELETE CASCADE,
  meta        decimal(12, 2) NOT NULL DEFAULT 0 CHECK (meta        >= 0),
  google      decimal(12, 2) NOT NULL DEFAULT 0 CHECK (google      >= 0),
  influencer  decimal(12, 2) NOT NULL DEFAULT 0 CHECK (influencer  >= 0),
  amazon_ppc  decimal(12, 2) NOT NULL DEFAULT 0 CHECK (amazon_ppc  >= 0),
  tiktok_ads  decimal(12, 2) NOT NULL DEFAULT 0 CHECK (tiktok_ads  >= 0),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_daily_ads_org ON pa_daily_ads(org_id);

-- ---------------------------------------------------------------------------
-- pa_daily_shipping — Pakete-Zaehler. DHL-Preis kommt live aus
-- pa_setting_history (nicht hier gespeichert, damit historische Rechnungen
-- konsistent bleiben wenn der Preis geaendert wird).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_daily_shipping (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_id            uuid UNIQUE NOT NULL REFERENCES pa_day(id) ON DELETE CASCADE,
  shopify_packages  int NOT NULL DEFAULT 0 CHECK (shopify_packages >= 0),
  tiktok_packages   int NOT NULL DEFAULT 0 CHECK (tiktok_packages  >= 0),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_daily_shipping_org ON pa_daily_shipping(org_id);

-- ---------------------------------------------------------------------------
-- pa_daily_product_sale — Stueckzahlen je Kanal + Produkt.
-- Produktkosten + Amazon-Fulfillment werden ueber pa_product_cost /
-- pa_amazon_fulfillment_cost historisch geloest — NICHT hier eingefroren.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_daily_product_sale (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_id     uuid NOT NULL REFERENCES pa_day(id)         ON DELETE CASCADE,
  channel    pa_channel NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id)       ON DELETE RESTRICT,
  quantity   int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE (day_id, channel, product_id)
);
CREATE INDEX IF NOT EXISTS idx_pa_dps_day     ON pa_daily_product_sale(day_id);
CREATE INDEX IF NOT EXISTS idx_pa_dps_org     ON pa_daily_product_sale(org_id);
CREATE INDEX IF NOT EXISTS idx_pa_dps_product ON pa_daily_product_sale(product_id);
