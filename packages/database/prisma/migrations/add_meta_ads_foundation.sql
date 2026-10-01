-- Meta Ads — Phase: Fundament (rein additiv)
--
-- Legt das Grunddatenmodell des Meta-Ads-Moduls an:
--   ma_angle            — Angles pro Organisation (frei erweiterbar)
--   ma_offer            — Offers pro Organisation (frei erweiterbar)
--   ma_ad               — Ad-Stammdaten (Produkt als zentrale Zuordnung, Meta Ad ID,
--                         Format, Hook-Text, Awareness, Offer, Status, Video-Länge,
--                         Lineage via parent_ad_id)
--   ma_ad_daily_metric  — ein Datensatz pro Ad + Datum (Meta- + Hyros-Rohwerte)
--
-- KEIN Anfassen bestehender Tabellen. KEIN DROP. Re-runnable (IF NOT EXISTS).
-- Rollback = die vier Tabellen + drei Enums droppen.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_format') THEN
    CREATE TYPE ma_format AS ENUM ('video', 'static', 'carousel', 'gif', 'ugc', 'vsl', 'image', 'collection');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_awareness') THEN
    CREATE TYPE ma_awareness AS ENUM ('unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_ad_status') THEN
    CREATE TYPE ma_ad_status AS ENUM ('draft', 'active', 'paused', 'ended', 'archived');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ma_angle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ma_angle (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_angle_org_name ON ma_angle (org_id, name);
CREATE INDEX IF NOT EXISTS idx_ma_angle_org ON ma_angle (org_id);

-- ---------------------------------------------------------------------------
-- ma_offer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ma_offer (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_offer_org_name ON ma_offer (org_id, name);
CREATE INDEX IF NOT EXISTS idx_ma_offer_org ON ma_offer (org_id);

-- ---------------------------------------------------------------------------
-- ma_ad
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ma_ad (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                 VARCHAR(300) NOT NULL,
  meta_ad_id           VARCHAR(255),
  start_date           DATE,
  format               ma_format NOT NULL DEFAULT 'video',
  angle_id             UUID REFERENCES ma_angle(id) ON DELETE SET NULL,
  hook_text            TEXT,
  awareness            ma_awareness,
  offer_id             UUID REFERENCES ma_offer(id) ON DELETE SET NULL,
  ad_link              TEXT,
  status               ma_ad_status NOT NULL DEFAULT 'draft',
  video_length_seconds INTEGER,
  parent_ad_id         UUID REFERENCES ma_ad(id) ON DELETE SET NULL,
  change_type          VARCHAR(120),
  notes                TEXT,
  created_by_id        UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- NULL-meta_ad_id erlaubt Mehrfach-NULL (Ads ohne Meta Ad ID); gesetzt = eindeutig pro Org.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_ad_org_meta_id ON ma_ad (org_id, meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_org ON ma_ad (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_org_product ON ma_ad (org_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_org_status ON ma_ad (org_id, status);
CREATE INDEX IF NOT EXISTS idx_ma_ad_meta_id ON ma_ad (meta_ad_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_org_start ON ma_ad (org_id, start_date);
CREATE INDEX IF NOT EXISTS idx_ma_ad_parent ON ma_ad (parent_ad_id);

-- ---------------------------------------------------------------------------
-- ma_ad_daily_metric  (ein Datensatz pro Ad + Datum)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ma_ad_daily_metric (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_id                      UUID NOT NULL REFERENCES ma_ad(id) ON DELETE CASCADE,
  date                       DATE NOT NULL,
  -- Meta — Delivery
  spend                      DECIMAL(12, 2),
  impressions                INTEGER,
  -- Meta — Attention / Retention
  hook_rate                  DECIMAL(8, 4),
  hold_rate                  DECIMAL(8, 4),
  video_views_3s             INTEGER,
  video_views_25             INTEGER,
  video_views_50             INTEGER,
  video_views_75             INTEGER,
  video_views_95             INTEGER,
  video_views_100            INTEGER,
  thruplays                  INTEGER,
  average_watch_time_seconds DECIMAL(10, 3),
  -- Meta — Traffic
  cpc_all                    DECIMAL(12, 4),
  ctr_all                    DECIMAL(8, 4),
  outbound_ctr               DECIMAL(8, 4),
  -- Hyros (führend)
  total_sales                INTEGER,
  unique_sales               INTEGER,
  hyros_roas                 DECIMAL(10, 4),
  revenue                    DECIMAL(12, 2),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_ad_daily_metric ON ma_ad_daily_metric (ad_id, date);
CREATE INDEX IF NOT EXISTS idx_ma_adm_org ON ma_ad_daily_metric (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_adm_org_date ON ma_ad_daily_metric (org_id, date);
CREATE INDEX IF NOT EXISTS idx_ma_adm_ad_date ON ma_ad_daily_metric (ad_id, date);
