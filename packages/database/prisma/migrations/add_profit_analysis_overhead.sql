-- Gewinnanalyse Phase 7: Gemeinkosten (Overhead)
--
-- pa_overhead_template  — wiederkehrende Kosten-Vorlagen (Miete, Software etc.)
-- pa_overhead_entry     — konkrete Kosten pro Monat mit brutto/netto-Kennzeichen
--
-- Rein additive Migration.

CREATE TABLE IF NOT EXISTS pa_overhead_template (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category   varchar(60) NOT NULL,
  label      varchar(255) NOT NULL,
  amount     decimal(12, 2) NOT NULL CHECK (amount >= 0),
  is_gross   boolean NOT NULL DEFAULT true,
  vat_rate   decimal(5, 2) NOT NULL DEFAULT 19 CHECK (vat_rate >= 0),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_oht_org ON pa_overhead_template(org_id, active);

CREATE TABLE IF NOT EXISTS pa_overhead_entry (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month_id       uuid NOT NULL REFERENCES pa_month(id)      ON DELETE CASCADE,
  category       varchar(60) NOT NULL,
  label          varchar(255) NOT NULL,
  entered_amount decimal(12, 2) NOT NULL CHECK (entered_amount >= 0),
  is_gross       boolean NOT NULL DEFAULT true,
  vat_rate       decimal(5, 2) NOT NULL DEFAULT 19 CHECK (vat_rate >= 0),
  note           varchar(500),
  template_id    uuid REFERENCES pa_overhead_template(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pa_oe_month ON pa_overhead_entry(month_id);
CREATE INDEX IF NOT EXISTS idx_pa_oe_org   ON pa_overhead_entry(org_id, month_id);
