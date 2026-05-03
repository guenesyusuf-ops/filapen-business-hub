-- Lieferschein-Support fuer Verkauf-Bestellungen.
-- 1) Neuer Enum-Wert delivery_note (Postgres muss ausserhalb Tx)
-- 2) Zwei neue Spalten auf sales_orders fuer easybill-Referenz + PDF-URL
ALTER TYPE sales_document_kind ADD VALUE IF NOT EXISTS 'delivery_note';

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS easybill_delivery_note_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS easybill_delivery_note_pdf_url TEXT;
