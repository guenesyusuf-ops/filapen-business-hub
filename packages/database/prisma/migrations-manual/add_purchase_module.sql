-- =============================================================================
-- Manual additive migration: Purchase / Procurement module
-- Safe: only CREATE TYPE and CREATE TABLE, no drops or alters of existing tables
-- =============================================================================

-- ENUMS ----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('draft','ordered','invoiced','received','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_payment_status AS ENUM ('unpaid','partially_paid','paid','overpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_payment_method AS ENUM ('bank_transfer','credit_card','paypal','sepa_debit','cash','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_document_type AS ENUM ('invoice','proforma','delivery_note','receipt','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE supplier_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SUPPLIERS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_number    VARCHAR(50) NOT NULL,
  company_name       VARCHAR(255) NOT NULL,
  contact_name       VARCHAR(255) NOT NULL,
  email              VARCHAR(320) NOT NULL,
  phone              VARCHAR(50) NOT NULL,
  vat_id             VARCHAR(50),
  tax_number         VARCHAR(50),
  street             VARCHAR(255),
  zip_code           VARCHAR(20),
  city               VARCHAR(120),
  country            VARCHAR(2) DEFAULT 'DE',
  iban               VARCHAR(50),
  bic                VARCHAR(20),
  bank_name          VARCHAR(255),
  payment_term_days  INTEGER DEFAULT 30,
  default_currency   VARCHAR(3) NOT NULL DEFAULT 'EUR',
  notes              TEXT,
  status             supplier_status NOT NULL DEFAULT 'active',
  created_by_id      UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_supplier_org_number UNIQUE (org_id, supplier_number)
);
CREATE INDEX IF NOT EXISTS suppliers_org_id_idx ON suppliers(org_id);
CREATE INDEX IF NOT EXISTS suppliers_org_status_idx ON suppliers(org_id, status);
CREATE INDEX IF NOT EXISTS suppliers_org_company_idx ON suppliers(org_id, company_name);

-- PURCHASE ORDERS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number       VARCHAR(50) NOT NULL,
  supplier_id        UUID NOT NULL REFERENCES suppliers(id),
  order_date         DATE NOT NULL,
  expected_delivery  DATE,
  received_at        TIMESTAMPTZ,
  currency           VARCHAR(3) NOT NULL DEFAULT 'EUR',
  exchange_rate      DECIMAL(12,6),
  subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_total          DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_cost      DECIMAL(14,2),
  customs_cost       DECIMAL(14,2),
  total_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  open_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  status             po_status NOT NULL DEFAULT 'draft',
  payment_status     po_payment_status NOT NULL DEFAULT 'unpaid',
  notes              TEXT,
  internal_notes     TEXT,
  created_by_id      UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_po_org_number UNIQUE (org_id, order_number)
);
CREATE INDEX IF NOT EXISTS purchase_orders_org_id_idx ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS purchase_orders_org_status_idx ON purchase_orders(org_id, status);
CREATE INDEX IF NOT EXISTS purchase_orders_org_supplier_idx ON purchase_orders(org_id, supplier_id);
CREATE INDEX IF NOT EXISTS purchase_orders_org_date_idx ON purchase_orders(org_id, order_date);
CREATE INDEX IF NOT EXISTS purchase_orders_org_payment_idx ON purchase_orders(org_id, payment_status);

-- PURCHASE ORDER ITEMS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          UUID,
  product_variant_id  UUID,
  product_name        VARCHAR(500) NOT NULL,
  sku                 VARCHAR(255),
  quantity            DECIMAL(14,3) NOT NULL,
  unit_price          DECIMAL(14,4) NOT NULL,
  vat_rate            DECIMAL(5,2) NOT NULL DEFAULT 19,
  line_subtotal       DECIMAL(14,2) NOT NULL,
  line_tax            DECIMAL(14,2) NOT NULL,
  line_total          DECIMAL(14,2) NOT NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS poi_purchase_order_idx ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS poi_product_idx ON purchase_order_items(product_id);

-- PURCHASE DOCUMENTS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL,
  purchase_order_id   UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name           VARCHAR(500) NOT NULL,
  file_url            TEXT NOT NULL,
  storage_key         TEXT NOT NULL,
  file_size           BIGINT,
  mime_type           VARCHAR(100) NOT NULL,
  document_type       po_document_type NOT NULL DEFAULT 'other',
  uploaded_by_id      UUID NOT NULL REFERENCES users(id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pdoc_org_idx ON purchase_documents(org_id);
CREATE INDEX IF NOT EXISTS pdoc_org_po_idx ON purchase_documents(org_id, purchase_order_id);

-- PURCHASE INVOICES ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL,
  purchase_order_id   UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_number      VARCHAR(100) NOT NULL,
  invoice_date        DATE NOT NULL,
  due_date            DATE,
  amount              DECIMAL(14,2) NOT NULL,
  currency            VARCHAR(3) NOT NULL DEFAULT 'EUR',
  document_id         UUID REFERENCES purchase_documents(id) ON DELETE SET NULL,
  created_by_id       UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoice_org_number UNIQUE (org_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS pinv_org_idx ON purchase_invoices(org_id);
CREATE INDEX IF NOT EXISTS pinv_org_date_idx ON purchase_invoices(org_id, invoice_date);
CREATE INDEX IF NOT EXISTS pinv_org_due_idx ON purchase_invoices(org_id, due_date);
CREATE INDEX IF NOT EXISTS pinv_po_idx ON purchase_invoices(purchase_order_id);

-- PAYMENTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  purchase_order_id     UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_date          DATE NOT NULL,
  amount                DECIMAL(14,2) NOT NULL,
  currency              VARCHAR(3) NOT NULL DEFAULT 'EUR',
  method                po_payment_method NOT NULL DEFAULT 'bank_transfer',
  reference             VARCHAR(255),
  note                  TEXT,
  receipt_document_id   UUID REFERENCES purchase_documents(id) ON DELETE SET NULL,
  created_by_id         UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pay_org_idx ON payments(org_id);
CREATE INDEX IF NOT EXISTS pay_org_date_idx ON payments(org_id, payment_date);
CREATE INDEX IF NOT EXISTS pay_po_idx ON payments(purchase_order_id);

-- PURCHASE AUDIT LOGS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL,
  purchase_order_id   UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  entity_type         VARCHAR(50) NOT NULL,
  entity_id           UUID NOT NULL,
  action              VARCHAR(50) NOT NULL,
  changes             JSONB,
  user_id             UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pal_org_idx ON purchase_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS pal_org_entity_idx ON purchase_audit_logs(org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS pal_po_idx ON purchase_audit_logs(purchase_order_id);
