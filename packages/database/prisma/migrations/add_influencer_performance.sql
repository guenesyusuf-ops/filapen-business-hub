-- Influencer Performance Tracking — eine Haupt-Tabelle pro Influencer×Kampagne×Post.
-- Computed-Felder (ROAS, ROI, profit, CPA, CPM, conversion rate, AOV, profit margin)
-- werden im Backend on-read berechnet (kein generated columns weil Prisma das nicht
-- sauber abbildet und wir die Berechnung sowieso fuer Filter/Aggregations brauchen).

CREATE TABLE IF NOT EXISTS influencer_performance_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Optional Verknuepfung zur Discovery-Datenbank
  influencer_profile_id    UUID,

  -- BASIC (denormalisiert, damit Eintrag auch ohne Profile-Match funktioniert)
  influencer_name          VARCHAR(255) NOT NULL,
  platform                 VARCHAR(50)  NOT NULL,
  category                 VARCHAR(120),
  manager_contact          VARCHAR(255),
  profile_url              TEXT,
  follower_count           INTEGER,
  engagement_rate          NUMERIC(7, 3),
  story_views              INTEGER,
  avg_views                INTEGER,
  country                  VARCHAR(80),
  language                 VARCHAR(50),

  -- KAMPAGNE
  campaign_name            VARCHAR(255),
  posted_at                TIMESTAMPTZ,
  story_at                 TIMESTAMPTZ,
  product_name             VARCHAR(255),
  discount_code            VARCHAR(80),
  discount_pct             NUMERIC(5, 2),
  landing_page_url         TEXT,
  affiliate_link           TEXT,
  -- 'planned' | 'contacted' | 'negotiating' | 'booked' | 'posted' | 'completed' | 'cancelled' | 'blacklisted'
  status                   VARCHAR(30) NOT NULL DEFAULT 'planned',

  -- KOSTEN (input)
  influencer_fee           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  product_cost             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_cost            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cogs                     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  extra_cost               NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- PERFORMANCE (input)
  revenue                  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  orders                   INTEGER NOT NULL DEFAULT 0,
  clicks                   INTEGER NOT NULL DEFAULT 0,
  views                    INTEGER NOT NULL DEFAULT 0,
  -- profit_margin manuell setzbar (default leer → wird aus revenue/cogs berechnet)
  profit_margin_override   NUMERIC(5, 2),

  -- TRACKING
  tracking_link            TEXT,
  utm_source               VARCHAR(120),
  utm_campaign             VARCHAR(120),
  -- 'pending' | 'confirmed' | 'partial' | 'failed'
  tracking_status          VARCHAR(30),
  attribution_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,

  -- CONTENT-ANALYSE
  hook_worked              BOOLEAN,
  cta_quality              SMALLINT,        -- 1-5
  video_quality            SMALLINT,        -- 1-5
  branding_score           SMALLINT,        -- 1-5
  performance_rating       SMALLINT,        -- 1-5
  bookable                 BOOLEAN,

  -- NOTIZEN
  learnings                TEXT,
  what_worked              TEXT,
  what_didnt_work          TEXT,
  improvement_ideas        TEXT,

  -- FLAGS
  whitelist                BOOLEAN NOT NULL DEFAULT FALSE,
  blacklist                BOOLEAN NOT NULL DEFAULT FALSE,

  -- AUDIT
  created_by_id            UUID NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ipe_org_idx              ON influencer_performance_entries (org_id);
CREATE INDEX IF NOT EXISTS ipe_org_status_idx       ON influencer_performance_entries (org_id, status);
CREATE INDEX IF NOT EXISTS ipe_org_platform_idx     ON influencer_performance_entries (org_id, platform);
CREATE INDEX IF NOT EXISTS ipe_org_posted_idx       ON influencer_performance_entries (org_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS ipe_org_campaign_idx     ON influencer_performance_entries (org_id, campaign_name);
CREATE INDEX IF NOT EXISTS ipe_org_whitelist_idx    ON influencer_performance_entries (org_id, whitelist) WHERE whitelist = TRUE;
CREATE INDEX IF NOT EXISTS ipe_org_blacklist_idx    ON influencer_performance_entries (org_id, blacklist) WHERE blacklist = TRUE;
