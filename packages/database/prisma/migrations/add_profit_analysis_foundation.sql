-- Gewinnanalyse-Modul — Phase 1: Fundament (rein additiv)
--
-- Legt drei Tabellen an, die das gesamte Modul tragen:
--   pa_month           — Monats-Container (open|closed|locked), pro Organisation
--   pa_setting_history — historisierte Einstellungen (Gebuehren, DHL-Preis, USt-Saetze)
--                        Wird immer via "gueltig am Datum X" abgefragt, damit alte
--                        Monate bei spaeteren Aenderungen unveraendert bleiben.
--   pa_target          — Zielwerte (Marge, ROAS, Umsatz, Gewinn) org-global oder pro Monat
--
-- KEIN Anfassen bestehender Tabellen. KEIN DROP. Rollback = alle drei Tabellen droppen.

-- ---------------------------------------------------------------------------
-- Enum fuer Monats-Status. IF NOT EXISTS, damit die Migration re-runnable ist.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_month_status') THEN
    CREATE TYPE pa_month_status AS ENUM ('open', 'closed', 'locked');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- pa_month — ein Datensatz je (org, Jahr, Monat).
-- Wird lazy erstellt (getOrCreate), damit Tage/Umsaetze nicht "ins Leere" haengen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_month (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year         int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month        int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status       pa_month_status NOT NULL DEFAULT 'open',
  closed_at    timestamptz,
  closed_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_pa_month_org ON pa_month(org_id);
CREATE INDEX IF NOT EXISTS idx_pa_month_status ON pa_month(org_id, status);

-- ---------------------------------------------------------------------------
-- pa_setting_history — historisierte Einstellungen mit "gueltig ab/bis".
-- effective_to = NULL bedeutet "aktuell gueltige Periode, nicht abgeschlossen".
-- Beim Setzen einer neuen Periode wird die Vorgaenger-Periode automatisch
-- durch den Service abgeschlossen (effective_to := neues effective_from - 1 Tag).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_setting_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key            varchar(60) NOT NULL,
  value          decimal(12, 4) NOT NULL,
  effective_from date NOT NULL,
  effective_to   date,
  note           varchar(500),
  created_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, key, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
-- Schneller Lookup "welche Wert galt am Datum X":
--   ORDER BY effective_from DESC LIMIT 1 WHERE effective_from <= X
CREATE INDEX IF NOT EXISTS idx_pa_settings_lookup
  ON pa_setting_history(org_id, key, effective_from DESC);

-- ---------------------------------------------------------------------------
-- pa_target — Zielwerte. Nicht historisiert (bewusst): das ist ein Ziel, kein
-- Rechenwert. Ziele koennen jederzeit geaendert werden. Historische Berechnungen
-- werden nie mit Zielen verglichen die zum Berechnungszeitpunkt nicht galten.
--
-- year/month sind NULLABLE. NULL = org-globaler Default fuer alle Monate.
-- Ein spezifischer Monat kann seinen eigenen Wert ueberschreiben.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_target (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key        varchar(60) NOT NULL,
  value      decimal(12, 4) NOT NULL,
  year       int,
  month      int CHECK (month IS NULL OR month BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
-- Eindeutig: pro (org, key, year, month) genau eine Zeile. COALESCE macht
-- NULL-year/NULL-month zu 0 damit UNIQUE greift.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_target_unique
  ON pa_target(org_id, key, COALESCE(year, 0), COALESCE(month, 0));
CREATE INDEX IF NOT EXISTS idx_pa_target_org_key ON pa_target(org_id, key);
