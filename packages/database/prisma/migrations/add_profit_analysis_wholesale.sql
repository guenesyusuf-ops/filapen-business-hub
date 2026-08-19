-- Gewinnanalyse Phase 6: Grosshandel
--
-- Auftragsliste mit Positionen. Bruttoeingabe pro Position + USt-Satz.
-- Produktkosten werden beim Anlegen einer Position als Snapshot eingefroren,
-- damit spaetere Aenderungen der historischen Produktkosten den Auftrag
-- nicht rueckwirkend veraendern.
--
-- Rein additive Migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_wholesale_status') THEN
    CREATE TYPE pa_wholesale_status AS ENUM ('draft', 'confirmed', 'shipped', 'invoiced', 'paid', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pa_wholesale_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_date    date NOT NULL,
  order_number  varchar(80),
  customer_name varchar(255),
  status        pa_wholesale_status NOT NULL DEFAULT 'draft',
  note          text,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_wh_order_org_date ON pa_wholesale_order(org_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_pa_wh_order_status  ON pa_wholesale_order(org_id, status);

CREATE TABLE IF NOT EXISTS pa_wholesale_order_item (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES pa_wholesale_order(id) ON DELETE CASCADE,
  product_id             uuid NOT NULL REFERENCES products(id)           ON DELETE RESTRICT,
  quantity               int NOT NULL CHECK (quantity > 0),
  unit_price_gross       decimal(12, 4) NOT NULL CHECK (unit_price_gross >= 0),
  vat_rate               decimal(5, 2)  NOT NULL DEFAULT 19 CHECK (vat_rate >= 0),
  product_cost_snapshot  decimal(12, 4) NOT NULL DEFAULT 0 CHECK (product_cost_snapshot >= 0),
  created_at             timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_wh_item_order   ON pa_wholesale_order_item(order_id);
CREATE INDEX IF NOT EXISTS idx_pa_wh_item_product ON pa_wholesale_order_item(product_id);
