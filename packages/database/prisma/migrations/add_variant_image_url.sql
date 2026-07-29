-- Adds image_url to product_variants so we can show the actual variant
-- image (e.g. blue smartwatch) in shipping order tiles, instead of always
-- falling back to the product default image.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS image_url text;
