// =============================================================================
// Shopify Webhook & API Payload Types
// =============================================================================

export interface ShopifyMoney {
  amount: string;
  currency_code: string;
}

export interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
}

export interface ShopifyCustomer {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  orders_count: number;
  total_spent: string;
  tags?: string;
}

export interface ShopifyDiscountCode {
  code: string;
  amount: string;
  type: string;
}

export interface ShopifyLineItem {
  id: number;
  variant_id: number | null;
  product_id: number | null;
  title: string;
  variant_title?: string;
  sku?: string;
  quantity: number;
  price: string;
  total_discount: string;
  fulfillment_status: string | null;
  tax_lines?: ShopifyTaxLine[];
  discount_allocations?: ShopifyDiscountAllocation[];
}

export interface ShopifyTaxLine {
  title: string;
  price: string;
  rate: number;
}

export interface ShopifyDiscountAllocation {
  amount: string;
  discount_application_index: number;
}

export interface ShopifyShippingLine {
  id: number;
  title: string;
  price: string;
  code: string;
  source: string;
  carrier_identifier?: string;
}

export interface ShopifyRefundLineItem {
  id: number;
  line_item_id: number;
  quantity: number;
  restock_type: string;
  subtotal: string;
  total_tax: string;
  line_item: ShopifyLineItem;
}

export interface ShopifyTransaction {
  id: number;
  order_id: number;
  kind: 'sale' | 'capture' | 'refund' | 'void' | 'authorization';
  gateway: string;
  amount: string;
  currency: string;
  status: 'success' | 'failure' | 'pending' | 'error';
  created_at: string;
  fees?: Array<{
    id: number;
    rate_name: string;
    rate: string;
    amount: string;
    flat_fee: string;
    flat_fee_name: string;
    tax_amount: string;
    type: string;
  }>;
}

export interface ShopifyOrder {
  id: number;
  admin_graphql_api_id?: string;
  order_number: number;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  cancelled_at?: string;
  processed_at?: string;
  financial_status: string;
  fulfillment_status: string | null;
  currency: string;
  subtotal_price: string;
  total_discounts: string;
  total_shipping_price_set?: { shop_money: ShopifyMoney };
  total_tax: string;
  total_price: string;
  total_line_items_price: string;
  customer?: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  shipping_lines?: ShopifyShippingLine[];
  discount_codes?: ShopifyDiscountCode[];
  payment_gateway_names?: string[];
  source_name?: string;
  tags?: string;
  landing_site?: string;
  referring_site?: string;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  refunds?: ShopifyRefundPayload[];
  transactions?: ShopifyTransaction[];
}

export interface ShopifyRefundPayload {
  id: number;
  order_id: number;
  created_at: string;
  note?: string;
  restock?: boolean;
  refund_line_items: ShopifyRefundLineItem[];
  transactions: ShopifyTransaction[];
  order_adjustments?: Array<{
    id: number;
    order_id: number;
    refund_id: number;
    amount: string;
    tax_amount: string;
    kind: string;
    reason: string;
  }>;
}

export interface ShopifyProductImage {
  id: number;
  product_id: number;
  src: string;
  position: number;
  alt?: string;
}

export interface ShopifyProductVariant {
  id: number;
  product_id: number;
  title: string;
  sku?: string;
  barcode?: string;
  price: string;
  compare_at_price?: string;
  inventory_quantity: number;
  inventory_management?: string;
  weight?: number;
  weight_unit?: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  status: 'active' | 'archived' | 'draft';
  tags?: string;
  variants: ShopifyProductVariant[];
  images: ShopifyProductImage[];
  image?: ShopifyProductImage;
  created_at: string;
  updated_at: string;
}

// Webhook envelope
export interface ShopifyWebhookPayload {
  topic: string;
  shopDomain: string;
  body: ShopifyOrder | ShopifyRefundPayload | ShopifyProduct | Record<string, unknown>;
}

// OAuth types
export interface ShopifyOAuthTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
  associated_user_scope?: string;
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

// Pagination
export interface ShopifyPaginationInfo {
  nextPageUrl: string | null;
  previousPageUrl: string | null;
}

// Rate limit info from response headers
export interface ShopifyRateLimitInfo {
  callsMade: number;
  callsLimit: number;
  retryAfterMs?: number;
}
