-- Dropshipping Phase 1.5: Regeln (Einzel-SKU oder Kombination) + Bilder
--
-- Rein additiv: neue Tabellen ds_rules/ds_rule_skus + neue Spalte
-- ds_order_items.image_url. Loest die simple SKU-An/Aus-Logik aus Phase 1 ab.
--
-- Regel-Modus:
--   'subset' = Bestellung passt, wenn ALLE ihre Produkte aus der SKU-Menge
--              stammen (kein fremdes Produkt).
--   'exact'  = Bestellung passt nur bei exakt dieser SKU-Menge.

CREATE TABLE IF NOT EXISTS ds_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  name       varchar(200) NOT NULL DEFAULT '',
  mode       varchar(10) NOT NULL DEFAULT 'subset',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ds_rules_org ON ds_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_ds_rules_org_active ON ds_rules(org_id, active);

CREATE TABLE IF NOT EXISTS ds_rule_skus (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  rule_id             uuid NOT NULL REFERENCES ds_rules(id) ON DELETE CASCADE,
  sku                 varchar(255) NOT NULL,
  title               varchar(500),
  image_url           text,
  variant_external_id varchar(255)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_rule_sku ON ds_rule_skus(rule_id, sku);
CREATE INDEX IF NOT EXISTS idx_ds_rule_skus_org ON ds_rule_skus(org_id);
CREATE INDEX IF NOT EXISTS idx_ds_rule_skus_rule ON ds_rule_skus(rule_id);

ALTER TABLE ds_order_items ADD COLUMN IF NOT EXISTS image_url text;
