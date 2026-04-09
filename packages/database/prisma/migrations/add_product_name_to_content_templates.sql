-- Add product_name and performance_notes columns to content_templates table
ALTER TABLE "content_templates" ADD COLUMN IF NOT EXISTS "product_name" VARCHAR(255);
ALTER TABLE "content_templates" ADD COLUMN IF NOT EXISTS "performance_notes" TEXT;

-- Add index for product_name lookups
CREATE INDEX IF NOT EXISTS "content_templates_product_name_idx" ON "content_templates"("product_name");
