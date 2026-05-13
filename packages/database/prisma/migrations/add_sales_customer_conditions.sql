-- B2B-Konditionen pro Kunde
-- 1) Konditions-Felder auf sales_customers erweitern
-- 2) Neue Tabelle fuer kundenspezifische Produkt-Preise

ALTER TABLE sales_customers
  ADD COLUMN IF NOT EXISTS min_order_quantity integer,
  ADD COLUMN IF NOT EXISTS min_order_value decimal(12,2),
  ADD COLUMN IF NOT EXISTS discount_percent decimal(5,2),
  ADD COLUMN IF NOT EXISTS shipping_terms varchar(255);

CREATE TABLE IF NOT EXISTS sales_customer_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES sales_customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  net_price decimal(12,4) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'EUR',
  min_quantity integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_scpp_product_or_variant CHECK (product_id IS NOT NULL OR product_variant_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_scpp_customer ON sales_customer_product_prices(customer_id);
CREATE INDEX IF NOT EXISTS idx_scpp_org_customer ON sales_customer_product_prices(org_id, customer_id);
