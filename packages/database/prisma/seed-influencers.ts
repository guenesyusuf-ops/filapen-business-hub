/**
 * Influencer Hub Seed Data
 *
 * Seeds 100 influencer profiles across Instagram (50), TikTok (30), YouTube (20)
 * with realistic distributions, plus 3 watchlists.
 *
 * Usage: npx ts-node packages/database/prisma/seed-influencers.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Helper data
// ---------------------------------------------------------------------------

const NICHES = ['Beauty', 'Fitness', 'Tech', 'Fashion', 'Food', 'Travel', 'Gaming', 'Lifestyle'];

const LOCATIONS = [
  'Los Angeles, CA', 'New York, NY', 'Miami, FL', 'Austin, TX', 'Chicago, IL',
  'San Francisco, CA', 'London, UK', 'Berlin, DE', 'Toronto, CA', 'Sydney, AU',
  'Paris, FR', 'Seattle, WA', 'Atlanta, GA', 'Denver, CO', 'Nashville, TN',
];

const LANGUAGES = ['en', 'en', 'en', 'en', 'de', 'fr', 'es', 'pt', 'ja', 'ko'];

const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
  'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Luna', 'Daniel',
  'Ella', 'Matthew', 'Chloe', 'Sebastian', 'Aria', 'Jack', 'Scarlett',
  'Owen', 'Nora', 'Ryan', 'Zoey', 'Nathan', 'Riley', 'Leo', 'Lily',
  'Dylan', 'Layla', 'Caleb', 'Penelope', 'Isaac', 'Grace', 'Luke',
  'Stella', 'Jayden', 'Hazel', 'Julian', 'Violet', 'Gabriel',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
  'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts',
];

const NICHE_TAGS: Record<string, string[]> = {
  Beauty: ['skincare', 'makeup', 'beauty-tips', 'cosmetics', 'haircare'],
  Fitness: ['workout', 'gym', 'nutrition', 'health', 'yoga', 'crossfit'],
  Tech: ['gadgets', 'reviews', 'coding', 'ai', 'startups'],
  Fashion: ['ootd', 'streetwear', 'luxury', 'sustainable-fashion', 'style'],
  Food: ['recipes', 'foodie', 'cooking', 'restaurant-reviews', 'baking'],
  Travel: ['adventure', 'backpacking', 'luxury-travel', 'digital-nomad', 'hotels'],
  Gaming: ['streaming', 'esports', 'game-reviews', 'indie-games', 'fps'],
  Lifestyle: ['daily-vlog', 'home-decor', 'productivity', 'wellness', 'parenting'],
};

const AUDIENCE_COUNTRIES = [
  [
    { country: 'US', pct: 45 },
    { country: 'UK', pct: 15 },
    { country: 'CA', pct: 10 },
    { country: 'DE', pct: 8 },
    { country: 'AU', pct: 7 },
    { country: 'Other', pct: 15 },
  ],
  [
    { country: 'US', pct: 55 },
    { country: 'UK', pct: 12 },
    { country: 'CA', pct: 8 },
    { country: 'BR', pct: 6 },
    { country: 'Other', pct: 19 },
  ],
  [
    { country: 'US', pct: 35 },
    { country: 'DE', pct: 18 },
    { country: 'UK', pct: 14 },
    { country: 'FR', pct: 10 },
    { country: 'Other', pct: 23 },
  ],
  [
    { country: 'US', pct: 40 },
    { country: 'IN', pct: 12 },
    { country: 'UK', pct: 11 },
    { country: 'PH', pct: 9 },
    { country: 'Other', pct: 28 },
  ],
];

const AUDIENCE_AGES = [
  [
    { range: '13-17', pct: 8 },
    { range: '18-24', pct: 35 },
    { range: '25-34', pct: 32 },
    { range: '35-44', pct: 15 },
    { range: '45+', pct: 10 },
  ],
  [
    { range: '13-17', pct: 15 },
    { range: '18-24', pct: 40 },
    { range: '25-34', pct: 28 },
    { range: '35-44', pct: 12 },
    { range: '45+', pct: 5 },
  ],
  [
    { range: '13-17', pct: 5 },
    { range: '18-24', pct: 25 },
    { range: '25-34', pct: 38 },
    { range: '35-44', pct: 22 },
    { range: '45+', pct: 10 },
  ],
];

const AUDIENCE_GENDERS = [
  { male: 40, female: 55, other: 5 },
  { male: 55, female: 40, other: 5 },
  { male: 48, female: 47, other: 5 },
  { male: 30, female: 65, other: 5 },
  { male: 70, female: 25, other: 5 },
];

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

/**
 * Generate follower count with realistic distribution.
 * Most are micro (5K-50K), fewer mid (50K-500K), rare macro (500K-2M).
 */
function generateFollowerCount(): number {
  const r = Math.random();
  if (r < 0.55) {
    // Micro: 5K-50K (55%)
    return randInt(5000, 50000);
  } else if (r < 0.85) {
    // Mid-tier: 50K-500K (30%)
    return randInt(50000, 500000);
  } else {
    // Macro: 500K-2M (15%)
    return randInt(500000, 2000000);
  }
}

/**
 * Engagement rate inversely correlated with follower count.
 */
function generateEngagementRate(followers: number): number {
  if (followers < 10000) return randFloat(6, 12);
  if (followers < 50000) return randFloat(4, 9);
  if (followers < 100000) return randFloat(3, 7);
  if (followers < 500000) return randFloat(2, 5);
  return randFloat(1, 3.5);
}

function generateHandle(firstName: string, niche: string): string {
  const styles = [
    `${firstName.toLowerCase()}${niche.toLowerCase().slice(0, 4)}`,
    `the.${firstName.toLowerCase()}`,
    `${firstName.toLowerCase()}_official`,
    `${firstName.toLowerCase()}.${niche.toLowerCase()}`,
    `${niche.toLowerCase()}_${firstName.toLowerCase()}`,
    `just${firstName.toLowerCase()}`,
    `${firstName.toLowerCase()}creates`,
    `real${firstName.toLowerCase()}`,
  ];
  return pick(styles) + randInt(1, 99);
}

function generateBio(niche: string, platform: string): string {
  const bios: Record<string, string[]> = {
    Beauty: [
      'Beauty enthusiast sharing daily skincare & makeup routines',
      'Licensed esthetician | Clean beauty advocate | Skin first',
      'Your go-to for honest beauty reviews and tutorials',
    ],
    Fitness: [
      'Certified PT | Transform your body, transform your life',
      'Home workouts & meal prep | No gym needed',
      'Former athlete turned fitness content creator',
    ],
    Tech: [
      'Making tech simple for everyone | Reviews & tutorials',
      'Software engineer by day, tech reviewer by night',
      'Unboxing the future, one gadget at a time',
    ],
    Fashion: [
      'Curating looks that inspire | Sustainable fashion advocate',
      'Street style meets high fashion | Based in NYC',
      'Fashion is art. Style is personal.',
    ],
    Food: [
      'Home cook sharing easy recipes for busy people',
      'Food photographer | Restaurant reviews | Recipes',
      'From farm to table, every bite tells a story',
    ],
    Travel: [
      'Exploring the world one destination at a time',
      'Budget travel tips & hidden gems worldwide',
      'Digital nomad | 40+ countries | Adventure awaits',
    ],
    Gaming: [
      'Streamer & content creator | Competitive FPS player',
      'Indie game enthusiast | Reviews & gameplay',
      'Building communities one game at a time',
    ],
    Lifestyle: [
      'Living intentionally | Wellness, home & productivity',
      'Mom of 2 | Real life, real tips, real talk',
      'Sharing the art of everyday living',
    ],
  };
  return pick(bios[niche] || bios.Lifestyle);
}

function generateScore(followers: number, engagementRate: number): number {
  // Base score from engagement (higher engagement = higher score)
  let score = Math.min(engagementRate * 8, 50);
  // Bonus for follower count
  if (followers > 1000000) score += 25;
  else if (followers > 500000) score += 20;
  else if (followers > 100000) score += 15;
  else if (followers > 50000) score += 10;
  else score += 5;
  // Add some randomness
  score += randInt(-5, 15);
  return Math.max(30, Math.min(95, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

interface InfluencerSeed {
  platform: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
  engagementRate: Prisma.Decimal;
  avgLikes: number;
  avgComments: number;
  avgViews: number | null;
  niche: string;
  location: string;
  language: string;
  isVerified: boolean;
  email: string | null;
  websiteUrl: string | null;
  audienceCountry: any;
  audienceAge: any;
  audienceGender: any;
  score: number;
  tags: string[];
}

function generateInfluencers(count: number, platform: string): InfluencerSeed[] {
  const results: InfluencerSeed[] = [];
  const usedHandles = new Set<string>();

  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const displayName = `${firstName} ${lastName}`;
    const niche = pick(NICHES);
    let handle = generateHandle(firstName, niche);
    while (usedHandles.has(`${platform}:${handle}`)) {
      handle = generateHandle(firstName, niche) + randInt(100, 999);
    }
    usedHandles.add(`${platform}:${handle}`);

    const followers = generateFollowerCount();
    const engagement = generateEngagementRate(followers);
    const avgLikes = Math.round(followers * (engagement / 100) * randFloat(0.6, 0.9));
    const avgComments = Math.round(avgLikes * randFloat(0.02, 0.08));
    const hasEmail = Math.random() < 0.7;
    const isVerified = followers > 100000 && Math.random() < 0.4;

    const nicheTags = NICHE_TAGS[niche] || [];
    const selectedTags = nicheTags
      .sort(() => Math.random() - 0.5)
      .slice(0, randInt(2, 4));

    results.push({
      platform,
      handle,
      displayName,
      bio: generateBio(niche, platform),
      avatarUrl: null,
      followerCount: followers,
      followingCount: randInt(200, Math.min(followers * 0.1, 5000)),
      engagementRate: new Prisma.Decimal(engagement),
      avgLikes,
      avgComments,
      avgViews: platform === 'youtube' || platform === 'tiktok'
        ? Math.round(followers * randFloat(0.1, 0.4))
        : null,
      niche,
      location: pick(LOCATIONS),
      language: pick(LANGUAGES),
      isVerified,
      email: hasEmail
        ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
        : null,
      websiteUrl: Math.random() < 0.5
        ? `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.com`
        : null,
      audienceCountry: pick(AUDIENCE_COUNTRIES),
      audienceAge: pick(AUDIENCE_AGES),
      audienceGender: pick(AUDIENCE_GENDERS),
      score: generateScore(followers, engagement),
      tags: selectedTags,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding influencer data...');

  // Clean existing data for this org
  await prisma.watchlistItem.deleteMany({
    where: { watchlist: { orgId: ORG_ID } },
  });
  await prisma.watchlist.deleteMany({ where: { orgId: ORG_ID } });
  await prisma.influencerProfile.deleteMany({ where: { orgId: ORG_ID } });

  // Generate profiles
  const instagram = generateInfluencers(50, 'instagram');
  const tiktok = generateInfluencers(30, 'tiktok');
  const youtube = generateInfluencers(20, 'youtube');
  const allInfluencers = [...instagram, ...tiktok, ...youtube];

  console.log(`Creating ${allInfluencers.length} influencer profiles...`);

  const createdProfiles = [];
  for (const inf of allInfluencers) {
    const created = await prisma.influencerProfile.create({
      data: {
        orgId: ORG_ID,
        ...inf,
      },
    });
    createdProfiles.push(created);
  }

  console.log(`Created ${createdProfiles.length} influencer profiles.`);

  // Create watchlists
  const watchlistDefs = [
    {
      name: 'Top Performers Q1',
      description: 'High-engagement influencers for Q1 campaign collaboration',
    },
    {
      name: 'Beauty Campaign 2026',
      description: 'Beauty niche influencers shortlisted for summer product launch',
    },
    {
      name: 'Rising Stars',
      description: 'Micro-influencers with exceptional engagement rates',
    },
  ];

  for (const def of watchlistDefs) {
    const watchlist = await prisma.watchlist.create({
      data: {
        orgId: ORG_ID,
        name: def.name,
        description: def.description,
      },
    });

    // Add random influencers to watchlist
    const count = randInt(5, 15);
    const shuffled = [...createdProfiles].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    for (const inf of selected) {
      await prisma.watchlistItem.create({
        data: {
          watchlistId: watchlist.id,
          influencerProfileId: inf.id,
          notes: Math.random() < 0.3
            ? 'Great fit for upcoming campaign'
            : null,
        },
      });
    }

    console.log(`Watchlist "${def.name}" created with ${count} influencers.`);
  }

  console.log('Influencer seed complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
