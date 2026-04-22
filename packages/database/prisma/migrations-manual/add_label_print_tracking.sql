-- Track which labels have been printed.
-- printed_at: timestamp of first print (NULL = not yet printed → shows in "Erstellt" tab)
-- print_count: incremented on every (re-)print for audit/recovery purposes

ALTER TABLE order_shipment_labels
  ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS print_count INT NOT NULL DEFAULT 0;
