/* eslint-disable no-console */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const SHOP_ID = '00000000-0000-0000-0000-000000000010';
const SHOPIFY_INTEGRATION_ID = '00000000-0000-0000-0000-000000000020';
const META_INTEGRATION_ID = '00000000-0000-0000-0000-000000000021';
const GOOGLE_INTEGRATION_ID = '00000000-0000-0000-0000-000000000022';
const META_AD_ACCOUNT_ID = '00000000-0000-0000-0000-000000000030';
const GOOGLE_AD_ACCOUNT_ID = '00000000-0000-0000-0000-000000000031';

const DAYS_BACK = 90;
const NOW = new Date();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Seeded pseudo-random for reproducibility */
let _seed = 42;
function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function randomBetween(min: number, max: number): number {
  return min + seededRandom() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seededRandom() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Product catalog
// ---------------------------------------------------------------------------

interface ProductDef {
  title: string;
  category: string;
  variants: Array<{
    title: string;
    sku: string;
    price: number;
    cogs: number;
  }>;
}

const PRODUCTS: ProductDef[] = [
  // Skincare
  {
    title: 'Hydrating Face Serum',
    category: 'Skincare',
    variants: [
      { title: '30ml', sku: 'HFS-30', price: 45.00, cogs: 12.50 },
      { title: '60ml', sku: 'HFS-60', price: 75.00, cogs: 19.00 },
    ],
  },
  {
    title: 'Vitamin C Moisturizer',
    category: 'Skincare',
    variants: [
      { title: '50ml', sku: 'VCM-50', price: 38.00, cogs: 10.00 },
    ],
  },
  {
    title: 'Retinol Night Cream',
    category: 'Skincare',
    variants: [
      { title: '30ml', sku: 'RNC-30', price: 55.00, cogs: 14.00 },
      { title: '50ml', sku: 'RNC-50', price: 85.00, cogs: 21.00 },
    ],
  },
  {
    title: 'Gentle Cleanser',
    category: 'Skincare',
    variants: [
      { title: '150ml', sku: 'GCL-150', price: 28.00, cogs: 7.00 },
    ],
  },
  {
    title: 'SPF 50 Sunscreen',
    category: 'Skincare',
    variants: [
      { title: '50ml', sku: 'SPF-50', price: 32.00, cogs: 8.50 },
      { title: '100ml', sku: 'SPF-100', price: 52.00, cogs: 14.00 },
    ],
  },
  // Supplements
  {
    title: 'Daily Multivitamin',
    category: 'Supplements',
    variants: [
      { title: '30 capsules', sku: 'DMV-30', price: 24.00, cogs: 5.50 },
      { title: '90 capsules', sku: 'DMV-90', price: 59.00, cogs: 13.00 },
    ],
  },
  {
    title: 'Collagen Peptides',
    category: 'Supplements',
    variants: [
      { title: '200g', sku: 'CP-200', price: 42.00, cogs: 11.00 },
      { title: '500g', sku: 'CP-500', price: 89.00, cogs: 22.00 },
    ],
  },
  {
    title: 'Omega-3 Fish Oil',
    category: 'Supplements',
    variants: [
      { title: '60 softgels', sku: 'O3-60', price: 29.00, cogs: 6.50 },
    ],
  },
  {
    title: 'Probiotic Complex',
    category: 'Supplements',
    variants: [
      { title: '30 capsules', sku: 'PBC-30', price: 35.00, cogs: 8.00 },
    ],
  },
  {
    title: 'Ashwagandha Extract',
    category: 'Supplements',
    variants: [
      { title: '60 capsules', sku: 'ASH-60', price: 27.00, cogs: 6.00 },
      { title: '120 capsules', sku: 'ASH-120', price: 45.00, cogs: 10.00 },
    ],
  },
  // Apparel
  {
    title: 'Performance Tee',
    category: 'Apparel',
    variants: [
      { title: 'S / Black', sku: 'PT-S-BK', price: 34.00, cogs: 9.00 },
      { title: 'M / Black', sku: 'PT-M-BK', price: 34.00, cogs: 9.00 },
      { title: 'L / Black', sku: 'PT-L-BK', price: 34.00, cogs: 9.00 },
    ],
  },
  {
    title: 'Classic Hoodie',
    category: 'Apparel',
    variants: [
      { title: 'M / Navy', sku: 'CH-M-NV', price: 68.00, cogs: 20.00 },
      { title: 'L / Navy', sku: 'CH-L-NV', price: 68.00, cogs: 20.00 },
    ],
  },
  {
    title: 'Running Shorts',
    category: 'Apparel',
    variants: [
      { title: 'M', sku: 'RS-M', price: 42.00, cogs: 11.00 },
      { title: 'L', sku: 'RS-L', price: 42.00, cogs: 11.00 },
    ],
  },
  {
    title: 'Yoga Leggings',
    category: 'Apparel',
    variants: [
      { title: 'S', sku: 'YL-S', price: 58.00, cogs: 16.00 },
      { title: 'M', sku: 'YL-M', price: 58.00, cogs: 16.00 },
    ],
  },
  // Accessories
  {
    title: 'Branded Water Bottle',
    category: 'Accessories',
    variants: [
      { title: '750ml', sku: 'BWB-750', price: 22.00, cogs: 5.00 },
    ],
  },
  {
    title: 'Gym Bag',
    category: 'Accessories',
    variants: [
      { title: 'Standard', sku: 'GB-STD', price: 48.00, cogs: 13.00 },
    ],
  },
  {
    title: 'Resistance Band Set',
    category: 'Accessories',
    variants: [
      { title: '3-Pack', sku: 'RBS-3', price: 24.00, cogs: 5.50 },
      { title: '5-Pack', sku: 'RBS-5', price: 38.00, cogs: 8.50 },
    ],
  },
  {
    title: 'Foam Roller',
    category: 'Accessories',
    variants: [
      { title: '18 inch', sku: 'FR-18', price: 32.00, cogs: 8.00 },
    ],
  },
  {
    title: 'Massage Gun',
    category: 'Accessories',
    variants: [
      { title: 'Standard', sku: 'MG-STD', price: 129.00, cogs: 38.00 },
      { title: 'Pro', sku: 'MG-PRO', price: 189.00, cogs: 55.00 },
    ],
  },
  {
    title: 'Recovery Sleep Mask',
    category: 'Accessories',
    variants: [
      { title: 'One Size', sku: 'RSM-OS', price: 18.00, cogs: 3.50 },
    ],
  },
];

// Flatten all variants for order generation
interface FlatVariant {
  productIndex: number;
  variantIndex: number;
  price: number;
  cogs: number;
  sku: string;
}

const FLAT_VARIANTS: FlatVariant[] = [];
for (let pi = 0; pi < PRODUCTS.length; pi++) {
  for (let vi = 0; vi < PRODUCTS[pi].variants.length; vi++) {
    const v = PRODUCTS[pi].variants[vi];
    FLAT_VARIANTS.push({
      productIndex: pi,
      variantIndex: vi,
      price: v.price,
      cogs: v.cogs,
      sku: v.sku,
    });
  }
}

// Popularity weights -- some products sell more than others
const VARIANT_WEIGHTS = FLAT_VARIANTS.map((v) => {
  // Cheaper items sell more, skincare and supplements are the best sellers
  const category = PRODUCTS[v.productIndex].category;
  let w = 1;
  if (category === 'Skincare') w = 2.5;
  else if (category === 'Supplements') w = 2.0;
  else if (category === 'Apparel') w = 1.5;
  // Higher priced items sell slightly less
  if (v.price > 100) w *= 0.6;
  else if (v.price > 60) w *= 0.8;
  return w;
});

// Countries distribution
const COUNTRIES = [
  { code: 'US', weight: 60 },
  { code: 'GB', weight: 15 },
  { code: 'DE', weight: 10 },
  { code: 'CA', weight: 5 },
  { code: 'AU', weight: 4 },
  { code: 'FR', weight: 3 },
  { code: 'JP', weight: 2 },
  { code: 'NL', weight: 1 },
];

const COUNTRY_CODES = COUNTRIES.map((c) => c.code);
const COUNTRY_WEIGHTS = COUNTRIES.map((c) => c.weight);

const GATEWAYS = ['shopify_payments', 'paypal'];
const GATEWAY_WEIGHTS = [75, 25];

const DISCOUNT_CODES = ['WELCOME10', 'SUMMER15', 'VIP20', 'FLASH25', 'BUNDLE10'];

// Ad campaign definitions
const META_CAMPAIGNS = [
  { name: 'Meta - Broad Awareness', objective: 'awareness', dailyBudget: 800, roasBase: 2.8 },
  { name: 'Meta - Retargeting', objective: 'conversions', dailyBudget: 500, roasBase: 3.5 },
  { name: 'Meta - Lookalike', objective: 'conversions', dailyBudget: 400, roasBase: 3.0 },
];

const GOOGLE_CAMPAIGNS = [
  { name: 'Google - Brand Search', objective: 'search', dailyBudget: 400, roasBase: 4.5 },
  { name: 'Google - Shopping', objective: 'shopping', dailyBudget: 350, roasBase: 3.8 },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding Filapen Finance Hub...');

  // =========================================================================
  // 1. Organization
  // =========================================================================
  console.log('Creating organization...');
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'Demo Store',
      slug: 'demo-store',
      plan: 'growth',
      currency: 'USD',
      timezone: 'America/New_York',
    },
  });

  // =========================================================================
  // 2. User
  // =========================================================================
  console.log('Creating user...');
  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      orgId: ORG_ID,
      clerkUserId: 'user_dev_demo_001',
      email: 'demo@filapen.com',
      name: 'Demo Admin',
      role: 'owner',
      status: 'active',
    },
  });

  // =========================================================================
  // 3. Integrations
  // =========================================================================
  console.log('Creating integrations...');
  await prisma.integration.upsert({
    where: { id: SHOPIFY_INTEGRATION_ID },
    update: {},
    create: {
      id: SHOPIFY_INTEGRATION_ID,
      orgId: ORG_ID,
      type: 'shopify',
      status: 'connected',
      credentials: {},
      scopes: ['read_orders', 'read_products'],
      lastSyncedAt: new Date(),
    },
  });

  await prisma.integration.upsert({
    where: { id: META_INTEGRATION_ID },
    update: {},
    create: {
      id: META_INTEGRATION_ID,
      orgId: ORG_ID,
      type: 'meta_ads',
      status: 'connected',
      credentials: {},
      scopes: ['ads_read'],
      lastSyncedAt: new Date(),
    },
  });

  await prisma.integration.upsert({
    where: { id: GOOGLE_INTEGRATION_ID },
    update: {},
    create: {
      id: GOOGLE_INTEGRATION_ID,
      orgId: ORG_ID,
      type: 'google_ads',
      status: 'connected',
      credentials: {},
      scopes: ['adwords'],
      lastSyncedAt: new Date(),
    },
  });

  // =========================================================================
  // 4. Shop
  // =========================================================================
  console.log('Creating shop...');
  await prisma.shop.upsert({
    where: { id: SHOP_ID },
    update: {},
    create: {
      id: SHOP_ID,
      orgId: ORG_ID,
      integrationId: SHOPIFY_INTEGRATION_ID,
      platform: 'shopify',
      name: 'Demo Shopify Store',
      domain: 'demo-store.myshopify.com',
      currency: 'USD',
      timezone: 'America/New_York',
    },
  });

  // =========================================================================
  // 5. Products & Variants
  // =========================================================================
  console.log('Creating products...');
  const productIds: string[] = [];
  const variantIds: string[] = [];
  const variantMap: Map<string, { productId: string; price: number; cogs: number }> = new Map();

  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const p = PRODUCTS[pi];
    const productId = uuid();
    productIds.push(productId);

    await prisma.product.upsert({
      where: {
        orgId_externalId: { orgId: ORG_ID, externalId: `shopify-product-${pi + 1}` },
      },
      update: { id: productId },
      create: {
        id: productId,
        orgId: ORG_ID,
        shopId: SHOP_ID,
        externalId: `shopify-product-${pi + 1}`,
        title: p.title,
        handle: p.title.toLowerCase().replace(/\s+/g, '-'),
        category: p.category,
        status: 'active',
        imageUrl: `https://placehold.co/400x400?text=${encodeURIComponent(p.title)}`,
      },
    });

    for (let vi = 0; vi < p.variants.length; vi++) {
      const v = p.variants[vi];
      const variantId = uuid();
      variantIds.push(variantId);

      await prisma.productVariant.upsert({
        where: {
          orgId_externalId: { orgId: ORG_ID, externalId: `shopify-variant-${pi + 1}-${vi + 1}` },
        },
        update: { id: variantId },
        create: {
          id: variantId,
          orgId: ORG_ID,
          productId,
          externalId: `shopify-variant-${pi + 1}-${vi + 1}`,
          title: v.title,
          sku: v.sku,
          price: new Prisma.Decimal(v.price),
          cogs: new Prisma.Decimal(v.cogs),
          cogsUpdatedAt: new Date(),
          inventoryQuantity: randomInt(50, 500),
        },
      });

      variantMap.set(variantId, { productId, price: v.price, cogs: v.cogs });
    }
  }

  // Build an ordered list of variant IDs matching FLAT_VARIANTS
  const orderedVariantIds = variantIds; // They're in the same order we created them

  // =========================================================================
  // 6. Ad Accounts
  // =========================================================================
  console.log('Creating ad accounts...');
  await prisma.adAccount.upsert({
    where: { id: META_AD_ACCOUNT_ID },
    update: {},
    create: {
      id: META_AD_ACCOUNT_ID,
      orgId: ORG_ID,
      integrationId: META_INTEGRATION_ID,
      platform: 'meta',
      externalAccountId: 'act_123456789',
      name: 'Meta Ads - Demo Store',
      currency: 'USD',
      status: 'active',
    },
  });

  await prisma.adAccount.upsert({
    where: { id: GOOGLE_AD_ACCOUNT_ID },
    update: {},
    create: {
      id: GOOGLE_AD_ACCOUNT_ID,
      orgId: ORG_ID,
      integrationId: GOOGLE_INTEGRATION_ID,
      platform: 'google',
      externalAccountId: '123-456-7890',
      name: 'Google Ads - Demo Store',
      currency: 'USD',
      status: 'active',
    },
  });

  // =========================================================================
  // 7. Ad Campaigns
  // =========================================================================
  console.log('Creating ad campaigns...');
  const metaCampaignIds: string[] = [];
  for (let i = 0; i < META_CAMPAIGNS.length; i++) {
    const c = META_CAMPAIGNS[i];
    const id = uuid();
    metaCampaignIds.push(id);
    await prisma.adCampaign.upsert({
      where: {
        orgId_externalId: { orgId: ORG_ID, externalId: `meta-campaign-${i + 1}` },
      },
      update: { id },
      create: {
        id,
        orgId: ORG_ID,
        adAccountId: META_AD_ACCOUNT_ID,
        externalId: `meta-campaign-${i + 1}`,
        name: c.name,
        status: 'active',
        objective: c.objective,
        dailyBudget: new Prisma.Decimal(c.dailyBudget),
        currency: 'USD',
      },
    });
  }

  const googleCampaignIds: string[] = [];
  for (let i = 0; i < GOOGLE_CAMPAIGNS.length; i++) {
    const c = GOOGLE_CAMPAIGNS[i];
    const id = uuid();
    googleCampaignIds.push(id);
    await prisma.adCampaign.upsert({
      where: {
        orgId_externalId: { orgId: ORG_ID, externalId: `google-campaign-${i + 1}` },
      },
      update: { id },
      create: {
        id,
        orgId: ORG_ID,
        adAccountId: GOOGLE_AD_ACCOUNT_ID,
        externalId: `google-campaign-${i + 1}`,
        name: c.name,
        status: 'active',
        objective: c.objective,
        dailyBudget: new Prisma.Decimal(c.dailyBudget),
        currency: 'USD',
      },
    });
  }

  // =========================================================================
  // 8. Payment Method Configs
  // =========================================================================
  console.log('Creating payment method configs...');
  await prisma.paymentMethodConfig.upsert({
    where: { orgId_gatewayName: { orgId: ORG_ID, gatewayName: 'shopify_payments' } },
    update: {},
    create: {
      orgId: ORG_ID,
      gatewayName: 'shopify_payments',
      feePercentage: new Prisma.Decimal('2.9'),
      feeFixedAmount: new Prisma.Decimal('0.30'),
      feeCurrency: 'USD',
      isActive: true,
    },
  });

  await prisma.paymentMethodConfig.upsert({
    where: { orgId_gatewayName: { orgId: ORG_ID, gatewayName: 'paypal' } },
    update: {},
    create: {
      orgId: ORG_ID,
      gatewayName: 'paypal',
      feePercentage: new Prisma.Decimal('3.49'),
      feeFixedAmount: new Prisma.Decimal('0.49'),
      feeCurrency: 'USD',
      isActive: true,
    },
  });

  // =========================================================================
  // 9. Fixed Costs
  // =========================================================================
  console.log('Creating fixed costs...');
  const fixedCostDefs = [
    { name: 'Shopify Plus Plan', category: 'software' as const, amount: 299, recurrence: 'monthly' as const },
    { name: 'Software Stack (Klaviyo, Gorgias, etc)', category: 'software' as const, amount: 500, recurrence: 'monthly' as const },
    { name: 'Warehouse & Fulfillment', category: 'warehouse' as const, amount: 2000, recurrence: 'monthly' as const },
    { name: 'Staff Payroll', category: 'salary' as const, amount: 8000, recurrence: 'monthly' as const },
  ];

  for (const fc of fixedCostDefs) {
    // Use a deterministic check to avoid duplicate inserts
    const existing = await prisma.fixedCost.findFirst({
      where: { orgId: ORG_ID, name: fc.name },
    });
    if (!existing) {
      await prisma.fixedCost.create({
        data: {
          orgId: ORG_ID,
          name: fc.name,
          category: fc.category,
          amount: new Prisma.Decimal(fc.amount),
          currency: 'USD',
          recurrence: fc.recurrence,
          startDate: daysAgo(DAYS_BACK),
        },
      });
    }
  }

  // =========================================================================
  // 10. Orders, Line Items, Shipping Costs (last 90 days)
  // =========================================================================
  console.log('Creating orders (this may take a moment)...');

  // Track customer emails for is_first_order logic
  const seenCustomers = new Set<string>();
  let orderNumber = 1000;

  // Batch arrays
  const orderBatch: Prisma.OrderCreateManyInput[] = [];
  const lineItemBatch: Prisma.OrderLineItemCreateManyInput[] = [];
  const shippingBatch: Prisma.ShippingCostCreateManyInput[] = [];

  for (let dayOffset = DAYS_BACK; dayOffset >= 0; dayOffset--) {
    const date = daysAgo(dayOffset);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    // Weekday/weekend seasonality
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseOrders = isWeekend ? 35 : 55;

    // Growth trend: +0.3% per day
    const growthFactor = 1 + (DAYS_BACK - dayOffset) * 0.003;

    // Some random variance
    const variance = randomBetween(0.75, 1.25);
    const orderCount = Math.round(baseOrders * growthFactor * variance);

    for (let i = 0; i < orderCount; i++) {
      const orderId = uuid();
      orderNumber++;

      // Pick 1-4 line items
      const numItems = weightedPick([1, 2, 3, 4], [45, 35, 15, 5]);
      const chosenVariants: Set<number> = new Set();
      while (chosenVariants.size < numItems) {
        // Weighted random selection of variant index
        const totalW = VARIANT_WEIGHTS.reduce((a, b) => a + b, 0);
        let r = seededRandom() * totalW;
        let idx = 0;
        for (let j = 0; j < FLAT_VARIANTS.length; j++) {
          r -= VARIANT_WEIGHTS[j];
          if (r <= 0) {
            idx = j;
            break;
          }
        }
        chosenVariants.add(idx);
      }

      let subtotal = 0;
      let totalCogs = 0;

      for (const varIdx of chosenVariants) {
        const fv = FLAT_VARIANTS[varIdx];
        const qty = weightedPick([1, 2, 3], [70, 25, 5]);
        const lineTotal = round2(fv.price * qty);
        const lineCogs = round2(fv.cogs * qty);
        subtotal += lineTotal;
        totalCogs += lineCogs;

        lineItemBatch.push({
          id: uuid(),
          orgId: ORG_ID,
          orderId,
          productVariantId: orderedVariantIds[varIdx],
          externalId: `li-${orderId}-${varIdx}`,
          title: `${PRODUCTS[fv.productIndex].title} - ${PRODUCTS[fv.productIndex].variants[fv.variantIndex].title}`,
          sku: fv.sku,
          quantity: qty,
          unitPrice: new Prisma.Decimal(fv.price),
          totalDiscount: new Prisma.Decimal(0),
          lineTotal: new Prisma.Decimal(lineTotal),
          unitCogs: new Prisma.Decimal(fv.cogs),
          lineCogs: new Prisma.Decimal(lineCogs),
        });
      }

      // Discount (15% of orders)
      const hasDiscount = seededRandom() < 0.15;
      let discountAmount = 0;
      const discountCodes: Prisma.InputJsonValue[] = [];
      if (hasDiscount) {
        const code = pick(DISCOUNT_CODES);
        const pct = parseInt(code.replace(/\D/g, ''), 10) || 10;
        discountAmount = round2(subtotal * pct / 100);
        discountCodes.push({ code, amount: discountAmount, type: 'percentage' });
      }

      const totalPrice = round2(Math.max(subtotal - discountAmount, 0));

      // Refund status (4% refund rate)
      const isRefunded = seededRandom() < 0.04;
      const financialStatus = isRefunded
        ? (seededRandom() < 0.5 ? 'refunded' : 'partially_refunded')
        : 'paid';
      const totalRefunded = isRefunded
        ? (financialStatus === 'refunded' ? totalPrice : round2(totalPrice * randomBetween(0.2, 0.8)))
        : 0;

      // Customer tracking
      const customerEmail = `customer${randomInt(1, 3000)}@example.com`;
      const emailHash = customerEmail; // simplified for seed
      const isFirstOrder = !seenCustomers.has(customerEmail);
      if (isFirstOrder) seenCustomers.add(customerEmail);

      const country = weightedPick(COUNTRY_CODES, COUNTRY_WEIGHTS);
      const gateway = weightedPick(GATEWAYS, GATEWAY_WEIGHTS);

      // Place order at a random hour
      const placedAt = new Date(date);
      placedAt.setHours(randomInt(6, 23), randomInt(0, 59), randomInt(0, 59));

      orderBatch.push({
        id: orderId,
        orgId: ORG_ID,
        shopId: SHOP_ID,
        externalId: `shopify-order-${orderNumber}`,
        orderNumber: `#${orderNumber}`,
        status: 'closed',
        financialStatus: financialStatus as any,
        fulfillmentStatus: 'fulfilled',
        customerId: `cust-${customerEmail.split('@')[0]}`,
        emailHash,
        currency: 'USD',
        subtotalPrice: new Prisma.Decimal(subtotal),
        totalDiscounts: new Prisma.Decimal(discountAmount),
        totalShipping: new Prisma.Decimal(0),
        totalTax: new Prisma.Decimal(round2(totalPrice * 0.08)),
        totalPrice: new Prisma.Decimal(totalPrice),
        totalRefunded: new Prisma.Decimal(totalRefunded),
        paymentGateway: gateway,
        isFirstOrder,
        sourceName: 'web',
        countryCode: country,
        discountCodes,
        placedAt,
      });

      // Shipping cost
      const shippingCost = totalPrice >= 50 ? randomBetween(3, 6) : randomBetween(5, 10);
      shippingBatch.push({
        id: uuid(),
        orgId: ORG_ID,
        orderId,
        carrier: pick(['USPS', 'UPS', 'FedEx', 'DHL']),
        method: pick(['Ground', 'Priority', 'Express']),
        actualCost: new Prisma.Decimal(round2(shippingCost)),
        currency: 'USD',
      });
    }
  }

  // Batch insert orders
  console.log(`Inserting ${orderBatch.length} orders...`);
  const ORDER_CHUNK = 500;
  for (let i = 0; i < orderBatch.length; i += ORDER_CHUNK) {
    await prisma.order.createMany({
      data: orderBatch.slice(i, i + ORDER_CHUNK),
      skipDuplicates: true,
    });
  }

  // Batch insert line items
  console.log(`Inserting ${lineItemBatch.length} line items...`);
  for (let i = 0; i < lineItemBatch.length; i += ORDER_CHUNK) {
    await prisma.orderLineItem.createMany({
      data: lineItemBatch.slice(i, i + ORDER_CHUNK),
      skipDuplicates: true,
    });
  }

  // Batch insert shipping
  console.log(`Inserting ${shippingBatch.length} shipping costs...`);
  for (let i = 0; i < shippingBatch.length; i += ORDER_CHUNK) {
    await prisma.shippingCost.createMany({
      data: shippingBatch.slice(i, i + ORDER_CHUNK),
      skipDuplicates: true,
    });
  }

  // =========================================================================
  // 11. Ad Metrics (last 90 days)
  // =========================================================================
  console.log('Creating ad metrics...');
  const adMetricBatch: Prisma.AdMetricCreateManyInput[] = [];

  for (let dayOffset = DAYS_BACK; dayOffset >= 0; dayOffset--) {
    const date = daysAgo(dayOffset);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Meta campaigns
    for (let ci = 0; ci < META_CAMPAIGNS.length; ci++) {
      const c = META_CAMPAIGNS[ci];
      const weekendFactor = isWeekend ? 0.85 : 1.0;
      const trendFactor = 1 + (DAYS_BACK - dayOffset) * 0.002;
      const variance = randomBetween(0.8, 1.2);

      const spend = round2(c.dailyBudget * weekendFactor * trendFactor * variance);
      const roas = c.roasBase * randomBetween(0.7, 1.3);
      const impressions = Math.round(spend * randomBetween(80, 150));
      const ctr = randomBetween(0.8, 2.5) / 100;
      const clicks = Math.round(impressions * ctr);
      const conversionRate = randomBetween(2, 5) / 100;
      const conversions = Math.round(clicks * conversionRate);
      const conversionValue = round2(spend * roas);

      adMetricBatch.push({
        id: uuid(),
        orgId: ORG_ID,
        adAccountId: META_AD_ACCOUNT_ID,
        campaignId: metaCampaignIds[ci],
        date,
        platform: 'meta',
        spend: new Prisma.Decimal(spend),
        impressions,
        clicks,
        conversions,
        conversionValue: new Prisma.Decimal(conversionValue),
        cpc: new Prisma.Decimal(round2(clicks > 0 ? spend / clicks : 0)),
        cpm: new Prisma.Decimal(round2(impressions > 0 ? (spend / impressions) * 1000 : 0)),
        ctr: new Prisma.Decimal(round2(impressions > 0 ? (clicks / impressions) * 100 : 0)),
        roasPlatformReported: new Prisma.Decimal(round2(roas)),
        currency: 'USD',
      });
    }

    // Google campaigns
    for (let ci = 0; ci < GOOGLE_CAMPAIGNS.length; ci++) {
      const c = GOOGLE_CAMPAIGNS[ci];
      const weekendFactor = isWeekend ? 0.9 : 1.0;
      const trendFactor = 1 + (DAYS_BACK - dayOffset) * 0.0015;
      const variance = randomBetween(0.8, 1.2);

      const spend = round2(c.dailyBudget * weekendFactor * trendFactor * variance);
      const roas = c.roasBase * randomBetween(0.7, 1.3);
      const impressions = Math.round(spend * randomBetween(40, 100));
      const ctr = randomBetween(2, 6) / 100;
      const clicks = Math.round(impressions * ctr);
      const conversionRate = randomBetween(3, 7) / 100;
      const conversions = Math.round(clicks * conversionRate);
      const conversionValue = round2(spend * roas);

      adMetricBatch.push({
        id: uuid(),
        orgId: ORG_ID,
        adAccountId: GOOGLE_AD_ACCOUNT_ID,
        campaignId: googleCampaignIds[ci],
        date,
        platform: 'google',
        spend: new Prisma.Decimal(spend),
        impressions,
        clicks,
        conversions,
        conversionValue: new Prisma.Decimal(conversionValue),
        cpc: new Prisma.Decimal(round2(clicks > 0 ? spend / clicks : 0)),
        cpm: new Prisma.Decimal(round2(impressions > 0 ? (spend / impressions) * 1000 : 0)),
        ctr: new Prisma.Decimal(round2(impressions > 0 ? (clicks / impressions) * 100 : 0)),
        roasPlatformReported: new Prisma.Decimal(round2(roas)),
        currency: 'USD',
      });
    }
  }

  console.log(`Inserting ${adMetricBatch.length} ad metrics...`);
  for (let i = 0; i < adMetricBatch.length; i += ORDER_CHUNK) {
    await prisma.adMetric.createMany({
      data: adMetricBatch.slice(i, i + ORDER_CHUNK),
      skipDuplicates: true,
    });
  }

  // =========================================================================
  // 12. Pre-calculate DailyAggregates
  // =========================================================================
  console.log('Calculating daily aggregates...');

  // Get payment configs for fee calculation
  const paymentConfigs = await prisma.paymentMethodConfig.findMany({
    where: { orgId: ORG_ID, isActive: true },
  });

  // Get fixed costs
  const fixedCosts = await prisma.fixedCost.findMany({
    where: { orgId: ORG_ID },
  });

  const aggregateBatch: Prisma.DailyAggregateCreateManyInput[] = [];

  for (let dayOffset = DAYS_BACK; dayOffset >= 0; dayOffset--) {
    const date = daysAgo(dayOffset);
    const dateS = dateStr(date);

    // Calculate order metrics for this day from our batch data
    const dayOrders = orderBatch.filter((o) => {
      const placedDate = new Date(o.placedAt as Date);
      return placedDate.toISOString().slice(0, 10) === dateS;
    });

    let grossRevenue = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let totalCogs = 0;
    let totalShippingCost = 0;
    let orderCount = 0;
    let unitsSold = 0;
    let newCustomerCount = 0;
    let returningCustomerCount = 0;
    let refundCount = 0;
    let totalPaymentFees = 0;

    for (const order of dayOrders) {
      orderCount++;
      grossRevenue += Number(order.totalPrice);
      totalDiscounts += Number(order.totalDiscounts);
      totalRefunds += Number(order.totalRefunded);

      if (order.isFirstOrder) newCustomerCount++;
      else returningCustomerCount++;

      if (order.financialStatus === 'refunded' || order.financialStatus === 'partially_refunded') {
        refundCount++;
      }

      // Payment fee
      const orderTotal = Number(order.totalPrice);
      const gateway = order.paymentGateway ?? '';
      const config = paymentConfigs.find(
        (c) => c.gatewayName.toLowerCase() === gateway.toLowerCase(),
      ) || paymentConfigs[0];
      if (config) {
        const pct = Number(config.feePercentage);
        const fixed = Number(config.feeFixedAmount);
        totalPaymentFees += round2((orderTotal * pct) / 100 + fixed);
      }

      // Line items for this order
      const orderLines = lineItemBatch.filter((li) => li.orderId === order.id);
      for (const li of orderLines) {
        unitsSold += li.quantity;
        totalCogs += Number(li.lineCogs);
      }

      // Shipping for this order
      const orderShipping = shippingBatch.filter((s) => s.orderId === order.id);
      for (const s of orderShipping) {
        totalShippingCost += Number(s.actualCost);
      }
    }

    // Ad spend for this day
    const dayAdMetrics = adMetricBatch.filter(
      (m) => new Date(m.date as Date).toISOString().slice(0, 10) === dateS,
    );
    const metaSpend = dayAdMetrics
      .filter((m) => m.platform === 'meta')
      .reduce((sum, m) => sum + Number(m.spend), 0);
    const googleSpend = dayAdMetrics
      .filter((m) => m.platform === 'google')
      .reduce((sum, m) => sum + Number(m.spend), 0);
    const totalAdSpend = metaSpend + googleSpend;

    // Fixed costs prorated daily
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    let dailyFixedCosts = 0;
    for (const fc of fixedCosts) {
      const amount = Number(fc.amount);
      switch (fc.recurrence) {
        case 'monthly':
          dailyFixedCosts += amount / daysInMonth;
          break;
        case 'weekly':
          dailyFixedCosts += amount / 7;
          break;
        case 'quarterly':
          dailyFixedCosts += amount / (365.25 / 4);
          break;
        case 'annual':
          dailyFixedCosts += amount / 365.25;
          break;
      }
    }
    dailyFixedCosts = round2(dailyFixedCosts);

    // Derived metrics
    const netRevenue = grossRevenue - totalDiscounts - totalRefunds;
    const grossProfit = netRevenue - totalCogs;
    const contributionMargin = grossProfit - totalAdSpend - totalShippingCost - totalPaymentFees;
    const netProfit = contributionMargin - dailyFixedCosts;
    const avgOrderValue = orderCount > 0 ? round2(netRevenue / orderCount) : 0;
    const refundRate = orderCount > 0 ? refundCount / orderCount : 0;
    const blendedRoas = totalAdSpend > 0 ? round2(netRevenue / totalAdSpend) : null;
    const blendedCac = newCustomerCount > 0 ? round2(totalAdSpend / newCustomerCount) : null;

    // "all" channel aggregate
    aggregateBatch.push({
      orgId: ORG_ID,
      date,
      channel: 'all',
      grossRevenue: new Prisma.Decimal(round2(grossRevenue)),
      netRevenue: new Prisma.Decimal(round2(netRevenue)),
      totalCogs: new Prisma.Decimal(round2(totalCogs)),
      totalAdSpend: new Prisma.Decimal(round2(totalAdSpend)),
      totalShippingCost: new Prisma.Decimal(round2(totalShippingCost)),
      totalPaymentFees: new Prisma.Decimal(round2(totalPaymentFees)),
      totalRefunds: new Prisma.Decimal(round2(totalRefunds)),
      totalDiscounts: new Prisma.Decimal(round2(totalDiscounts)),
      totalFixedCostsAllocated: new Prisma.Decimal(dailyFixedCosts),
      grossProfit: new Prisma.Decimal(round2(grossProfit)),
      contributionMargin: new Prisma.Decimal(round2(contributionMargin)),
      netProfit: new Prisma.Decimal(round2(netProfit)),
      orderCount,
      unitsSold,
      newCustomerCount,
      returningCustomerCount,
      avgOrderValue: new Prisma.Decimal(avgOrderValue),
      refundCount,
      refundRate: new Prisma.Decimal(refundRate.toFixed(6)),
      blendedRoas: blendedRoas !== null ? new Prisma.Decimal(blendedRoas) : null,
      blendedCac: blendedCac !== null ? new Prisma.Decimal(blendedCac) : null,
    });

    // shopify_dtc channel (same order data, no ad spend)
    const dtcNetRevenue = netRevenue;
    const dtcGrossProfit = dtcNetRevenue - totalCogs;
    const dtcContributionMargin = dtcGrossProfit - totalShippingCost - totalPaymentFees;
    const dtcNetProfit = dtcContributionMargin - dailyFixedCosts;

    aggregateBatch.push({
      orgId: ORG_ID,
      date,
      channel: 'shopify_dtc',
      grossRevenue: new Prisma.Decimal(round2(grossRevenue)),
      netRevenue: new Prisma.Decimal(round2(dtcNetRevenue)),
      totalCogs: new Prisma.Decimal(round2(totalCogs)),
      totalAdSpend: new Prisma.Decimal(0),
      totalShippingCost: new Prisma.Decimal(round2(totalShippingCost)),
      totalPaymentFees: new Prisma.Decimal(round2(totalPaymentFees)),
      totalRefunds: new Prisma.Decimal(round2(totalRefunds)),
      totalDiscounts: new Prisma.Decimal(round2(totalDiscounts)),
      totalFixedCostsAllocated: new Prisma.Decimal(dailyFixedCosts),
      grossProfit: new Prisma.Decimal(round2(dtcGrossProfit)),
      contributionMargin: new Prisma.Decimal(round2(dtcContributionMargin)),
      netProfit: new Prisma.Decimal(round2(dtcNetProfit)),
      orderCount,
      unitsSold,
      newCustomerCount,
      returningCustomerCount,
      avgOrderValue: new Prisma.Decimal(avgOrderValue),
      refundCount,
      refundRate: new Prisma.Decimal(refundRate.toFixed(6)),
      blendedRoas: null,
      blendedCac: null,
    });

    // meta_ads channel
    if (metaSpend > 0) {
      aggregateBatch.push({
        orgId: ORG_ID,
        date,
        channel: 'meta_ads',
        grossRevenue: new Prisma.Decimal(0),
        netRevenue: new Prisma.Decimal(0),
        totalCogs: new Prisma.Decimal(0),
        totalAdSpend: new Prisma.Decimal(round2(metaSpend)),
        totalShippingCost: new Prisma.Decimal(0),
        totalPaymentFees: new Prisma.Decimal(0),
        totalRefunds: new Prisma.Decimal(0),
        totalDiscounts: new Prisma.Decimal(0),
        totalFixedCostsAllocated: new Prisma.Decimal(0),
        grossProfit: new Prisma.Decimal(0),
        contributionMargin: new Prisma.Decimal(round2(-metaSpend)),
        netProfit: new Prisma.Decimal(round2(-metaSpend)),
        orderCount: 0,
        unitsSold: 0,
        newCustomerCount: 0,
        returningCustomerCount: 0,
        avgOrderValue: new Prisma.Decimal(0),
        refundCount: 0,
        refundRate: new Prisma.Decimal('0'),
        blendedRoas: netRevenue > 0 && metaSpend > 0 ? new Prisma.Decimal(round2(netRevenue / metaSpend)) : null,
        blendedCac: null,
      });
    }

    // google_ads channel
    if (googleSpend > 0) {
      aggregateBatch.push({
        orgId: ORG_ID,
        date,
        channel: 'google_ads',
        grossRevenue: new Prisma.Decimal(0),
        netRevenue: new Prisma.Decimal(0),
        totalCogs: new Prisma.Decimal(0),
        totalAdSpend: new Prisma.Decimal(round2(googleSpend)),
        totalShippingCost: new Prisma.Decimal(0),
        totalPaymentFees: new Prisma.Decimal(0),
        totalRefunds: new Prisma.Decimal(0),
        totalDiscounts: new Prisma.Decimal(0),
        totalFixedCostsAllocated: new Prisma.Decimal(0),
        grossProfit: new Prisma.Decimal(0),
        contributionMargin: new Prisma.Decimal(round2(-googleSpend)),
        netProfit: new Prisma.Decimal(round2(-googleSpend)),
        orderCount: 0,
        unitsSold: 0,
        newCustomerCount: 0,
        returningCustomerCount: 0,
        avgOrderValue: new Prisma.Decimal(0),
        refundCount: 0,
        refundRate: new Prisma.Decimal('0'),
        blendedRoas: netRevenue > 0 && googleSpend > 0 ? new Prisma.Decimal(round2(netRevenue / googleSpend)) : null,
        blendedCac: null,
      });
    }

    // amazon channel — marketplace revenue with fees, no ad spend
    const amazonRevBase = grossRevenue * 0.35; // ~35% of Shopify revenue
    const amazonVariance = 0.85 + Math.random() * 0.3; // 85%-115% daily variance
    const amazonGrossRevenue = round2(amazonRevBase * amazonVariance);
    const amazonCogs = round2(amazonGrossRevenue * 0.32);
    const amazonFees = round2(amazonGrossRevenue * 0.15); // Amazon referral + FBA fees
    const amazonShipping = round2(amazonGrossRevenue * 0.05);
    const amazonRefunds = round2(amazonGrossRevenue * 0.03);
    const amazonDiscounts = round2(amazonGrossRevenue * 0.02);
    const amazonNetRevenue = round2(amazonGrossRevenue - amazonDiscounts - amazonRefunds);
    const amazonGrossProfit = round2(amazonNetRevenue - amazonCogs);
    const amazonContributionMargin = round2(amazonGrossProfit - amazonShipping - amazonFees);
    const amazonNetProfit = round2(amazonContributionMargin);
    const amazonOrders = Math.max(1, Math.floor(orderCount * 0.3));
    const amazonUnits = Math.max(1, Math.floor(unitsSold * 0.3));
    const amazonNewCustomers = Math.max(0, Math.floor(amazonOrders * 0.45));
    const amazonReturning = amazonOrders - amazonNewCustomers;
    const amazonRefundCount = Math.floor(amazonOrders * 0.04);
    const amazonAov = amazonOrders > 0 ? round2(amazonNetRevenue / amazonOrders) : 0;

    aggregateBatch.push({
      orgId: ORG_ID,
      date,
      channel: 'amazon',
      grossRevenue: new Prisma.Decimal(amazonGrossRevenue),
      netRevenue: new Prisma.Decimal(amazonNetRevenue),
      totalCogs: new Prisma.Decimal(amazonCogs),
      totalAdSpend: new Prisma.Decimal(0),
      totalShippingCost: new Prisma.Decimal(amazonShipping),
      totalPaymentFees: new Prisma.Decimal(amazonFees),
      totalRefunds: new Prisma.Decimal(amazonRefunds),
      totalDiscounts: new Prisma.Decimal(amazonDiscounts),
      totalFixedCostsAllocated: new Prisma.Decimal(0),
      grossProfit: new Prisma.Decimal(amazonGrossProfit),
      contributionMargin: new Prisma.Decimal(amazonContributionMargin),
      netProfit: new Prisma.Decimal(amazonNetProfit),
      orderCount: amazonOrders,
      unitsSold: amazonUnits,
      newCustomerCount: amazonNewCustomers,
      returningCustomerCount: amazonReturning,
      avgOrderValue: new Prisma.Decimal(amazonAov),
      refundCount: amazonRefundCount,
      refundRate: new Prisma.Decimal(amazonOrders > 0 ? (amazonRefundCount / amazonOrders).toFixed(6) : '0'),
      blendedRoas: null,
      blendedCac: null,
    });

    // tiktok channel — smaller marketplace + ad-driven revenue
    const tiktokRevBase = grossRevenue * 0.15; // ~15% of Shopify revenue
    const tiktokVariance = 0.7 + Math.random() * 0.6; // 70%-130% higher variance
    const tiktokGrossRevenue = round2(tiktokRevBase * tiktokVariance);
    const tiktokAdSpend = round2(tiktokGrossRevenue * 0.25);
    const tiktokCogs = round2(tiktokGrossRevenue * 0.28);
    const tiktokFees = round2(tiktokGrossRevenue * 0.08); // TikTok Shop fees
    const tiktokShipping = round2(tiktokGrossRevenue * 0.06);
    const tiktokRefunds = round2(tiktokGrossRevenue * 0.04);
    const tiktokDiscounts = round2(tiktokGrossRevenue * 0.05);
    const tiktokNetRevenue = round2(tiktokGrossRevenue - tiktokDiscounts - tiktokRefunds);
    const tiktokGrossProfit = round2(tiktokNetRevenue - tiktokCogs);
    const tiktokContributionMargin = round2(tiktokGrossProfit - tiktokAdSpend - tiktokShipping - tiktokFees);
    const tiktokNetProfit = round2(tiktokContributionMargin);
    const tiktokOrders = Math.max(1, Math.floor(orderCount * 0.12));
    const tiktokUnits = Math.max(1, Math.floor(unitsSold * 0.12));
    const tiktokNewCustomers = Math.max(0, Math.floor(tiktokOrders * 0.65));
    const tiktokReturning = tiktokOrders - tiktokNewCustomers;
    const tiktokRefundCount = Math.floor(tiktokOrders * 0.05);
    const tiktokAov = tiktokOrders > 0 ? round2(tiktokNetRevenue / tiktokOrders) : 0;

    aggregateBatch.push({
      orgId: ORG_ID,
      date,
      channel: 'tiktok',
      grossRevenue: new Prisma.Decimal(tiktokGrossRevenue),
      netRevenue: new Prisma.Decimal(tiktokNetRevenue),
      totalCogs: new Prisma.Decimal(tiktokCogs),
      totalAdSpend: new Prisma.Decimal(tiktokAdSpend),
      totalShippingCost: new Prisma.Decimal(tiktokShipping),
      totalPaymentFees: new Prisma.Decimal(tiktokFees),
      totalRefunds: new Prisma.Decimal(tiktokRefunds),
      totalDiscounts: new Prisma.Decimal(tiktokDiscounts),
      totalFixedCostsAllocated: new Prisma.Decimal(0),
      grossProfit: new Prisma.Decimal(tiktokGrossProfit),
      contributionMargin: new Prisma.Decimal(tiktokContributionMargin),
      netProfit: new Prisma.Decimal(tiktokNetProfit),
      orderCount: tiktokOrders,
      unitsSold: tiktokUnits,
      newCustomerCount: tiktokNewCustomers,
      returningCustomerCount: tiktokReturning,
      avgOrderValue: new Prisma.Decimal(tiktokAov),
      refundCount: tiktokRefundCount,
      refundRate: new Prisma.Decimal(tiktokOrders > 0 ? (tiktokRefundCount / tiktokOrders).toFixed(6) : '0'),
      blendedRoas: tiktokAdSpend > 0 ? new Prisma.Decimal(round2(tiktokNetRevenue / tiktokAdSpend)) : null,
      blendedCac: tiktokNewCustomers > 0 ? new Prisma.Decimal(round2(tiktokAdSpend / tiktokNewCustomers)) : null,
    });
  }

  console.log(`Inserting ${aggregateBatch.length} daily aggregates...`);
  for (let i = 0; i < aggregateBatch.length; i += ORDER_CHUNK) {
    await prisma.dailyAggregate.createMany({
      data: aggregateBatch.slice(i, i + ORDER_CHUNK),
      skipDuplicates: true,
    });
  }

  // =========================================================================
  // 13. Sample Alerts
  // =========================================================================
  console.log('Creating sample alerts...');
  const alertDefs = [
    {
      type: 'roas_below' as const,
      severity: 'warning' as const,
      message: 'Meta Ads ROAS dropped below 2.0x threshold for the last 3 days',
      metric: 'blended_roas',
      threshold: 2.0,
      currentValue: 1.85,
      status: 'active' as const,
    },
    {
      type: 'cogs_missing' as const,
      severity: 'info' as const,
      message: '3 product variants are missing COGS data',
      metric: 'cogs_coverage',
      threshold: 100,
      currentValue: 92,
      status: 'acknowledged' as const,
    },
    {
      type: 'refund_spike' as const,
      severity: 'critical' as const,
      message: 'Refund rate spiked to 8.2% yesterday, above 5% threshold',
      metric: 'refund_rate',
      threshold: 5,
      currentValue: 8.2,
      status: 'active' as const,
    },
  ];

  for (const alert of alertDefs) {
    await prisma.alert.create({
      data: {
        orgId: ORG_ID,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        metric: alert.metric,
        threshold: new Prisma.Decimal(alert.threshold),
        currentValue: new Prisma.Decimal(alert.currentValue),
        status: alert.status,
      },
    });
  }

  // =========================================================================
  // 14. Sync Log
  // =========================================================================
  console.log('Creating sync log...');
  await prisma.syncLog.create({
    data: {
      orgId: ORG_ID,
      integrationId: SHOPIFY_INTEGRATION_ID,
      syncType: 'backfill',
      status: 'completed',
      recordsProcessed: orderBatch.length,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      durationMs: 58000,
    },
  });

  console.log('');
  console.log('=== Seed Complete ===');
  console.log(`  Organizations: 1`);
  console.log(`  Users: 1`);
  console.log(`  Products: ${PRODUCTS.length}`);
  console.log(`  Variants: ${variantIds.length}`);
  console.log(`  Orders: ${orderBatch.length}`);
  console.log(`  Line Items: ${lineItemBatch.length}`);
  console.log(`  Ad Metrics: ${adMetricBatch.length}`);
  console.log(`  Daily Aggregates: ${aggregateBatch.length}`);
  console.log(`  Fixed Costs: ${fixedCostDefs.length}`);
  console.log(`  Payment Methods: 2`);
  console.log(`  Alerts: ${alertDefs.length}`);
  console.log('');
}

main()
  .then(() => {
    console.log('Seed completed successfully.');
  })
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
