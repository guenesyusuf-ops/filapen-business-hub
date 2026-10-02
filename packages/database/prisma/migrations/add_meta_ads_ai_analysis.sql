-- Meta Ads — AI Creative Intelligence & Recommendations (Phase 6), rein additiv.
-- Keine Änderung an bestehenden Tabellen/Spalten, kein DROP. Re-runnable.
-- Speichert den deterministischen Facts-Snapshot + das AI-Ergebnis (Audit-Trail).

CREATE TABLE IF NOT EXISTS ma_ai_analysis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type        VARCHAR(20) NOT NULL,
  product_group_id  UUID REFERENCES ma_product_group(id) ON DELETE SET NULL,
  ad_id             UUID REFERENCES ma_ad(id) ON DELETE SET NULL,
  period_from       DATE,
  period_to         DATE,
  range_label       VARCHAR(40),
  provider          VARCHAR(20),
  model             VARCHAR(60),
  status            VARCHAR(20) NOT NULL DEFAULT 'ok',
  confidence        VARCHAR(10),
  facts             JSONB NOT NULL,
  result            JSONB,
  error             TEXT,
  created_by_id     UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ma_ai_analysis_org ON ma_ai_analysis (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_ai_analysis_org_scope ON ma_ai_analysis (org_id, scope_type);
CREATE INDEX IF NOT EXISTS idx_ma_ai_analysis_group ON ma_ai_analysis (product_group_id);
CREATE INDEX IF NOT EXISTS idx_ma_ai_analysis_ad ON ma_ai_analysis (ad_id);
