-- =============================================================================
-- Additive Migration: Shipments + neue PoStatus-Werte
-- =============================================================================

-- Enum-Werte für PoStatus ergänzen (nur falls noch nicht da) ------------------
DO $$ BEGIN
  ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'shipped' AFTER 'ordered';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partially_received' AFTER 'invoiced';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SHIPMENTS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  tracking_number   VARCHAR(255),
  carrier           VARCHAR(255),
  shipped_at        DATE,
  received_at       DATE,
  notes             TEXT,
  created_by_id     UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shipments_org_idx ON shipments(org_id);
CREATE INDEX IF NOT EXISTS shipments_po_idx ON shipments(purchase_order_id);
CREATE INDEX IF NOT EXISTS shipments_received_idx ON shipments(received_at);

-- SHIPMENT ITEMS (Teillieferungs-Mengen pro PO-Position) ---------------------
CREATE TABLE IF NOT EXISTS shipment_items (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id              UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  purchase_order_item_id   UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantity                 DECIMAL(14,3) NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shipment_items_shipment_idx ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS shipment_items_poi_idx ON shipment_items(purchase_order_item_id);
