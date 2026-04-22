-- Add weight_g column to product_variants so the Shopify sync can populate it
-- and the shipping module can use it as a fallback before demanding a manual
-- ShippingProductProfile entry.
--
-- Idempotent (safe to re-run). Default 0 keeps existing rows valid; subsequent
-- Shopify re-sync (via "Aus Shopify nachladen") populates real values.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS weight_g INTEGER NOT NULL DEFAULT 0;
