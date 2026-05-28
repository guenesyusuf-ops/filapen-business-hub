CREATE TABLE IF NOT EXISTS profitability_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  product_name varchar(255) NOT NULL,
  purchase_price decimal(12,2) NOT NULL,
  shipping_cost decimal(12,2) NOT NULL DEFAULT 0,
  order_quantity integer NOT NULL DEFAULT 1,
  customs_rate decimal(5,2) NOT NULL DEFAULT 0,
  sales_price decimal(12,2) NOT NULL,
  vat_rate decimal(5,2) NOT NULL DEFAULT 19,
  shipping_to_customer decimal(12,2) NOT NULL DEFAULT 0,
  payment_rate decimal(5,2) NOT NULL DEFAULT 3,
  ad_cost decimal(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profit_org ON profitability_calculations(org_id);
CREATE INDEX IF NOT EXISTS idx_profit_org_updated ON profitability_calculations(org_id, updated_at DESC);
