-- Meta Ads — Phase: Import (rein additiv)
--
-- Legt die Import-Protokolltabelle an. KEIN Anfassen bestehender Tabellen,
-- KEIN DROP, re-runnable (IF NOT EXISTS). Rollback = Tabelle + 2 Enums droppen.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_import_type') THEN
    CREATE TYPE ma_import_type AS ENUM ('meta', 'hyros');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_import_status') THEN
    CREATE TYPE ma_import_status AS ENUM ('completed', 'partial', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ma_data_import (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type           ma_import_type NOT NULL,
  filename       VARCHAR(400) NOT NULL,
  uploaded_by_id UUID,
  row_count      INTEGER NOT NULL DEFAULT 0,
  success_count  INTEGER NOT NULL DEFAULT 0,
  error_count    INTEGER NOT NULL DEFAULT 0,
  skipped_count  INTEGER NOT NULL DEFAULT 0,
  updated_count  INTEGER NOT NULL DEFAULT 0,
  status         ma_import_status NOT NULL,
  mapping_config JSONB,
  error_summary  JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ma_import_org_created ON ma_data_import (org_id, created_at DESC);
