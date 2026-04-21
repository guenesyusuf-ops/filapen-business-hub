-- =============================================================================
-- Additive Migration: Shipping / Versand module
-- 9 new tables + 5 enums + extends orders with shipping_address snapshot
-- =============================================================================

-- ENUMS ----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE shipping_carrier AS ENUM ('dhl','ups','dpd','hermes','gls','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE carrier_account_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_shipment_status AS ENUM (
    'label_created','handed_to_carrier','in_transit','out_for_delivery',
    'delivered','delivery_failed','ready_for_pickup','returned','exception','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE label_format AS ENUM ('pdf_a4','pdf_100x150','pdf_103x199','zpl_100x150','zpl_103x199');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shipping_rule_action AS ENUM ('select_carrier','select_method','select_package','block_shipment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EXTEND orders table --------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(320);
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- CARRIER ACCOUNTS -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrier_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carrier        shipping_carrier NOT NULL,
  account_name   VARCHAR(200) NOT NULL,
  credentials    JSONB NOT NULL,
  is_default     BOOLEAN NOT NULL DEFAULT false,
  status         carrier_account_status NOT NULL DEFAULT 'active',
  sender_data    JSONB,
  api_ready      BOOLEAN NOT NULL DEFAULT false,
  notes          TEXT,
  created_by_id  UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ca_org_idx ON carrier_accounts(org_id);
CREATE INDEX IF NOT EXISTS ca_org_carrier_idx ON carrier_accounts(org_id, carrier);

-- SHIPPING PACKAGES ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_packages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name           VARCHAR(200) NOT NULL,
  length_mm      INTEGER NOT NULL,
  width_mm       INTEGER NOT NULL,
  height_mm      INTEGER NOT NULL,
  empty_weight_g INTEGER NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  sort_index     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sp_org_idx ON shipping_packages(org_id);
CREATE INDEX IF NOT EXISTS sp_org_active_idx ON shipping_packages(org_id, active);

-- SHIPPING RULES -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  priority      INTEGER NOT NULL DEFAULT 100,
  conditions    JSONB NOT NULL,
  action_type   shipping_rule_action NOT NULL,
  action_value  JSONB NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sr_org_idx ON shipping_rules(org_id);
CREATE INDEX IF NOT EXISTS sr_org_active_prio_idx ON shipping_rules(org_id, active, priority);

-- SHIPPING PRODUCT PROFILES --------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_product_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_variant_id  UUID UNIQUE REFERENCES product_variants(id) ON DELETE SET NULL,
  sku                 VARCHAR(255),
  title               VARCHAR(500),
  weight_g            INTEGER NOT NULL DEFAULT 0,
  length_mm           INTEGER,
  width_mm            INTEGER,
  height_mm           INTEGER,
  hs_code             VARCHAR(20),
  country_of_origin   VARCHAR(2),
  customs_value_cents INTEGER,
  customs_currency    VARCHAR(3) DEFAULT 'EUR',
  exclude_from_shipping BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS spp_org_idx ON shipping_product_profiles(org_id);
CREATE INDEX IF NOT EXISTS spp_org_sku_idx ON shipping_product_profiles(org_id, sku);
CREATE INDEX IF NOT EXISTS spp_pv_idx ON shipping_product_profiles(product_variant_id);

-- ORDER SHIPMENTS (main) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS order_shipments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier             shipping_carrier NOT NULL,
  carrier_account_id  UUID REFERENCES carrier_accounts(id) ON DELETE SET NULL,
  package_id          UUID REFERENCES shipping_packages(id) ON DELETE SET NULL,
  recipient_name      VARCHAR(255) NOT NULL,
  recipient_email     VARCHAR(320),
  recipient_phone     VARCHAR(50),
  recipient_address   JSONB NOT NULL,
  sender_address      JSONB,
  shipping_method     VARCHAR(100),
  tracking_number     VARCHAR(100),
  tracking_url        TEXT,
  weight_g            INTEGER NOT NULL DEFAULT 0,
  length_mm           INTEGER,
  width_mm            INTEGER,
  height_mm           INTEGER,
  cost                DECIMAL(12,2),
  currency            VARCHAR(3),
  status              order_shipment_status NOT NULL DEFAULT 'label_created',
  api_mode            BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_by_id       UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handed_over_at      TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS os_org_idx ON order_shipments(org_id);
CREATE INDEX IF NOT EXISTS os_org_status_idx ON order_shipments(org_id, status);
CREATE INDEX IF NOT EXISTS os_org_created_idx ON order_shipments(org_id, created_at);
CREATE INDEX IF NOT EXISTS os_order_idx ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS os_tracking_idx ON order_shipments(tracking_number);

-- ORDER SHIPMENT LABELS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_shipment_labels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id      UUID NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  sequence_number  INTEGER NOT NULL DEFAULT 1,
  tracking_number  VARCHAR(100),
  format           label_format NOT NULL DEFAULT 'pdf_100x150',
  width_mm         INTEGER,
  height_mm        INTEGER,
  storage_key      TEXT NOT NULL,
  url              TEXT NOT NULL,
  raw_content      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS osl_shipment_idx ON order_shipment_labels(shipment_id);

-- ORDER SHIPMENT STATUS EVENTS -----------------------------------------------
CREATE TABLE IF NOT EXISTS order_shipment_status_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  UUID NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  status       order_shipment_status NOT NULL,
  note         TEXT,
  raw_data     JSONB,
  source       VARCHAR(20) NOT NULL DEFAULT 'api',
  occurred_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS osse_shipment_occ_idx ON order_shipment_status_events(shipment_id, occurred_at);
CREATE INDEX IF NOT EXISTS osse_shipment_status_idx ON order_shipment_status_events(shipment_id, status);

-- SHIPPING EMAIL AUTOMATIONS -------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_email_automations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_status      order_shipment_status NOT NULL,
  template_id         UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject             VARCHAR(500),
  enabled             BOOLEAN NOT NULL DEFAULT false,
  send_delay_minutes  INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shipping_email_org_status UNIQUE (org_id, trigger_status)
);
CREATE INDEX IF NOT EXISTS sea_org_enabled_idx ON shipping_email_automations(org_id, enabled);

-- SHIPPING EMAIL LOGS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_email_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shipment_id     UUID NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  automation_id   UUID,
  trigger_status  order_shipment_status NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  subject         VARCHAR(500) NOT NULL,
  message_id      VARCHAR(200),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sel_org_idx ON shipping_email_logs(org_id);
CREATE INDEX IF NOT EXISTS sel_shipment_idx ON shipping_email_logs(shipment_id);
