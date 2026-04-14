-- Migration: Add productId + notes to briefings, make dealId optional, create briefing_attachments
-- Date: 2026-04-10

-- 1. Make deal_id nullable on briefings
ALTER TABLE "briefings" ALTER COLUMN "deal_id" DROP NOT NULL;

-- 2. Add product_id column to briefings (nullable, FK to products)
ALTER TABLE "briefings" ADD COLUMN "product_id" UUID;
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "briefings_product_id_idx" ON "briefings"("product_id");

-- 3. Add notes column to briefings
ALTER TABLE "briefings" ADD COLUMN "notes" TEXT;

-- 4. Create briefing_attachments table
CREATE TABLE "briefing_attachments" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "org_id"      UUID         NOT NULL,
  "briefing_id" UUID         NOT NULL,
  "file_name"   VARCHAR(255) NOT NULL,
  "file_url"    TEXT         NOT NULL,
  "file_type"   VARCHAR(50)  NOT NULL,
  "storage_key" TEXT,
  "file_size"   INTEGER,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "briefing_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "briefing_attachments_briefing_id_fkey"
    FOREIGN KEY ("briefing_id") REFERENCES "briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "briefing_attachments_briefing_id_idx" ON "briefing_attachments"("briefing_id");
