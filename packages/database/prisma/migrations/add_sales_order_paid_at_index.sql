-- Composite-Index fuer Archive/Paid-Tab-Filter (where { orgId, paidAt ... })
CREATE INDEX IF NOT EXISTS "sales_orders_org_id_paid_at_idx"
  ON sales_orders (org_id, paid_at);
