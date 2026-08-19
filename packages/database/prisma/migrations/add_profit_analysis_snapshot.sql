-- Gewinnanalyse Phase 10: Monats-Snapshot
--
-- Beim Abschliessen eines Monats wird das gesamte Berechnungs-Ergebnis
-- als JSONB eingefroren. Damit ist der Monatsbericht auch in 5 Jahren
-- byte-genau reproduzierbar, unabhaengig von spaeteren Kosten- oder
-- Settings-Aenderungen.

CREATE TABLE IF NOT EXISTS pa_month_snapshot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id      uuid NOT NULL UNIQUE REFERENCES pa_month(id) ON DELETE CASCADE,
  snapshot_json jsonb NOT NULL,
  computed_at   timestamptz NOT NULL DEFAULT NOW(),
  closed_by_id  uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pa_month_snapshot_time ON pa_month_snapshot(computed_at DESC);
