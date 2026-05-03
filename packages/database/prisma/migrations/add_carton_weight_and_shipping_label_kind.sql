-- Variante A (ohne Aufschlag): optional Override-Gewicht pro Karton.
-- Wenn null → System rechnet weight_g × VKE.
ALTER TABLE shipping_product_profiles
  ADD COLUMN IF NOT EXISTS weight_per_carton_g INTEGER;

-- Neuer Doc-Kind fuer DHL-Versandlabels die aus einer Sales-Bestellung
-- heraus erstellt werden.
ALTER TYPE sales_document_kind ADD VALUE IF NOT EXISTS 'shipping_label';
