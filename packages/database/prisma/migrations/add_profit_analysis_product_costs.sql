-- Gewinnanalyse Phase 2: Produktkosten + Amazon-Fulfillment (historisiert)
--
-- Zwei getrennte Tabellen weil die Preisdynamiken unabhaengig sind:
--   pa_product_cost              — Einkaufspreis / Herstellkosten pro Stueck
--   pa_amazon_fulfillment_cost   — AWD/FBA-Pauschale pro Stueck
--
-- Beide referenzieren die bestehende products.id — keine Duplizierung des
-- Shopify-Katalogs. Beide historisiert nach dem gleichen effective_from/to-
-- Muster wie pa_setting_history in Phase 1.
--
-- Rein additive Migration. Rollback = beide Tabellen droppen.

CREATE TABLE IF NOT EXISTS pa_product_cost (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cost           decimal(12, 4) NOT NULL CHECK (cost >= 0),
  effective_from date NOT NULL,
  effective_to   date,
  note           varchar(500),
  created_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_pa_product_cost_lookup
  ON pa_product_cost(org_id, product_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_pa_product_cost_org
  ON pa_product_cost(org_id);

CREATE TABLE IF NOT EXISTS pa_amazon_fulfillment_cost (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cost           decimal(12, 4) NOT NULL CHECK (cost >= 0),
  effective_from date NOT NULL,
  effective_to   date,
  note           varchar(500),
  created_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_pa_amazon_ff_lookup
  ON pa_amazon_fulfillment_cost(org_id, product_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_pa_amazon_ff_org
  ON pa_amazon_fulfillment_cost(org_id);
