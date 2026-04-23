-- ================================================================
-- Sales module — B2B order management with easybill integration
-- Run in Supabase SQL editor. Idempotent via IF NOT EXISTS.
-- ================================================================

-- ENUMS ---------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE sales_order_status AS ENUM (
    'draft','confirmed','shipped','invoiced','completed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales_document_kind AS ENUM (
    'original','confirmation','invoice','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales_event_type AS ENUM (
    'created','imported','edited','confirmation_sent','shipped','invoice_sent','note','status_change'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales_reminder_kind AS ENUM (
    'urgent_3d','overdue','invoice_after_shipping'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CUSTOMERS -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_customers (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_number          VARCHAR(50)  NOT NULL,
  external_customer_number VARCHAR(100),
  company_name             VARCHAR(255) NOT NULL,
  contact_person           VARCHAR(255),
  email                    VARCHAR(320),
  phone                    VARCHAR(50),
  shipping_address         JSONB,
  billing_address          JSONB,
  payment_terms            VARCHAR(255),
  notes                    TEXT,
  easybill_customer_id     VARCHAR(100),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_customer_org_number
  ON sales_customers(org_id, customer_number);
CREATE INDEX IF NOT EXISTS idx_sales_customers_org                ON sales_customers(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_customers_org_company        ON sales_customers(org_id, company_name);
CREATE INDEX IF NOT EXISTS idx_sales_customers_org_email          ON sales_customers(org_id, email);

-- ORDERS --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_orders (
  id                            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                        UUID               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number                  VARCHAR(50)        NOT NULL,
  customer_id                   UUID               NOT NULL REFERENCES sales_customers(id) ON DELETE RESTRICT,
  external_order_number         VARCHAR(100),
  order_date                    TIMESTAMPTZ,
  required_delivery_date        TIMESTAMPTZ,
  contact_person                VARCHAR(255),
  shipping_address              JSONB,
  billing_address               JSONB,
  payment_terms                 VARCHAR(255),
  currency                      VARCHAR(3)         NOT NULL DEFAULT 'EUR',
  total_net                     NUMERIC(12, 2)     NOT NULL DEFAULT 0,
  status                        sales_order_status NOT NULL DEFAULT 'draft',
  created_by_id                 UUID               NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to_id                UUID               REFERENCES users(id) ON DELETE SET NULL,
  confirmation_sent_at          TIMESTAMPTZ,
  shipped_at                    TIMESTAMPTZ,
  invoice_sent_at               TIMESTAMPTZ,
  easybill_confirmation_id      VARCHAR(100),
  easybill_confirmation_pdf_url TEXT,
  easybill_invoice_id           VARCHAR(100),
  easybill_invoice_pdf_url      TEXT,
  shipping_carrier_note         VARCHAR(255),
  tracking_numbers              TEXT[]             NOT NULL DEFAULT '{}',
  source_document_id            UUID,
  extraction_confidence         DOUBLE PRECISION,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_org_number       ON sales_orders(org_id, order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org                    ON sales_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org_status             ON sales_orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org_delivery           ON sales_orders(org_id, required_delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org_customer           ON sales_orders(org_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org_created            ON sales_orders(org_id, created_at);

-- LINE ITEMS ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_order_line_items (
  id                         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id                   UUID           NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  position                   INT            NOT NULL DEFAULT 1,
  title                      VARCHAR(500)   NOT NULL,
  supplier_article_number    VARCHAR(100),
  ean                        VARCHAR(50),
  units_per_carton           INT,
  quantity                   INT            NOT NULL DEFAULT 1,
  unit_price_net             NUMERIC(12, 4) NOT NULL DEFAULT 0,
  line_net                   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  matched_product_variant_id UUID           REFERENCES product_variants(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_line_order                    ON sales_order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_line_ean                      ON sales_order_line_items(org_id, ean);
CREATE INDEX IF NOT EXISTS idx_sales_line_supplier_article         ON sales_order_line_items(org_id, supplier_article_number);

-- DOCUMENTS -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_order_documents (
  id             UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id       UUID                NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  kind           sales_document_kind NOT NULL DEFAULT 'other',
  file_name      VARCHAR(255)        NOT NULL,
  r2_key         TEXT                NOT NULL,
  url            TEXT                NOT NULL,
  mime_type      VARCHAR(100)        NOT NULL,
  size_bytes     INT                 NOT NULL,
  uploaded_by_id UUID                NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at    TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_order                     ON sales_order_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_doc_org_kind                  ON sales_order_documents(org_id, kind);

-- EVENTS --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_order_events (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id   UUID             NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  type       sales_event_type NOT NULL,
  actor_id   UUID             REFERENCES users(id) ON DELETE SET NULL,
  note       TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_event_order_created           ON sales_order_events(order_id, created_at);

-- REMINDERS -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sales_order_reminders (
  id                UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id          UUID                NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  kind              sales_reminder_kind NOT NULL,
  sent_at           TIMESTAMPTZ         NOT NULL DEFAULT now(),
  sent_to_user_ids  TEXT[]              NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_reminder_order_kind     ON sales_order_reminders(order_id, kind);
CREATE INDEX IF NOT EXISTS idx_sales_reminder_order                ON sales_order_reminders(order_id);

-- updated_at triggers — reuse the generic one if it exists, otherwise skip
-- (updated_at is set by Prisma @updatedAt anyway)
