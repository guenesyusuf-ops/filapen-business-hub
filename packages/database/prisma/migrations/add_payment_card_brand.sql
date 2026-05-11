-- Add card_brand to payments — fuer Auswahl Visa/Amex/Mastercard etc.
-- bei Zahlungsart "credit_card". Optional, NULL fuer alle anderen Methoden.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_brand varchar(20);
