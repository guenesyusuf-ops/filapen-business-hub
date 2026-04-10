-- Add description column to products table (for Shopify body_html and product details)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" TEXT;
