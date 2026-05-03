-- Markiert wann die DHL-Labels + Lieferschein per Mail ans Lager
-- verschickt wurden. Frontend zeigt das als Hinweis im DHL-Panel.
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS labels_sent_to_warehouse_at TIMESTAMPTZ;
