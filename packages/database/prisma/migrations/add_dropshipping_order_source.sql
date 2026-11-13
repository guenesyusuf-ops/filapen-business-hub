-- Dropshipping: Herkunft einer ds_order markieren ('rule' = per Regel-Sync,
-- 'manual' = manuell per Bestellnummer importiert). Erlaubt das Aufraeumen
-- veralteter Regel-Treffer, ohne manuelle Importe zu verlieren.
ALTER TABLE ds_orders ADD COLUMN IF NOT EXISTS source varchar(10) NOT NULL DEFAULT 'rule';
