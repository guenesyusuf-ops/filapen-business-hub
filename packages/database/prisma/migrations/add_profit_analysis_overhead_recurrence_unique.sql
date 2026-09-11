-- Eine Wiederkehr-Kopie pro (Zielmonat, Origin).
--
-- materializeRecurrencesIfNeeded prueft vorhandene Kopien per findFirst und
-- legt sie danach per createMany an. Zwischen Pruefung und Schreiben liegen
-- mehrere Roundtrips ohne Transaktion — zwei parallele Aufrufe (zwei Tabs,
-- zwei Mitarbeiter, ein wiederholter Request) sehen beide "noch nicht
-- vorhanden" und legen beide an. Die Gemeinkosten des Monats verdoppeln sich
-- dabei unbemerkt; auffaellig nur bei zeilenweiser Pruefung der Tabelle.
--
-- Partieller Index: normale Eintraege haben source_entry_id IS NULL und
-- bleiben unberuehrt. In Postgres sind mehrere NULL-Werte in einem Unique-
-- Index ohnehin erlaubt, die WHERE-Klausel macht die Absicht explizit und
-- haelt den Index klein.

CREATE UNIQUE INDEX IF NOT EXISTS uq_pa_oe_month_source
  ON pa_overhead_entry (month_id, source_entry_id)
  WHERE source_entry_id IS NOT NULL;
