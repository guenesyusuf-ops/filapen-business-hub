-- =============================================================================
-- Additive Migration: Email Marketing Module
-- 14 neue Tabellen + 7 Enums. Nichts Bestehendes wird angefasst.
-- =============================================================================

-- ENUMS ----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE marketing_consent AS ENUM ('never_subscribed','subscribed','confirmed','unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE suppression_reason AS ENUM ('unsubscribed','bounced_hard','bounced_soft','complained','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_message_status AS ENUM ('queued','sending','sent','delivered','failed','bounced','complained','suppressed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_campaign_status AS ENUM ('draft','scheduled','sending','sent','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flow_status AS ENUM ('draft','active','paused','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flow_step_type AS ENUM ('delay','condition','send_email','end');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE flow_trigger_type AS ENUM ('customer_created','order_placed','checkout_started','viewed_product','added_to_cart','segment_entered','custom_event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CONTACTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_contacts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shop_id                UUID REFERENCES shops(id) ON DELETE SET NULL,
  shopify_customer_id    VARCHAR(64),
  email                  VARCHAR(320) NOT NULL,
  first_name             VARCHAR(120),
  last_name              VARCHAR(120),
  phone                  VARCHAR(40),
  locale                 VARCHAR(10),
  country                VARCHAR(2),
  city                   VARCHAR(120),
  province               VARCHAR(120),
  zip                    VARCHAR(20),
  tags                   TEXT[] NOT NULL DEFAULT '{}',
  marketing_consent      marketing_consent NOT NULL DEFAULT 'never_subscribed',
  consented_at           TIMESTAMPTZ,
  doi_confirmed_at       TIMESTAMPTZ,
  unsubscribed_at        TIMESTAMPTZ,
  total_spent            DECIMAL(14,2) NOT NULL DEFAULT 0,
  orders_count           INTEGER NOT NULL DEFAULT 0,
  first_order_at         TIMESTAMPTZ,
  last_order_at          TIMESTAMPTZ,
  avg_order_value        DECIMAL(14,2) NOT NULL DEFAULT 0,
  last_seen_at           TIMESTAMPTZ,
  anonymous_id           VARCHAR(64),
  properties             JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contact_org_email UNIQUE (org_id, email)
);
CREATE INDEX IF NOT EXISTS mc_org_idx ON marketing_contacts(org_id);
CREATE INDEX IF NOT EXISTS mc_org_consent_idx ON marketing_contacts(org_id, marketing_consent);
CREATE INDEX IF NOT EXISTS mc_shopify_customer_idx ON marketing_contacts(shopify_customer_id);
CREATE INDEX IF NOT EXISTS mc_anon_idx ON marketing_contacts(anonymous_id);
CREATE INDEX IF NOT EXISTS mc_org_lastorder_idx ON marketing_contacts(org_id, last_order_at);
CREATE INDEX IF NOT EXISTS mc_org_totalspent_idx ON marketing_contacts(org_id, total_spent);

-- EVENTS ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES marketing_contacts(id) ON DELETE CASCADE,
  anonymous_id  VARCHAR(64),
  type          VARCHAR(60) NOT NULL,
  source        VARCHAR(30) NOT NULL DEFAULT 'shopify',
  payload       JSONB,
  external_id   VARCHAR(100),
  occurred_at   TIMESTAMPTZ NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_source_external UNIQUE (org_id, source, external_id)
);
CREATE INDEX IF NOT EXISTS me_org_contact_occ_idx ON marketing_events(org_id, contact_id, occurred_at);
CREATE INDEX IF NOT EXISTS me_org_type_occ_idx ON marketing_events(org_id, type, occurred_at);
CREATE INDEX IF NOT EXISTS me_org_occ_idx ON marketing_events(org_id, occurred_at);

-- SUPPRESSIONS ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_suppressions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      VARCHAR(320) NOT NULL,
  reason     suppression_reason NOT NULL,
  note       TEXT,
  source_id  VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suppress_org_email UNIQUE (org_id, email)
);
CREATE INDEX IF NOT EXISTS es_org_idx ON email_suppressions(org_id);

-- TEMPLATES ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  subject       VARCHAR(500) NOT NULL,
  preview_text  VARCHAR(500),
  blocks        JSONB NOT NULL,
  html_override TEXT,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS et_org_idx ON email_templates(org_id);

-- SEGMENTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS segments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  rules             JSONB NOT NULL,
  member_count      INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  created_by_id     UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS seg_org_idx ON segments(org_id);

-- CAMPAIGNS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                VARCHAR(200) NOT NULL,
  status              email_campaign_status NOT NULL DEFAULT 'draft',
  template_id         UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  segment_id          UUID REFERENCES segments(id) ON DELETE SET NULL,
  from_name           VARCHAR(200) NOT NULL,
  from_email          VARCHAR(320) NOT NULL,
  reply_to            VARCHAR(320),
  subject_snapshot    VARCHAR(500),
  consent_mode        VARCHAR(20) NOT NULL DEFAULT 'subscribed',
  scheduled_at        TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  recipients_count    INTEGER NOT NULL DEFAULT 0,
  sent_count          INTEGER NOT NULL DEFAULT 0,
  delivered_count     INTEGER NOT NULL DEFAULT 0,
  open_count          INTEGER NOT NULL DEFAULT 0,
  unique_open_count   INTEGER NOT NULL DEFAULT 0,
  click_count         INTEGER NOT NULL DEFAULT 0,
  unique_click_count  INTEGER NOT NULL DEFAULT 0,
  bounce_count        INTEGER NOT NULL DEFAULT 0,
  unsubscribe_count   INTEGER NOT NULL DEFAULT 0,
  revenue_attributed  DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by_id       UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ec_org_idx ON email_campaigns(org_id);
CREATE INDEX IF NOT EXISTS ec_org_status_idx ON email_campaigns(org_id, status);
CREATE INDEX IF NOT EXISTS ec_scheduled_idx ON email_campaigns(scheduled_at);

-- FLOWS ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flows (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  description        TEXT,
  status             flow_status NOT NULL DEFAULT 'draft',
  trigger_type       flow_trigger_type NOT NULL,
  trigger_config     JSONB,
  segment_id         UUID REFERENCES segments(id) ON DELETE SET NULL,
  reentry_days       INTEGER NOT NULL DEFAULT 30,
  consent_mode       VARCHAR(20) NOT NULL DEFAULT 'subscribed',
  enrolled_count     INTEGER NOT NULL DEFAULT 0,
  completed_count    INTEGER NOT NULL DEFAULT 0,
  revenue_attributed DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by_id      UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS flow_org_idx ON flows(org_id);
CREATE INDEX IF NOT EXISTS flow_org_status_idx ON flows(org_id, status);
CREATE INDEX IF NOT EXISTS flow_org_trigger_idx ON flows(org_id, trigger_type);

-- FLOW STEPS -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flow_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id           UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  type              flow_step_type NOT NULL,
  position          INTEGER NOT NULL,
  delay_hours       INTEGER,
  condition         JSONB,
  template_id       UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  next_step_id      UUID,
  next_if_true_id   UUID,
  next_if_false_id  UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fs_flow_pos_idx ON flow_steps(flow_id, position);

-- FLOW ENROLLMENTS -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS flow_enrollments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flow_id            UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  contact_id         UUID NOT NULL REFERENCES marketing_contacts(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'active',
  current_step_id   UUID REFERENCES flow_steps(id) ON DELETE SET NULL,
  next_run_at        TIMESTAMPTZ,
  context            JSONB,
  revenue_attributed DECIMAL(14,2) NOT NULL DEFAULT 0,
  enrolled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  exited_at          TIMESTAMPTZ,
  exit_reason        VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS fe_org_idx ON flow_enrollments(org_id);
CREATE INDEX IF NOT EXISTS fe_flow_idx ON flow_enrollments(flow_id);
CREATE INDEX IF NOT EXISTS fe_contact_idx ON flow_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS fe_status_next_idx ON flow_enrollments(status, next_run_at);
CREATE INDEX IF NOT EXISTS fe_org_flow_contact_idx ON flow_enrollments(org_id, flow_id, contact_id);

-- EMAIL MESSAGES -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES marketing_contacts(id) ON DELETE CASCADE,
  campaign_id          UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  flow_id              UUID,
  flow_step_id         UUID,
  subject              VARCHAR(500) NOT NULL,
  from_email           VARCHAR(320) NOT NULL,
  to_email             VARCHAR(320) NOT NULL,
  provider_message_id  VARCHAR(200),
  status               email_message_status NOT NULL DEFAULT 'queued',
  opened_at            TIMESTAMPTZ,
  clicked_at           TIMESTAMPTZ,
  bounced_at           TIMESTAMPTZ,
  complained_at        TIMESTAMPTZ,
  unsubscribed_at      TIMESTAMPTZ,
  open_count           INTEGER NOT NULL DEFAULT 0,
  click_count          INTEGER NOT NULL DEFAULT 0,
  scheduled_at         TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS em_org_idx ON email_messages(org_id);
CREATE INDEX IF NOT EXISTS em_org_contact_idx ON email_messages(org_id, contact_id);
CREATE INDEX IF NOT EXISTS em_campaign_idx ON email_messages(campaign_id);
CREATE INDEX IF NOT EXISTS em_provider_idx ON email_messages(provider_message_id);
CREATE INDEX IF NOT EXISTS em_sent_idx ON email_messages(sent_at);

-- EMAIL MESSAGE EVENTS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_message_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  type        VARCHAR(40) NOT NULL,
  url         TEXT,
  user_agent  TEXT,
  ip          VARCHAR(45),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS eme_msg_type_idx ON email_message_events(message_id, type);

-- EMAIL SETTINGS (one per org) -----------------------------------------------
CREATE TABLE IF NOT EXISTS email_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  from_name                 VARCHAR(200),
  from_email                VARCHAR(320),
  reply_to                  VARCHAR(320),
  sending_domain            VARCHAR(255),
  domain_verified           BOOLEAN NOT NULL DEFAULT false,
  tracking_domain           VARCHAR(255),
  token_secret              VARCHAR(100),
  public_tracking_key       VARCHAR(64) UNIQUE,
  default_consent_mode      VARCHAR(20) NOT NULL DEFAULT 'subscribed',
  doi_enabled               BOOLEAN NOT NULL DEFAULT true,
  max_per_day               INTEGER NOT NULL DEFAULT 3,
  unsubscribe_copy          TEXT,
  footer_html               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
