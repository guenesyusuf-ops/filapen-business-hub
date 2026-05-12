-- Rechnungs- + Lieferadresse fuer Bestellungen (manuell hinterlegt beim Anlegen).
-- Beide Felder sind optional und free-form TEXT — Multi-Line erlaubt.
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS shipping_address text;
