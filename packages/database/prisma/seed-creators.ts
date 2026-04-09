/**
 * Creator Hub seed script (v2 - with uploads, comments, projects)
 * Run: DATABASE_URL="..." npx tsx packages/database/prisma/seed-creators.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Invite code generator
// ---------------------------------------------------------------------------

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Creator seed data (30 creators)
// ---------------------------------------------------------------------------

const compensationOptions = ['provision', 'fix', 'both'] as const;

const creators = [
  // 15 active
  { name: 'Sophia Martinez', email: 'sophia@creators.co', platform: 'instagram', handle: '@sophiamtz', followerCount: 245000, engagementRate: 4.2, niche: 'Beauty', location: 'Los Angeles, CA', ratePerPost: 1200, ratePerVideo: 1800, status: 'active', score: 88, tags: ['skincare', 'luxury'], kids: true, kidsAges: '3, 5', kidsOnVideo: false, compensation: 'both', provision: '10%', fixAmount: 1200 },
  { name: 'Jake Thompson', email: 'jake@ugcpro.com', platform: 'tiktok', handle: '@jakethompson', followerCount: 180000, engagementRate: 6.5, niche: 'Fitness', location: 'Miami, FL', ratePerPost: 800, ratePerVideo: 1400, status: 'active', score: 92, tags: ['gym', 'supplements'] },
  { name: 'Aria Chen', email: 'aria@techreviews.io', platform: 'youtube', handle: '@ariatechtips', followerCount: 320000, engagementRate: 3.8, niche: 'Tech', location: 'San Francisco, CA', ratePerPost: 1500, ratePerVideo: 2000, status: 'active', score: 95, tags: ['gadgets', 'reviews'] },
  { name: 'Lila Okafor', email: 'lila@fashionhub.co', platform: 'instagram', handle: '@lilastyle', followerCount: 410000, engagementRate: 5.1, niche: 'Fashion', location: 'New York, NY', ratePerPost: 1800, ratePerVideo: 2000, status: 'active', score: 90, tags: ['streetwear', 'luxury'] },
  { name: 'Marco Rossi', email: 'marco@foodcreators.com', platform: 'tiktok', handle: '@chefmarco', followerCount: 290000, engagementRate: 7.2, niche: 'Food', location: 'Chicago, IL', ratePerPost: 900, ratePerVideo: 1500, status: 'active', score: 87, tags: ['recipe', 'italian'] },
  { name: 'Priya Sharma', email: 'priya@beautytok.com', platform: 'tiktok', handle: '@priyabeauty', followerCount: 155000, engagementRate: 5.8, niche: 'Beauty', location: 'Austin, TX', ratePerPost: 600, ratePerVideo: 1000, status: 'active', score: 82, tags: ['makeup', 'tutorials'] },
  { name: 'Tyler Brooks', email: 'tyler@fitlife.co', platform: 'youtube', handle: '@tylerbrooks', followerCount: 95000, engagementRate: 4.5, niche: 'Fitness', location: 'Denver, CO', ratePerPost: 500, ratePerVideo: 900, status: 'active', score: 78, tags: ['crossfit', 'nutrition'] },
  { name: 'Zara Williams', email: 'zara@styleco.com', platform: 'instagram', handle: '@zarawstyle', followerCount: 500000, engagementRate: 3.2, niche: 'Fashion', location: 'London, UK', ratePerPost: 2000, ratePerVideo: 2000, status: 'active', score: 94, tags: ['high-fashion', 'editorial'] },
  { name: 'Noah Kim', email: 'noah@techbytes.io', platform: 'youtube', handle: '@noahkim_tech', followerCount: 220000, engagementRate: 4.0, niche: 'Tech', location: 'Seattle, WA', ratePerPost: 1000, ratePerVideo: 1700, status: 'active', score: 85, tags: ['smartphones', 'AI'] },
  { name: 'Emma Davis', email: 'emma@foodiegram.co', platform: 'instagram', handle: '@emmacooks', followerCount: 175000, engagementRate: 6.1, niche: 'Food', location: 'Portland, OR', ratePerPost: 700, ratePerVideo: 1200, status: 'active', score: 80, tags: ['vegan', 'healthy'] },
  { name: 'Rio Tanaka', email: 'rio@gamingzone.tv', platform: 'youtube', handle: '@riotanaka', followerCount: 380000, engagementRate: 3.5, niche: 'Tech', location: 'Tokyo, Japan', ratePerPost: 1300, ratePerVideo: 1900, status: 'active', score: 89, tags: ['gaming', 'tech'] },
  { name: 'Mia Johnson', email: 'mia@lifestyleguru.com', platform: 'tiktok', handle: '@mialifestyle', followerCount: 120000, engagementRate: 7.8, niche: 'Beauty', location: 'Nashville, TN', ratePerPost: 550, ratePerVideo: 950, status: 'active', score: 76, tags: ['skincare', 'wellness'] },
  { name: 'Kai Nakamura', email: 'kai@fitjapan.co', platform: 'instagram', handle: '@kaifit', followerCount: 88000, engagementRate: 5.5, niche: 'Fitness', location: 'Osaka, Japan', ratePerPost: 400, ratePerVideo: 750, status: 'active', score: 73, tags: ['martial-arts', 'yoga'] },
  { name: 'Olivia Brown', email: 'olivia@fashionforward.co', platform: 'tiktok', handle: '@oliviab_style', followerCount: 265000, engagementRate: 4.9, niche: 'Fashion', location: 'Atlanta, GA', ratePerPost: 1100, ratePerVideo: 1600, status: 'active', score: 86, tags: ['affordable', 'hauls'] },
  { name: 'Lucas Fernandez', email: 'lucas@tastytok.com', platform: 'tiktok', handle: '@lucascooks', followerCount: 340000, engagementRate: 8.0, niche: 'Food', location: 'Mexico City, MX', ratePerPost: 750, ratePerVideo: 1300, status: 'active', score: 91, tags: ['mexican', 'street-food'] },

  // 8 prospect
  { name: 'Hannah Lee', email: 'hannah@newcreators.co', platform: 'instagram', handle: '@hannahlee', followerCount: 45000, engagementRate: 3.1, niche: 'Beauty', location: 'Boston, MA', ratePerPost: 200, ratePerVideo: 400, status: 'prospect', score: 55, tags: ['indie'] },
  { name: 'Alex Rivera', email: 'alex@startupgram.co', platform: 'tiktok', handle: '@alexrivera', followerCount: 32000, engagementRate: 4.8, niche: 'Tech', location: 'Austin, TX', ratePerPost: 150, ratePerVideo: 300, status: 'prospect', score: 50, tags: ['startup'] },
  { name: 'Chloe Park', email: 'chloe@fitpark.co', platform: 'youtube', handle: '@chloepark', followerCount: 18000, engagementRate: 5.2, niche: 'Fitness', location: 'San Diego, CA', ratePerPost: 100, ratePerVideo: 250, status: 'prospect', score: 42, tags: ['pilates'] },
  { name: 'Derek Wang', email: 'derek@fashionfwd.co', platform: 'instagram', handle: '@derekwang', followerCount: 67000, engagementRate: 2.9, niche: 'Fashion', location: 'Toronto, CA', ratePerPost: 300, ratePerVideo: 500, status: 'prospect', score: 60, tags: ['menswear'] },
  { name: 'Nina Petrova', email: 'nina@foodtok.co', platform: 'tiktok', handle: '@ninapetrova', followerCount: 28000, engagementRate: 6.3, niche: 'Food', location: 'Berlin, DE', ratePerPost: 120, ratePerVideo: 280, status: 'prospect', score: 48, tags: ['baking'] },
  { name: 'Sam Anderson', email: 'sam@techanderson.co', platform: 'youtube', handle: '@samanderson', followerCount: 52000, engagementRate: 3.6, niche: 'Tech', location: 'Dallas, TX', ratePerPost: 250, ratePerVideo: 450, status: 'prospect', score: 57, tags: ['apps'] },
  { name: 'Ruby Chang', email: 'ruby@beautynova.co', platform: 'instagram', handle: '@rubychang', followerCount: 39000, engagementRate: 4.4, niche: 'Beauty', location: 'Vancouver, CA', ratePerPost: 180, ratePerVideo: 350, status: 'prospect', score: 52, tags: ['k-beauty'] },
  { name: 'Omar Hassan', email: 'omar@fitlife.ae', platform: 'tiktok', handle: '@omarfit', followerCount: 71000, engagementRate: 5.0, niche: 'Fitness', location: 'Dubai, UAE', ratePerPost: 350, ratePerVideo: 600, status: 'prospect', score: 62, tags: ['calisthenics'] },

  // 4 outreach
  { name: 'Isabella Torres', email: 'isabella@stylehaus.co', platform: 'instagram', handle: '@isabellastyle', followerCount: 130000, engagementRate: 4.7, niche: 'Fashion', location: 'Madrid, ES', ratePerPost: 650, ratePerVideo: 1100, status: 'outreach', score: 75, tags: ['european'] },
  { name: 'Ethan Moore', email: 'ethan@techmoore.co', platform: 'youtube', handle: '@ethanmoore', followerCount: 195000, engagementRate: 3.9, niche: 'Tech', location: 'Boston, MA', ratePerPost: 900, ratePerVideo: 1500, status: 'outreach', score: 81, tags: ['reviews'] },
  { name: 'Aaliyah Wilson', email: 'aaliyah@foodlove.co', platform: 'tiktok', handle: '@aaliyahcooks', followerCount: 85000, engagementRate: 6.8, niche: 'Food', location: 'Houston, TX', ratePerPost: 400, ratePerVideo: 700, status: 'outreach', score: 70, tags: ['southern'] },
  { name: 'James O\'Brien', email: 'james@fitobrien.co', platform: 'instagram', handle: '@jamesofit', followerCount: 110000, engagementRate: 4.1, niche: 'Fitness', location: 'Dublin, IE', ratePerPost: 500, ratePerVideo: 850, status: 'outreach', score: 72, tags: ['boxing'] },

  // 2 inactive
  { name: 'Grace Liu', email: 'grace@beautyliu.co', platform: 'youtube', handle: '@graceliu', followerCount: 60000, engagementRate: 1.8, niche: 'Beauty', location: 'Singapore, SG', ratePerPost: 300, ratePerVideo: 500, status: 'inactive', score: 40, tags: ['skincare'] },
  { name: 'David Patel', email: 'david@techpatel.co', platform: 'tiktok', handle: '@davidpatel', followerCount: 42000, engagementRate: 2.1, niche: 'Tech', location: 'Mumbai, IN', ratePerPost: 150, ratePerVideo: 300, status: 'inactive', score: 35, tags: ['budget'] },

  // 1 churned
  { name: 'Rachel Green', email: 'rachel@oldcreator.co', platform: 'instagram', handle: '@rachelgreen', followerCount: 15000, engagementRate: 1.5, niche: 'Fashion', location: 'Phoenix, AZ', ratePerPost: 100, ratePerVideo: 200, status: 'churned', score: 20, tags: ['vintage'] },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding Creator Hub data...');

  // Clean existing creator hub data
  await prisma.briefing.deleteMany({ where: { orgId: DEV_ORG_ID } });
  await prisma.deal.deleteMany({ where: { orgId: DEV_ORG_ID } });
  await prisma.creator.deleteMany({ where: { orgId: DEV_ORG_ID } });
  console.log('Cleaned existing creator hub data.');

  // Create creators with invite codes and new fields
  const usedCodes = new Set<string>();
  const createdCreators: any[] = [];
  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    while (usedCodes.has(inviteCode)) {
      inviteCode = generateInviteCode();
    }
    usedCodes.add(inviteCode);

    // Assign compensation to active creators
    const comp = (c as any).compensation || (c.status === 'active' ? compensationOptions[i % 3] : undefined);

    const creator = await prisma.creator.create({
      data: {
        orgId: DEV_ORG_ID,
        name: c.name,
        email: c.email,
        platform: c.platform,
        handle: c.handle,
        followerCount: c.followerCount,
        engagementRate: c.engagementRate,
        niche: c.niche,
        location: c.location,
        ratePerPost: c.ratePerPost,
        ratePerVideo: c.ratePerVideo,
        status: c.status as any,
        score: c.score,
        tags: c.tags,
        totalDeals: 0,
        totalSpend: 0,
        inviteCode,
        kids: (c as any).kids ?? (i % 5 === 0),
        kidsAges: (c as any).kidsAges || (i % 5 === 0 ? '2, 4' : null),
        kidsOnVideo: (c as any).kidsOnVideo ?? false,
        compensation: comp || null,
        provision: comp === 'provision' || comp === 'both' ? `${5 + (i % 10)}%` : null,
        fixAmount: comp === 'fix' || comp === 'both' ? c.ratePerPost : null,
        contracts: JSON.stringify([]),
        creatorNotes: c.status === 'active' ? `Welcome ${c.name.split(' ')[0]}! Please upload your content here.` : null,
      },
    });
    createdCreators.push(creator);
  }
  console.log(`Created ${createdCreators.length} creators.`);

  // Pick active creators for deals
  const activeCreators = createdCreators.filter((c) => c.status === 'active');

  // Deal definitions: 20 deals
  const dealDefs = [
    // 5 completed
    { creatorIdx: 0, title: 'Summer Skincare Campaign', type: 'ugc', stage: 'completed', amount: 2400, paymentStatus: 'paid', deadline: '2025-08-15', completedAt: new Date('2025-08-12') },
    { creatorIdx: 2, title: 'iPhone 16 Review', type: 'review', stage: 'completed', amount: 3000, paymentStatus: 'paid', deadline: '2025-09-20', completedAt: new Date('2025-09-18') },
    { creatorIdx: 3, title: 'Fall Collection Shoot', type: 'paid_post', stage: 'completed', amount: 3600, paymentStatus: 'paid', deadline: '2025-10-01', completedAt: new Date('2025-09-28') },
    { creatorIdx: 4, title: 'Recipe Video Series', type: 'ugc', stage: 'completed', amount: 2250, paymentStatus: 'paid', deadline: '2025-07-30', completedAt: new Date('2025-07-28') },
    { creatorIdx: 7, title: 'Holiday Lookbook', type: 'ambassador', stage: 'completed', amount: 4000, paymentStatus: 'paid', deadline: '2025-12-01', completedAt: new Date('2025-11-28') },

    // 4 in_progress
    { creatorIdx: 1, title: 'Pre-Workout Launch Campaign', type: 'ugc', stage: 'in_progress', amount: 1600, paymentStatus: 'pending', deadline: '2026-05-01' },
    { creatorIdx: 5, title: 'Spring Makeup Tutorial', type: 'ugc', stage: 'in_progress', amount: 1200, paymentStatus: 'pending', deadline: '2026-04-20' },
    { creatorIdx: 8, title: 'Galaxy S26 Unboxing', type: 'review', stage: 'in_progress', amount: 2000, paymentStatus: 'invoiced', deadline: '2026-04-25' },
    { creatorIdx: 9, title: 'Vegan Meal Prep Series', type: 'ugc', stage: 'in_progress', amount: 1400, paymentStatus: 'pending', deadline: '2026-04-30' },

    // 3 review
    { creatorIdx: 10, title: 'Gaming Keyboard Review', type: 'review', stage: 'review', amount: 2500, paymentStatus: 'pending', deadline: '2026-04-15' },
    { creatorIdx: 11, title: 'Moisturizer UGC Batch', type: 'ugc', stage: 'review', amount: 950, paymentStatus: 'pending', deadline: '2026-04-18' },
    { creatorIdx: 14, title: 'Taco Tuesday Collab', type: 'paid_post', stage: 'review', amount: 1300, paymentStatus: 'pending', deadline: '2026-04-12' },

    // 3 contracted
    { creatorIdx: 0, title: 'Winter Skincare Routine', type: 'ugc', stage: 'contracted', amount: 2400, paymentStatus: 'pending', deadline: '2026-06-01' },
    { creatorIdx: 3, title: 'Spring/Summer Haul', type: 'paid_post', stage: 'contracted', amount: 3200, paymentStatus: 'pending', deadline: '2026-05-15' },
    { creatorIdx: 6, title: 'Fitness Challenge Series', type: 'affiliate', stage: 'contracted', amount: 900, paymentStatus: 'pending', deadline: '2026-05-20' },

    // 2 negotiation
    { creatorIdx: 2, title: 'MacBook Pro M5 Review', type: 'review', stage: 'negotiation', amount: 3500, paymentStatus: 'pending', deadline: '2026-07-01' },
    { creatorIdx: 7, title: 'Paris Fashion Week Coverage', type: 'ambassador', stage: 'negotiation', amount: 5000, paymentStatus: 'pending', deadline: '2026-09-01' },

    // 2 outreach
    { creatorIdx: 12, title: 'Yoga Mat Campaign', type: 'ugc', stage: 'outreach', amount: 750, paymentStatus: 'pending', deadline: '2026-06-15' },
    { creatorIdx: 13, title: 'Budget Fashion Haul', type: 'paid_post', stage: 'outreach', amount: 1600, paymentStatus: 'pending', deadline: '2026-06-01' },

    // 1 lead
    { creatorIdx: 4, title: 'Italian Cooking Masterclass', type: 'ugc', stage: 'lead', amount: 2000, paymentStatus: 'pending', deadline: '2026-08-01' },
  ];

  const createdDeals: any[] = [];
  for (const d of dealDefs) {
    const creator = activeCreators[d.creatorIdx];
    const deal = await prisma.deal.create({
      data: {
        orgId: DEV_ORG_ID,
        creatorId: creator.id,
        title: d.title,
        type: d.type as any,
        stage: d.stage as any,
        amount: d.amount,
        paymentStatus: (d.paymentStatus || 'pending') as any,
        deadline: d.deadline ? new Date(d.deadline) : null,
        completedAt: (d as any).completedAt || null,
        deliverables: JSON.stringify([
          { type: 'video', count: 2, description: 'Short-form vertical video' },
          { type: 'photo', count: 3, description: 'Product lifestyle shots' },
        ]),
        tags: [],
      },
    });
    createdDeals.push(deal);
  }
  console.log(`Created ${createdDeals.length} deals.`);

  // Update creator stats for completed deals
  const completedDeals = dealDefs.filter((d) => d.stage === 'completed');
  const creatorDealCounts: Record<number, { count: number; spend: number }> = {};
  for (const d of dealDefs) {
    if (!creatorDealCounts[d.creatorIdx]) {
      creatorDealCounts[d.creatorIdx] = { count: 0, spend: 0 };
    }
    creatorDealCounts[d.creatorIdx].count++;
    if (d.stage === 'completed' && d.amount) {
      creatorDealCounts[d.creatorIdx].spend += d.amount;
    }
  }

  for (const [idxStr, stats] of Object.entries(creatorDealCounts)) {
    const idx = parseInt(idxStr, 10);
    const creator = activeCreators[idx];
    await prisma.creator.update({
      where: { id: creator.id },
      data: {
        totalDeals: stats.count,
        totalSpend: stats.spend,
      },
    });
  }
  console.log('Updated creator deal stats.');

  // Seed 5 briefings for in_progress and review deals
  const briefingDeals = createdDeals.filter(
    (d) => d.stage === 'in_progress' || d.stage === 'review',
  );

  const briefingDefs = [
    { dealIdx: 0, title: 'Pre-Workout Launch - Creative Brief', content: '## Objective\nShowcase the new pre-workout formula with high-energy workout content.\n\n## Key Messages\n- All-natural ingredients\n- No crash formula\n- Great taste\n\n## Requirements\n- 2x TikTok videos (60s)\n- 3x Instagram stories\n- Must tag @brand', guidelines: { dos: ['Show workout routine', 'Mention key ingredients'], donts: ['No competitor mentions', 'No health claims'], brand_voice: 'Energetic and authentic' }, status: 'sent' },
    { dealIdx: 1, title: 'Spring Makeup - Product Brief', content: '## Products\n- New Spring Palette (6 shades)\n- Setting Spray\n\n## Content Needs\n- Get-ready-with-me format\n- Before/after transformation\n- Close-up product application', guidelines: { dos: ['Use natural lighting', 'Show real skin texture'], donts: ['No heavy filters', 'No false eyelashes'], brand_voice: 'Natural beauty, inclusive' }, status: 'acknowledged' },
    { dealIdx: 2, title: 'Galaxy S26 - Review Guidelines', content: '## Review Focus Areas\n- Camera quality (photo + video)\n- Battery life (full day test)\n- Performance benchmarks\n- Design and build quality\n\n## Deliverables\n- 1x YouTube video (10-15 min)\n- 1x YouTube Shorts', guidelines: { dos: ['Compare with competitors', 'Show real-world usage'], donts: ['No paid promotion disclaimers missing', 'No unboxing only'], brand_voice: 'Technical but accessible' }, status: 'sent' },
    { dealIdx: 4, title: 'Gaming Keyboard - Review Brief', content: '## Product\nMechaKey Pro X1 - Mechanical Gaming Keyboard\n\n## Key Features to Highlight\n- Hot-swappable switches\n- RGB customization\n- Build quality\n- Typing/gaming sound test', guidelines: { dos: ['Include sound test', 'Compare key feel'], donts: ['No sponsored tag omission'], brand_voice: 'Enthusiast, detailed' }, status: 'draft' },
    { dealIdx: 3, title: 'Vegan Meal Prep - Content Guide', content: '## Theme\n5-day vegan meal prep under $50\n\n## Format\n- Recipe walkthrough\n- Shopping list overlay\n- Cost breakdown per meal\n\n## Audience\nHealth-conscious 25-35 year olds', guidelines: { dos: ['Show grocery shopping', 'Include nutritional info'], donts: ['No junk food alternatives', 'No sponsored feel'], brand_voice: 'Friendly, practical' }, status: 'sent' },
  ];

  for (const b of briefingDefs) {
    const deal = briefingDeals[b.dealIdx];
    if (!deal) continue;
    await prisma.briefing.create({
      data: {
        orgId: DEV_ORG_ID,
        dealId: deal.id,
        title: b.title,
        content: b.content,
        guidelines: b.guidelines,
        references: [],
        status: b.status as any,
      },
    });
  }
  console.log('Created 5 briefings.');

  // =========================================================================
  // Seed Creator Uploads (50 uploads across 10 creators)
  // =========================================================================

  // Clean existing uploads and comments
  await prisma.uploadComment.deleteMany({});
  await prisma.creatorUpload.deleteMany({ where: { orgId: DEV_ORG_ID } });
  await prisma.creatorProject.deleteMany({ where: { orgId: DEV_ORG_ID } });

  const tabs = ['bilder', 'videos', 'roh', 'auswertung'];
  const fileTypes = ['image', 'video', 'file', 'link'];
  const sampleImageUrls = [
    'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400',
    'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=400',
    'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
  ];

  const createdUploads: any[] = [];
  for (let i = 0; i < 50; i++) {
    const creatorIndex = i % 10; // spread across first 10 creators
    const creator = activeCreators[creatorIndex];
    if (!creator) continue;

    const tabIdx = Math.floor(i / 12.5); // roughly distribute across tabs
    const tab = tabs[tabIdx % tabs.length];
    const isImage = tab === 'bilder' || i % 3 === 0;
    const isVideo = tab === 'videos' && !isImage;
    const fileType = isImage ? 'image' : isVideo ? 'video' : i % 7 === 0 ? 'link' : 'file';
    const fileUrl = isImage
      ? sampleImageUrls[i % sampleImageUrls.length]
      : isVideo
        ? 'https://www.w3schools.com/html/mov_bbb.mp4'
        : i % 7 === 0
          ? 'https://www.youtube.com/watch?v=example'
          : 'https://example.com/document.pdf';

    const upload = await prisma.creatorUpload.create({
      data: {
        orgId: DEV_ORG_ID,
        creatorId: creator.id,
        fileName: `${creator.name.split(' ')[0].toLowerCase()}_${tab}_${i + 1}.${isImage ? 'jpg' : isVideo ? 'mp4' : 'pdf'}`,
        fileUrl,
        fileType,
        mimeType: isImage ? 'image/jpeg' : isVideo ? 'video/mp4' : 'application/pdf',
        fileSize: BigInt(Math.floor(Math.random() * 5000000) + 100000),
        tab,
        label: i % 3 === 0 ? `Draft ${Math.floor(i / 3) + 1}` : null,
        product: i % 4 === 0 ? 'Product A' : i % 4 === 1 ? 'Product B' : null,
        batch: i % 5 === 0 ? `Batch ${Math.ceil(i / 10)}` : null,
        seenByAdmin: i < 30, // first 30 are seen, last 20 not
      },
    });
    createdUploads.push(upload);
  }
  console.log(`Created ${createdUploads.length} uploads.`);

  // =========================================================================
  // Seed Upload Comments (20 comments)
  // =========================================================================

  const commentMessages = [
    { role: 'admin', name: 'Admin', msg: 'Great content! Can we adjust the lighting a bit?' },
    { role: 'creator', name: '', msg: 'Sure, I will redo the shot tomorrow.' },
    { role: 'admin', name: 'Admin', msg: 'The color grading looks perfect here.' },
    { role: 'creator', name: '', msg: 'Thanks! Shall I apply the same style to the other photos?' },
    { role: 'admin', name: 'Admin', msg: 'Yes please. Also add the product tag.' },
    { role: 'creator', name: '', msg: 'Done! Updated versions uploaded.' },
    { role: 'admin', name: 'Admin', msg: 'This video needs to be shorter, max 60 seconds.' },
    { role: 'creator', name: '', msg: 'Understood, trimming now.' },
    { role: 'admin', name: 'Admin', msg: 'Approved! Forwarding to the client.' },
    { role: 'creator', name: '', msg: 'Thanks for the fast feedback!' },
    { role: 'admin', name: 'Admin', msg: 'Can you reshoot this with the new product packaging?' },
    { role: 'creator', name: '', msg: 'The new packaging arrives next week, will reshoot then.' },
    { role: 'admin', name: 'Admin', msg: 'Perfect composition! This is approved.' },
    { role: 'creator', name: '', msg: 'Happy to hear that!' },
    { role: 'admin', name: 'Admin', msg: 'The audio quality is a bit low here.' },
    { role: 'creator', name: '', msg: 'I will use the external mic next time.' },
    { role: 'admin', name: 'Admin', msg: 'Love the natural setting in this photo.' },
    { role: 'creator', name: '', msg: 'It was shot at golden hour.' },
    { role: 'admin', name: 'Admin', msg: 'We need vertical format for TikTok.' },
    { role: 'creator', name: '', msg: 'Will re-export in 9:16 ratio.' },
  ];

  for (let i = 0; i < 20; i++) {
    const upload = createdUploads[i % createdUploads.length];
    const creator = activeCreators[i % 10];
    const cm = commentMessages[i];
    await prisma.uploadComment.create({
      data: {
        orgId: DEV_ORG_ID,
        uploadId: upload.id,
        creatorId: cm.role === 'creator' ? creator.id : null,
        authorRole: cm.role,
        authorName: cm.role === 'creator' ? creator.name : cm.name,
        message: cm.msg,
        readByAdmin: cm.role === 'admin',
        readByCreator: cm.role === 'creator',
      },
    });
  }
  console.log('Created 20 upload comments.');

  // =========================================================================
  // Seed Creator Projects (3 projects)
  // =========================================================================

  const projectDefs = [
    {
      name: 'Summer Campaign 2026',
      description: 'Summer product launch campaign across Instagram and TikTok. Focus on beach/outdoor lifestyle content.',
      status: 'active',
      deadline: '2026-07-01',
      creatorIndices: [0, 1, 3, 5, 9],
      tags: ['summer', 'launch', 'social'],
    },
    {
      name: 'Tech Review Series Q2',
      description: 'Quarterly tech product review series featuring our latest gadgets across YouTube creators.',
      status: 'active',
      deadline: '2026-06-30',
      creatorIndices: [2, 8, 10],
      tags: ['tech', 'reviews', 'youtube'],
    },
    {
      name: 'Holiday Content Pack',
      description: 'Pre-produced holiday content batch for December social media calendar.',
      status: 'paused',
      deadline: '2026-11-15',
      creatorIndices: [0, 3, 4, 7, 13, 14],
      tags: ['holiday', 'batch', 'pre-production'],
    },
  ];

  for (const p of projectDefs) {
    const creatorIds = p.creatorIndices
      .map((idx) => activeCreators[idx]?.id)
      .filter(Boolean);

    await prisma.creatorProject.create({
      data: {
        orgId: DEV_ORG_ID,
        name: p.name,
        description: p.description,
        status: p.status,
        deadline: p.deadline ? new Date(p.deadline) : null,
        creatorIds,
        tags: p.tags,
      },
    });
  }
  console.log('Created 3 projects.');

  console.log('Creator Hub seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
