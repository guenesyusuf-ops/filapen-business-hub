-- Gewinnanalyse — Produkt-Kanal-Zuordnung
--
-- Pro Produkt kann festgelegt werden, auf welchen Kanaelen (shopify|amazon|
-- tiktok) es tatsaechlich verkauft wird. Im Tages-Editor werden dann nur
-- diese Produkte im jeweiligen Kanal-Tab angezeigt.
--
-- Legacy-Fallback: Ein Produkt OHNE irgendeine Zuordnung gilt als "ueberall
-- aktiv" (backward-compatible). Sobald mindestens ein Kanal fuer das Produkt
-- eingetragen ist, gilt strikt "nur dort".
--
-- Rein additive Migration.

CREATE TABLE IF NOT EXISTS pa_product_channel (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  channel    pa_channel NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_pa_pc_org_channel ON pa_product_channel(org_id, channel);
CREATE INDEX IF NOT EXISTS idx_pa_pc_product     ON pa_product_channel(product_id);
