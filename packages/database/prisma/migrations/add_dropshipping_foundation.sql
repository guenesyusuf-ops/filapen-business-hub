-- Dropshipping-Modul Phase 1: Fundament
--
-- Externes China-Partner-Portal. Rein ADDITIV: nur neue ds_*-Tabellen, kein
-- Eingriff in bestehende Tabellen (orders/products/organizations). Die fuer den
-- Versand noetigen Felder werden beim Sync als Snapshot kopiert, daher keine
-- Fremdschluessel in die grossen Bestandstabellen.

-- Status-Workflow des Dropshippers
DO $$ BEGIN
  CREATE TYPE ds_order_status AS ENUM ('new', 'shipped_cn', 'in_de', 'delivered', 'on_hold');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Externer Dropship-Partner (Login kommt in Phase 2)
CREATE TABLE IF NOT EXISTS ds_partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  name          varchar(255) NOT NULL,
  email         varchar(320) NOT NULL,
  password_hash text,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_partner_org_email ON ds_partners(org_id, email);
CREATE INDEX IF NOT EXISTS idx_ds_partners_org ON ds_partners(org_id);

-- Vom Owner als "Dropshipping" markierte SKUs
CREATE TABLE IF NOT EXISTS ds_skus (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  sku                 varchar(255) NOT NULL,
  title               varchar(500),
  variant_external_id varchar(255),
  partner_id          uuid REFERENCES ds_partners(id) ON DELETE SET NULL,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_sku_org_sku ON ds_skus(org_id, sku);
CREATE INDEX IF NOT EXISTS idx_ds_skus_org ON ds_skus(org_id);
CREATE INDEX IF NOT EXISTS idx_ds_skus_org_active ON ds_skus(org_id, active);

-- Dem Dropshipper bereitgestellte Bestellung (Snapshot der Versanddaten)
CREATE TABLE IF NOT EXISTS ds_orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL,
  partner_id           uuid REFERENCES ds_partners(id) ON DELETE SET NULL,
  order_id             uuid,
  order_external_id    varchar(255) NOT NULL,
  order_number         varchar(50) NOT NULL,
  placed_at            timestamptz NOT NULL,
  customer_name        varchar(255),
  customer_phone       varchar(50),
  customer_email       varchar(320),
  shipping_address     jsonb,
  country_code         varchar(2),
  status               ds_order_status NOT NULL DEFAULT 'new',
  cn_tracking          varchar(255),
  de_tracking          varchar(255),
  carrier              varchar(120),
  note                 text,
  shipped_at           timestamptz,
  arrived_at           timestamptz,
  delivered_at         timestamptz,
  shopify_fulfilled_at timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_order_org_external ON ds_orders(org_id, order_external_id);
CREATE INDEX IF NOT EXISTS idx_ds_orders_org ON ds_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_ds_orders_org_status ON ds_orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_ds_orders_partner ON ds_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_ds_orders_org_placed ON ds_orders(org_id, placed_at);

-- Nur die Dropship-Positionen der Bestellung
CREATE TABLE IF NOT EXISTS ds_order_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL,
  ds_order_id           uuid NOT NULL REFERENCES ds_orders(id) ON DELETE CASCADE,
  sku                   varchar(255),
  title                 varchar(500) NOT NULL,
  quantity              integer NOT NULL,
  line_item_external_id varchar(255) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_order_item_order_line ON ds_order_items(ds_order_id, line_item_external_id);
CREATE INDEX IF NOT EXISTS idx_ds_order_items_org ON ds_order_items(org_id);
CREATE INDEX IF NOT EXISTS idx_ds_order_items_order ON ds_order_items(ds_order_id);

-- Protokoll der Sync-Laeufe
CREATE TABLE IF NOT EXISTS ds_sync_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  trigger        varchar(30) NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT NOW(),
  finished_at    timestamptz,
  orders_scanned integer NOT NULL DEFAULT 0,
  orders_created integer NOT NULL DEFAULT 0,
  orders_updated integer NOT NULL DEFAULT 0,
  status         varchar(20) NOT NULL DEFAULT 'ok',
  error          text
);
CREATE INDEX IF NOT EXISTS idx_ds_sync_logs_org_started ON ds_sync_logs(org_id, started_at);

-- Audit-Log (Logins + Status-/Tracking-Aenderungen)
CREATE TABLE IF NOT EXISTS ds_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  actor_type  varchar(20) NOT NULL,
  actor_id    uuid,
  action      varchar(60) NOT NULL,
  ds_order_id uuid,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ds_audit_logs_org_created ON ds_audit_logs(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ds_audit_logs_order ON ds_audit_logs(ds_order_id);
