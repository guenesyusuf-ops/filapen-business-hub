-- Erstattungen: Netto, Steuer und Shopifys Erstattungsdatum
--
-- Hintergrund
-- -----------
-- Die Shopify-Auswertung zeigte einen zu hohen Umsatz, weil Erstattungen
-- nirgends erfasst waren: refunds hatte 0 Zeilen und orders.total_refunded
-- war bei ALLEN Bestellungen 0, obwohl 248 Bestellungen den Status
-- refunded/partially_refunded trugen. Der einzige Schreiber war der
-- refunds/create-Webhook, der offenbar nie zugestellt hat.
--
-- Diese drei Spalten sind noetig, um die Zahlen genau wie Shopify zu zeigen:
--
--   net_amount    Shopifys Zeile "Verkaufsstornierungen" ist der Netto-Betrag
--                 der Erstattung, OHNE Steuer. amount bleibt der Brutto-Betrag
--                 aus den Erstattungs-Transaktionen. Beide getrennt zu halten
--                 ist notwendig, weil Shopify den Nettobetrag vom Umsatz und
--                 die Steuer separat von der Steuerzeile abzieht.
--
--   tax_amount    Der Steueranteil der Erstattung. Ohne ihn bleibt die
--                 Steuerzeile zu hoch — nachgemessen 458,88 statt 438,44 fuer
--                 den 18.09.2026.
--
--   processed_at  Shopifys Zeitpunkt der Erstattung. Shopify datiert eine
--                 Erstattung auf den Tag, an dem sie ausgefuehrt wurde, nicht
--                 auf den Tag der Bestellung. Bewusst NULLABLE und OHNE
--                 Standardwert: created_at traegt DEFAULT now() und wuerde bei
--                 einem vergessenen Wert still den Einfuegezeitpunkt liefern —
--                 ein falsches Datum, das niemandem auffaellt. NULL faellt auf.
--
-- Die Tabelle ist leer, die Aenderung ist rein additiv.

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS net_amount   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Die Auswertung filtert Erstattungen nach Zeitraum je Organisation.
CREATE INDEX IF NOT EXISTS idx_refunds_org_processed_at
  ON refunds (org_id, processed_at);
