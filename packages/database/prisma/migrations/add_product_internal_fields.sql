-- Add internal (user-editable) fields to products table.
-- These fields are maintained by the Filapen Business Hub and are
-- NOT synchronized from Shopify.
--
-- Run manually on Supabase production.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "internal_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "internal_tags" TEXT[] DEFAULT '{}';
