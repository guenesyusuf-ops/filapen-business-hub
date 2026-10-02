-- Meta Ads — Long-Term Creative Review (additiv, idempotent)
-- Aggregierter historischer Meta-Export. STRIKT getrennt von Tageswerten:
-- ma_ad_daily_metric wird NICHT verändert und NICHT befüllt.

CREATE TABLE IF NOT EXISTS ma_long_term_review (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_group_id          uuid REFERENCES ma_product_group(id) ON DELETE SET NULL,
  period_start              date,
  period_end                date,
  source_filename           varchar(300),
  source_type               varchar(20),
  provider                  varchar(20),
  model                     varchar(60),
  status                    varchar(20) NOT NULL DEFAULT 'ok',
  confidence                varchar(10),
  error                     text,
  facts                     jsonb NOT NULL,
  result                    jsonb,
  reasoning_effort          varchar(10),
  prompt_version            varchar(20),
  strategy_version          varchar(20),
  input_tokens              integer,
  output_tokens             integer,
  reasoning_tokens          integer,
  latency_ms                integer,
  retry_count               integer,
  ad_count                  integer,
  created_by_id             uuid,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ma_ltr_org ON ma_long_term_review (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_ltr_org_group ON ma_long_term_review (org_id, product_group_id);

CREATE TABLE IF NOT EXISTS ma_long_term_ad_snapshot (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id            uuid NOT NULL REFERENCES ma_long_term_review(id) ON DELETE CASCADE,
  org_id               uuid NOT NULL,
  meta_ad_id           varchar(255),
  ad_name              varchar(500) NOT NULL,
  matched_ad_id        uuid REFERENCES ma_ad(id) ON DELETE SET NULL,
  spend                numeric(14,2),
  impressions          integer,
  reach                integer,
  hook_rate            numeric(7,3),
  hold_rate            numeric(7,3),
  purchases            integer,
  website_purchases    integer,
  meta_roas            numeric(10,3),
  outbound_ctr         numeric(7,3),
  ctr_all              numeric(7,3),
  cpc_all              numeric(10,3),
  conversion_value     numeric(14,2),
  cost_per_purchase    numeric(10,2),
  avg_watch_time       numeric(10,3),
  thruplays            integer,
  views_3s             integer,
  views_25             integer,
  views_50             integer,
  views_75             integer,
  views_95             integer,
  views_100            integer,
  video_length_seconds integer,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ma_lts_review ON ma_long_term_ad_snapshot (review_id);
