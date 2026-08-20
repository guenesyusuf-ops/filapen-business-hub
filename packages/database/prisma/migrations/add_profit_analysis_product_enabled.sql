-- Gewinnanalyse — Produkt-Kill-Switch
--
-- Zusaetzliches enabled-Feld auf pa_product_settings damit Produkte die
-- NIRGENDWO verkauft werden komplett aus der Produktkosten-Verwaltung UND
-- aus allen Tages-Editoren ausgeblendet werden koennen.
--
-- Standard: enabled = true (backward-compat, alle bestehenden Produkte
-- bleiben sichtbar).

ALTER TABLE pa_product_settings
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_pa_product_settings_enabled ON pa_product_settings(org_id, enabled);
