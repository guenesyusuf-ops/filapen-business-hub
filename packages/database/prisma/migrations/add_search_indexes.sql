-- Trigram-Indexes fuer schnellere "contains, mode: insensitive" Suchen.
-- pg_trgm + GIN-Index macht ILIKE %term% extrem schnell (statt Full-Table-Scan).
-- Bei wachsendem Datenbestand sind das die wichtigsten Indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_po_order_number_trgm ON purchase_orders USING gin (order_number gin_trgm_ops);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company_trgm ON suppliers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_email_trgm ON suppliers USING gin (email gin_trgm_ops);

-- Purchase Order Items (product name search in list)
CREATE INDEX IF NOT EXISTS idx_po_items_product_name_trgm ON purchase_order_items USING gin (product_name gin_trgm_ops);

-- Purchase Invoices
CREATE INDEX IF NOT EXISTS idx_po_invoices_number_trgm ON purchase_invoices USING gin (invoice_number gin_trgm_ops);

-- Shipments tracking number
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_trgm ON shipments USING gin (tracking_number gin_trgm_ops);

-- Sales Orders
CREATE INDEX IF NOT EXISTS idx_sales_orders_number_trgm ON sales_orders USING gin (order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_orders_external_trgm ON sales_orders USING gin (external_order_number gin_trgm_ops);

-- Sales Customers
CREATE INDEX IF NOT EXISTS idx_sales_customers_company_trgm ON sales_customers USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_customers_email_trgm ON sales_customers USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_customers_number_trgm ON sales_customers USING gin (customer_number gin_trgm_ops);

-- Sales Order Line Items (title search)
CREATE INDEX IF NOT EXISTS idx_sales_line_items_title_trgm ON sales_order_line_items USING gin (title gin_trgm_ops);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON products USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);

-- Product Variants
CREATE INDEX IF NOT EXISTS idx_variants_sku_trgm ON product_variants USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_variants_title_trgm ON product_variants USING gin (title gin_trgm_ops);

-- Orders (Shopify imports - customer email)
CREATE INDEX IF NOT EXISTS idx_orders_email_trgm ON orders USING gin (customer_email gin_trgm_ops);

-- WM Tasks (title search)
CREATE INDEX IF NOT EXISTS idx_wm_tasks_title_trgm ON wm_tasks USING gin (title gin_trgm_ops);
