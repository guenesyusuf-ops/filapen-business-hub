/**
 * Brand Intelligence Seed Data
 *
 * Seeds 15 brands, 200 brand mentions, and updates influencer profiles
 * with branded content metrics.
 *
 * Usage: npx ts-node packages/database/prisma/seed-brands.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// ---------------------------------------------------------------------------
// Brand definitions
// ---------------------------------------------------------------------------

interface BrandDef {
  name: string;
  category: string;
  website: string;
  channels: string[];
  competitors: string[];
}

const BRANDS: BrandDef[] = [
  {
    name: 'Nike',
    category: 'Sports & Fitness',
    website: 'https://nike.com',
    channels: ['instagram', 'tiktok', 'youtube'],
    competitors: ['Adidas', 'Puma', 'Under Armour'],
  },
  {
    name: 'Gymshark',
    category: 'Sports & Fitness',
    website: 'https://gymshark.com',
    channels: ['instagram', 'tiktok', 'youtube'],
    competitors: ['Nike', 'Lululemon', 'Alphalete'],
  },
  {
    name: 'Glossier',
    category: 'Beauty & Skincare',
    website: 'https://glossier.com',
    channels: ['instagram', 'tiktok'],
    competitors: ['Fenty Beauty', 'Rare Beauty', 'The Ordinary'],
  },
  {
    name: 'Apple',
    category: 'Technology',
    website: 'https://apple.com',
    channels: ['youtube', 'instagram'],
    competitors: ['Samsung', 'Google', 'Microsoft'],
  },
  {
    name: 'Samsung',
    category: 'Technology',
    website: 'https://samsung.com',
    channels: ['youtube', 'instagram', 'tiktok'],
    competitors: ['Apple', 'Google', 'OnePlus'],
  },
  {
    name: 'Dyson',
    category: 'Home & Tech',
    website: 'https://dyson.com',
    channels: ['instagram', 'youtube', 'tiktok'],
    competitors: ['Shark', 'Philips', 'Braun'],
  },
  {
    name: 'Fenty Beauty',
    category: 'Beauty & Skincare',
    website: 'https://fentybeauty.com',
    channels: ['instagram', 'tiktok', 'youtube'],
    competitors: ['Glossier', 'Rare Beauty', 'MAC'],
  },
  {
    name: 'Lululemon',
    category: 'Athleisure',
    website: 'https://lululemon.com',
    channels: ['instagram', 'tiktok'],
    competitors: ['Gymshark', 'Alo Yoga', 'Nike'],
  },
  {
    name: 'Daniel Wellington',
    category: 'Fashion & Accessories',
    website: 'https://danielwellington.com',
    channels: ['instagram'],
    competitors: ['MVMT', 'Nordgreen', 'Fossil'],
  },
  {
    name: 'HelloFresh',
    category: 'Food & Beverage',
    website: 'https://hellofresh.com',
    channels: ['youtube', 'instagram', 'tiktok'],
    competitors: ['Blue Apron', 'Gousto', 'Freshly'],
  },
  {
    name: 'NordVPN',
    category: 'Technology',
    website: 'https://nordvpn.com',
    channels: ['youtube'],
    competitors: ['ExpressVPN', 'Surfshark', 'CyberGhost'],
  },
  {
    name: 'Sephora',
    category: 'Beauty & Skincare',
    website: 'https://sephora.com',
    channels: ['instagram', 'tiktok', 'youtube'],
    competitors: ['Ulta', 'Glossier', 'MAC'],
  },
  {
    name: 'Skims',
    category: 'Fashion & Apparel',
    website: 'https://skims.com',
    channels: ['instagram', 'tiktok'],
    competitors: ['Spanx', 'Lululemon', 'Savage X Fenty'],
  },
  {
    name: 'Audible',
    category: 'Entertainment',
    website: 'https://audible.com',
    channels: ['youtube', 'instagram'],
    competitors: ['Spotify', 'Apple Books', 'Scribd'],
  },
  {
    name: 'Airbnb',
    category: 'Travel & Hospitality',
    website: 'https://airbnb.com',
    channels: ['instagram', 'tiktok', 'youtube'],
    competitors: ['Booking.com', 'Vrbo', 'Hotels.com'],
  },
];

const MENTION_TYPES = ['organic', 'paid', 'link', 'affiliate'];
const MENTION_TYPE_WEIGHTS = [0.6, 0.25, 0.1, 0.05]; // cumulative: 0.6, 0.85, 0.95, 1.0

function pickMentionType(): string {
  const r = Math.random();
  if (r < 0.6) return 'organic';
  if (r < 0.85) return 'paid';
  if (r < 0.95) return 'link';
  return 'affiliate';
}

const POSTING_FREQUENCIES = [
  '1.5 posts/week',
  '2.0 posts/week',
  '3.0 posts/week',
  '4.2 posts/week',
  '5.0 posts/week',
  '6.5 posts/week',
  '7.0 posts/week',
  '1.0 posts/day',
  '2.0 posts/day',
];

const CONTENT_CATEGORIES_MAP: Record<string, string[]> = {
  Beauty: ['Skincare', 'Makeup', 'Haircare', 'Beauty Tips', 'Product Reviews'],
  Fitness: ['Workouts', 'Nutrition', 'Supplements', 'Gym Life', 'Yoga'],
  Tech: ['Gadgets', 'Software', 'AI', 'Unboxing', 'Tutorials'],
  Fashion: ['OOTD', 'Streetwear', 'Luxury', 'Sustainable', 'Accessories'],
  Food: ['Recipes', 'Restaurant Reviews', 'Cooking Tips', 'Baking', 'Meal Prep'],
  Travel: ['Adventures', 'Hotel Reviews', 'Budget Travel', 'Destinations', 'Road Trips'],
  Gaming: ['Gameplay', 'Reviews', 'Esports', 'Indie Games', 'Streaming'],
  Lifestyle: ['Daily Vlogs', 'Home Decor', 'Productivity', 'Wellness', 'Family'],
};

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding brand intelligence data...');

  // Clean existing brand data
  await prisma.brandMention.deleteMany({
    where: { brand: { orgId: ORG_ID } },
  });
  await prisma.brand.deleteMany({ where: { orgId: ORG_ID } });

  // Create brands
  const createdBrands = [];
  for (const def of BRANDS) {
    const brand = await prisma.brand.create({
      data: {
        orgId: ORG_ID,
        name: def.name,
        category: def.category,
        website: def.website,
        channels: def.channels,
        competitors: def.competitors,
      },
    });
    createdBrands.push({ ...brand, def });
  }
  console.log(`Created ${createdBrands.length} brands.`);

  // Get all influencer profiles
  const influencers = await prisma.influencerProfile.findMany({
    where: { orgId: ORG_ID },
  });

  if (influencers.length === 0) {
    console.log('No influencer profiles found. Run seed-influencers.ts first.');
    return;
  }

  console.log(`Found ${influencers.length} influencer profiles.`);

  // Create 200 brand mentions
  let mentionCount = 0;
  const now = new Date();

  for (const brandData of createdBrands) {
    const brand = brandData;
    const def = brandData.def;

    // Each brand gets 5-15 influencers
    const numInfluencers = randInt(5, 15);
    const shuffled = [...influencers].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, numInfluencers);

    for (const influencer of selected) {
      // Each influencer-brand pair gets 1-4 mentions
      const numMentions = randInt(1, 4);

      for (let m = 0; m < numMentions; m++) {
        if (mentionCount >= 200) break;

        // Random date within last 12 months
        const daysAgo = randInt(1, 365);
        const mentionDate = new Date(now);
        mentionDate.setDate(mentionDate.getDate() - daysAgo);

        const mentionPlatform = pick(def.channels);

        await prisma.brandMention.create({
          data: {
            orgId: ORG_ID,
            brandId: brand.id,
            influencerProfileId: influencer.id,
            type: pickMentionType(),
            platform: mentionPlatform,
            postUrl: `https://${mentionPlatform}.com/p/${Math.random().toString(36).slice(2, 10)}`,
            mentionDate,
            engagementRate: new Prisma.Decimal(randFloat(1, 12)),
            estimatedReach: Math.round(influencer.followerCount * randFloat(0.05, 0.4)),
          },
        });

        mentionCount++;
      }

      if (mentionCount >= 200) break;
    }

    if (mentionCount >= 200) break;
  }

  console.log(`Created ${mentionCount} brand mentions.`);

  // Update influencer profiles with branded content metrics
  for (const influencer of influencers) {
    const mentionCountForInf = await prisma.brandMention.count({
      where: { influencerProfileId: influencer.id },
    });

    const niche = influencer.niche || 'Lifestyle';
    const categories = CONTENT_CATEGORIES_MAP[niche] || CONTENT_CATEGORIES_MAP.Lifestyle;
    const selectedCategories = categories
      .sort(() => Math.random() - 0.5)
      .slice(0, randInt(2, 4));

    await prisma.influencerProfile.update({
      where: { id: influencer.id },
      data: {
        brandedContentPct: new Prisma.Decimal(
          mentionCountForInf > 0
            ? randFloat(8, 45)
            : randFloat(0, 8),
        ),
        estimatedMediaValue: new Prisma.Decimal(
          influencer.followerCount > 500000
            ? randFloat(5000, 50000)
            : influencer.followerCount > 100000
              ? randFloat(1000, 15000)
              : influencer.followerCount > 50000
                ? randFloat(500, 5000)
                : randFloat(100, 2000),
        ),
        growthRate: new Prisma.Decimal(randFloat(-2, 15)),
        postingFrequency: pick(POSTING_FREQUENCIES),
        contentCategories: selectedCategories,
        brandFitScore: randInt(40, 98),
      },
    });
  }

  console.log('Updated influencer profiles with branded content metrics.');
  console.log('Brand intelligence seed complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
