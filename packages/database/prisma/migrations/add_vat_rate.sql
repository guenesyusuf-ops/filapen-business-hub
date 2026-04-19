-- Add VAT rate per product variant (7% or 19%, default 19%)
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS vat_rate decimal(5,2) NOT NULL DEFAULT 19;
