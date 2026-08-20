-- Gewinnanalyse — Filapen Insights + Produkt-Steuersatz + erweiterte
-- Overhead-Kostenstruktur.
--
-- 3 additive Erweiterungen in einer Migration:
--
-- 1) pa_insight               Storage fuer erkannte Insight-Kandidaten
--                             mit Lifecycle + User-Feedback
-- 2) pa_product_settings      §41 Produkt-Steuersatz (19/7) unabhaengig vom Kanal
-- 3) pa_overhead_entry        §43 zusaetzliche Felder fuer tax_treatment
--                             (backward-compat, bestehende is_gross+vat_rate bleiben)
--
-- Rein additive Migration.

-- ---------------------------------------------------------------------------
-- pa_insight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_insight_severity') THEN
    CREATE TYPE pa_insight_severity AS ENUM ('info', 'positive', 'warning', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_insight_status') THEN
    CREATE TYPE pa_insight_status AS ENUM ('new', 'active', 'acknowledged', 'resolved', 'dismissed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_insight_feedback') THEN
    CREATE TYPE pa_insight_feedback AS ENUM ('helpful', 'not_helpful');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pa_insight (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Detection-Fingerprint: gleiche (type + channel + period_key) = gleiche Insight-Sorte
  -- fuer Deduplizierung + Lifecycle-Update (Status wechseln statt neu anlegen).
  insight_type        varchar(60)  NOT NULL,
  channel             varchar(20),                       -- webshop|amazon|tiktok|wholesale|total|NULL
  period_key          varchar(60)  NOT NULL,             -- z.B. "rolling-7d-2026-08-20" oder "month-2026-08"
  fingerprint         varchar(200) NOT NULL,             -- type + channel + period_key gehashed

  severity            pa_insight_severity NOT NULL,
  status              pa_insight_status   NOT NULL DEFAULT 'new',

  -- Deterministische Kennzahlen (Ebene A → B)
  metric              varchar(60),
  current_value       decimal(14, 4),
  comparison_value    decimal(14, 4),
  absolute_change     decimal(14, 4),
  percentage_change   decimal(10, 4),
  unit                varchar(20),                       -- EUR|percent|roas|count
  facts               jsonb,                             -- alle weiteren Zahlen strukturiert

  -- Deterministische Formulierung (funktioniert IMMER ohne KI, §33)
  title               varchar(200) NOT NULL,
  message             text         NOT NULL,

  -- KI-generierte Ueberformulierung (optional, wird nur befuellt wenn Ebene C laeuft)
  ai_title            varchar(200),
  ai_message          text,
  ai_generated_at     timestamptz,

  priority_score      int NOT NULL DEFAULT 0,
  period_from         date,
  period_to           date,

  detected_at         timestamptz NOT NULL DEFAULT NOW(),
  resolved_at         timestamptz,
  acknowledged_at     timestamptz,
  acknowledged_by_id  uuid REFERENCES users(id) ON DELETE SET NULL,

  feedback            pa_insight_feedback,
  feedback_at         timestamptz,
  feedback_by_id      uuid REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (org_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_pa_insight_org_status   ON pa_insight(org_id, status);
CREATE INDEX IF NOT EXISTS idx_pa_insight_org_severity ON pa_insight(org_id, severity);
CREATE INDEX IF NOT EXISTS idx_pa_insight_org_detected ON pa_insight(org_id, detected_at DESC);

-- ---------------------------------------------------------------------------
-- §41 pa_product_settings — Produkt-Steuersatz kanal-unabhaengig
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pa_product_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  vat_rate   decimal(5, 2) NOT NULL DEFAULT 19 CHECK (vat_rate IN (0, 7, 19)),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_product_settings_org ON pa_product_settings(org_id);

-- ---------------------------------------------------------------------------
-- §43 pa_overhead_entry — zusaetzliche Felder fuer erweiterte Kostenstruktur
--     Bestehende is_gross + vat_rate bleiben (backward-compat).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pa_tax_treatment') THEN
    CREATE TYPE pa_tax_treatment AS ENUM (
      'net_entered',           -- Betrag ist bereits Netto (kein Herausrechnen)
      'gross_with_tax',        -- Bruttobetrag mit konfigurierbarer Steuer (Standard)
      'no_deductible_tax',     -- Voller Betrag ist Kosten (z.B. Auslands-Ads, keine Vorsteuer)
      'manual_override'        -- Manuell gesetzter Controlling-Betrag
    );
  END IF;
END $$;

ALTER TABLE pa_overhead_entry
  ADD COLUMN IF NOT EXISTS tax_treatment              pa_tax_treatment,
  ADD COLUMN IF NOT EXISTS calculated_controlling_cost decimal(12, 2),
  ADD COLUMN IF NOT EXISTS calculated_tax_component   decimal(12, 2);
