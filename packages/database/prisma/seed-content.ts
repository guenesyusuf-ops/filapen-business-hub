/**
 * Content Hub seed data
 * Run: npx ts-node prisma/seed-content.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('Seeding Content Hub data...');

  // =========================================================================
  // Brand Voices
  // =========================================================================

  const brandVoice1 = await prisma.brandVoice.upsert({
    where: { id: '00000000-0000-0000-0000-c00000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-c00000000001',
      orgId: ORG_ID,
      name: 'Default Brand Voice',
      description:
        'Professional yet approachable. Confident without being pushy. We speak directly to the customer, use active voice, and keep things clear.',
      toneAttributes: { formality: 0.7, humor: 0.2, energy: 0.6, warmth: 0.7 },
      examples: [
        'Your skin deserves better. We made it happen.',
        'Premium quality, honest pricing. No compromises.',
        'Trusted by 50,000+ customers who refuse to settle.',
      ],
      bannedWords: ['cheap', 'buy now', 'limited time only', 'act fast'],
      isDefault: true,
    },
  });

  const brandVoice2 = await prisma.brandVoice.upsert({
    where: { id: '00000000-0000-0000-0000-c00000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-c00000000002',
      orgId: ORG_ID,
      name: 'Casual / Fun Voice',
      description:
        'Playful, witty, and relatable. We talk like a friend who happens to have great taste. Emojis welcome. Slang encouraged.',
      toneAttributes: { formality: 0.2, humor: 0.9, energy: 0.9, warmth: 0.8 },
      examples: [
        'okay but this literally changed my skin overnight',
        'not me buying this for the 3rd time... (no regrets tho)',
        'bestie, you NEED this in your cart rn',
      ],
      bannedWords: ['utilize', 'synergy', 'leverage', 'circle back'],
      isDefault: false,
    },
  });

  console.log(`  Created ${2} brand voices`);

  // =========================================================================
  // System Templates (15)
  // =========================================================================

  const systemTemplates = [
    // 5 Headlines
    {
      id: '00000000-0000-0000-0000-a00000000001',
      name: 'Benefit-Led Headline',
      type: 'headline' as const,
      promptTemplate:
        '[Hook] — {product} that {benefit}. Made for {audience}.',
      variables: [
        { name: 'product', type: 'string', required: true },
        { name: 'benefit', type: 'string', required: true },
        { name: 'audience', type: 'string', required: true },
      ],
      category: 'Headlines',
    },
    {
      id: '00000000-0000-0000-0000-a00000000002',
      name: 'Question Headline',
      type: 'headline' as const,
      promptTemplate:
        'Still {pain_point}? {product} fixes that. {cta}',
      variables: [
        { name: 'pain_point', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'Headlines',
    },
    {
      id: '00000000-0000-0000-0000-a00000000003',
      name: 'Social Proof Headline',
      type: 'headline' as const,
      promptTemplate:
        '{number}+ {audience} already switched to {product}. Here\'s why.',
      variables: [
        { name: 'number', type: 'string', required: true },
        { name: 'audience', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
      ],
      category: 'Headlines',
    },
    {
      id: '00000000-0000-0000-0000-a00000000004',
      name: 'Urgency Headline',
      type: 'headline' as const,
      promptTemplate:
        'Last chance: {product} — {offer}. Ends {deadline}.',
      variables: [
        { name: 'product', type: 'string', required: true },
        { name: 'offer', type: 'string', required: true },
        { name: 'deadline', type: 'string', required: true },
      ],
      category: 'Headlines',
    },
    {
      id: '00000000-0000-0000-0000-a00000000005',
      name: 'Curiosity Headline',
      type: 'headline' as const,
      promptTemplate:
        'The {adjective} thing about {product} that nobody tells you.',
      variables: [
        { name: 'adjective', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
      ],
      category: 'Headlines',
    },
    // 3 Primary Text
    {
      id: '00000000-0000-0000-0000-a00000000006',
      name: 'PAS Framework',
      type: 'primary_text' as const,
      promptTemplate:
        'Problem: {pain_point}\n\nAgitate: {agitate}\n\nSolution: {product} {benefit}.\n\n{cta}',
      variables: [
        { name: 'pain_point', type: 'string', required: true },
        { name: 'agitate', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
        { name: 'benefit', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'Ad Copy',
    },
    {
      id: '00000000-0000-0000-0000-a00000000007',
      name: 'AIDA Framework',
      type: 'primary_text' as const,
      promptTemplate:
        'Attention: {hook}\n\nInterest: {product} is designed for {audience} who {desire}.\n\nDesire: Imagine {outcome}.\n\nAction: {cta}',
      variables: [
        { name: 'hook', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
        { name: 'audience', type: 'string', required: true },
        { name: 'desire', type: 'string', required: true },
        { name: 'outcome', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'Ad Copy',
    },
    {
      id: '00000000-0000-0000-0000-a00000000008',
      name: 'BAB Framework',
      type: 'primary_text' as const,
      promptTemplate:
        'Before: {before}\n\nAfter: {after}\n\nBridge: {product} makes the difference. {cta}',
      variables: [
        { name: 'before', type: 'string', required: true },
        { name: 'after', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'Ad Copy',
    },
    // 3 UGC Scripts
    {
      id: '00000000-0000-0000-0000-a00000000009',
      name: 'Unboxing UGC Script',
      type: 'ugc_script' as const,
      promptTemplate:
        '[HOOK 0-3s] "You guys, my {product} just arrived!"\n\n[UNBOXING 3-12s] Show packaging, first impressions, texture/feel.\n\n[FIRST USE 12-22s] Apply/use the product. React genuinely.\n\n[VERDICT 22-28s] "Okay, I\'m impressed. It {benefit}."\n\n[CTA 28-30s] "{cta}"',
      variables: [
        { name: 'product', type: 'string', required: true },
        { name: 'benefit', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'UGC',
    },
    {
      id: '00000000-0000-0000-0000-a00000000010',
      name: 'Testimonial UGC Script',
      type: 'ugc_script' as const,
      promptTemplate:
        '[HOOK 0-3s] "I have to be honest about {product}..."\n\n[STORY 3-15s] Share personal experience with {pain_point}.\n\n[SOLUTION 15-22s] "Then I tried {product} and {benefit}."\n\n[PROOF 22-27s] Show before/after or real results.\n\n[CTA 27-30s] "{cta}"',
      variables: [
        { name: 'product', type: 'string', required: true },
        { name: 'pain_point', type: 'string', required: true },
        { name: 'benefit', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'UGC',
    },
    {
      id: '00000000-0000-0000-0000-a00000000011',
      name: 'Routine Integration UGC',
      type: 'ugc_script' as const,
      promptTemplate:
        '[HOOK 0-3s] "Adding {product} to my {routine} routine."\n\n[CONTEXT 3-10s] Show existing routine setup.\n\n[INTEGRATION 10-20s] Demonstrate where {product} fits in.\n\n[RESULTS 20-27s] "The difference is {benefit}."\n\n[CTA 27-30s] "{cta}"',
      variables: [
        { name: 'product', type: 'string', required: true },
        { name: 'routine', type: 'string', required: true },
        { name: 'benefit', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'UGC',
    },
    // 2 Hooks
    {
      id: '00000000-0000-0000-0000-a00000000012',
      name: 'Pattern Interrupt Hook',
      type: 'hook' as const,
      promptTemplate:
        'Stop scrolling if you {pain_point}. {product} {benefit}.',
      variables: [
        { name: 'pain_point', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
        { name: 'benefit', type: 'string', required: true },
      ],
      category: 'Hooks',
    },
    {
      id: '00000000-0000-0000-0000-a00000000013',
      name: 'Controversy Hook',
      type: 'hook' as const,
      promptTemplate:
        'Unpopular opinion: {opinion}. Here\'s why {product} proves it.',
      variables: [
        { name: 'opinion', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
      ],
      category: 'Hooks',
    },
    // 2 Video Concepts
    {
      id: '00000000-0000-0000-0000-a00000000014',
      name: 'Before/After Video',
      type: 'video_concept' as const,
      promptTemplate:
        'FORMAT: Before/After\nDURATION: 15-30s\n\nBEFORE: Show {pain_point} (5s)\nTRANSITION: Introduce {product} (3s)\nAFTER: Show {outcome} (5s)\nCTA: {cta} (2s)\n\nTARGET: {audience}',
      variables: [
        { name: 'pain_point', type: 'string', required: true },
        { name: 'product', type: 'string', required: true },
        { name: 'outcome', type: 'string', required: true },
        { name: 'audience', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'Video',
    },
    {
      id: '00000000-0000-0000-0000-a00000000015',
      name: 'GRWM / Routine Video',
      type: 'video_concept' as const,
      promptTemplate:
        'FORMAT: Get Ready With Me\nDURATION: 30-60s\n\nINTRO: "GRWM using {product}" (3s)\nROUTINE: Step-by-step with {product} (20-40s)\nRESULT: Final look reveal (5s)\nCTA: {cta} (3s)\n\nTARGET: {audience}\nMOOD: Relatable, aspirational',
      variables: [
        { name: 'product', type: 'string', required: true },
        { name: 'audience', type: 'string', required: true },
        { name: 'cta', type: 'string', required: false },
      ],
      category: 'Video',
    },
  ];

  for (const t of systemTemplates) {
    await prisma.contentTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        orgId: null,
        name: t.name,
        type: t.type,
        promptTemplate: t.promptTemplate,
        variables: t.variables as any,
        category: t.category,
        isSystem: true,
        usageCount: Math.floor(Math.random() * 50) + 5,
      },
    });
  }

  console.log(`  Created ${systemTemplates.length} system templates`);

  // =========================================================================
  // Content Pieces (30)
  // =========================================================================

  const contentPieces = [
    // Headlines (8)
    {
      id: '00000000-0000-0000-0000-b00000000001',
      type: 'headline' as const,
      title: 'Spring Campaign — Hero Headline',
      body: 'Your skin has been waiting for this. GlowSerum — clinically proven radiance in 7 days.',
      platform: 'meta',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['spring', 'hero'],
      rating: 5,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000002',
      type: 'headline' as const,
      title: 'Retargeting Headline A',
      body: 'Still thinking about it? Your cart misses you. Come back for 15% off.',
      platform: 'meta',
      status: 'approved' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['retargeting'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000003',
      type: 'headline' as const,
      title: 'Google Search Headline',
      body: 'Best Vitamin C Serum 2026 | Dermatologist Recommended | Free Shipping',
      platform: 'google',
      status: 'published' as const,
      brandVoiceId: null,
      aiGenerated: false,
      aiModel: null,
      tags: ['search', 'google'],
      rating: 4,
      campaign: 'Search — Brand',
    },
    {
      id: '00000000-0000-0000-0000-b00000000004',
      type: 'headline' as const,
      title: 'TikTok Shop Headline',
      body: 'The serum that broke TikTok. 2M+ sold. Try it yourself.',
      platform: 'tiktok',
      status: 'in_review' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['tiktok', 'viral'],
      rating: null,
      campaign: 'TikTok Shop Q2',
    },
    {
      id: '00000000-0000-0000-0000-b00000000005',
      type: 'headline' as const,
      title: 'Email Subject Line — Welcome',
      body: 'Welcome to the glow club — here\'s 10% off your first order',
      platform: 'universal',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['email', 'welcome'],
      rating: 5,
      campaign: 'Email Automation',
    },
    {
      id: '00000000-0000-0000-0000-b00000000006',
      type: 'headline' as const,
      title: 'Summer Launch Teaser',
      body: 'Something new is coming. Your summer skin will thank us.',
      platform: 'meta',
      status: 'draft' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['summer', 'teaser'],
      rating: 3,
      campaign: 'Summer Launch 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000007',
      type: 'headline' as const,
      title: 'Bundle Deal Headline',
      body: 'The Complete Glow Kit — Save 30% when you bundle. Your entire routine, sorted.',
      platform: 'meta',
      status: 'approved' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['bundle', 'sale'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000008',
      type: 'headline' as const,
      title: 'Archived — Old Holiday Headline',
      body: 'The gift that keeps on glowing. Holiday sets from $29.',
      platform: 'meta',
      status: 'archived' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['holiday', 'archived'],
      rating: 3,
      campaign: 'Holiday 2025',
    },
    // Primary Text (6)
    {
      id: '00000000-0000-0000-0000-b00000000009',
      type: 'primary_text' as const,
      title: 'Spring Campaign — Primary Text A',
      body: 'Tired of serums that promise the world and deliver nothing? Us too.\n\nThat\'s why we spent 18 months formulating GlowSerum with 20% Vitamin C, hyaluronic acid, and niacinamide.\n\nThe result? Visibly brighter, smoother skin in just 7 days. No filters needed.\n\nTry it risk-free with our 30-day guarantee. Shop now — link in bio.',
      platform: 'meta',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['spring', 'PAS'],
      rating: 5,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000010',
      type: 'primary_text' as const,
      title: 'Spring Campaign — Primary Text B (Casual)',
      body: 'okay but can we talk about this serum for a sec?\n\ni\'ve tried literally EVERYTHING and nothing worked until GlowSerum. my skin is actually glowing and i\'m not even using a filter rn.\n\n20% vitamin C + hyaluronic acid = chef\'s kiss\n\ndon\'t sleep on this. link in bio!',
      platform: 'meta',
      status: 'approved' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['spring', 'casual'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000011',
      type: 'primary_text' as const,
      title: 'Google Responsive Ad Copy',
      body: 'Clinically proven Vitamin C serum. Brighter skin in 7 days. Free shipping on orders over $50. 30-day money-back guarantee. Shop the #1 rated serum.',
      platform: 'google',
      status: 'published' as const,
      brandVoiceId: null,
      aiGenerated: false,
      aiModel: null,
      tags: ['google', 'search'],
      rating: 4,
      campaign: 'Search — Brand',
    },
    {
      id: '00000000-0000-0000-0000-b00000000012',
      type: 'primary_text' as const,
      title: 'Retargeting Primary Text',
      body: 'You left something behind.\n\nGlowSerum is still in your cart — and it\'s selling fast. Come back and complete your order before it\'s gone.\n\nUse code GLOW15 for 15% off. Limited time only.',
      platform: 'meta',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['retargeting'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000013',
      type: 'primary_text' as const,
      title: 'Summer Teaser Copy',
      body: 'Get ready. Something big is coming this summer.\n\nHint: It\'s lightweight, SPF-infused, and pairs perfectly with your GlowSerum.\n\nDrop a comment if you want early access.',
      platform: 'meta',
      status: 'draft' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['summer', 'teaser'],
      rating: null,
      campaign: 'Summer Launch 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000014',
      type: 'primary_text' as const,
      title: 'Bundle Upsell Copy',
      body: 'Why buy one when you can get the full routine?\n\nThe Complete Glow Kit includes:\n- GlowSerum (30ml)\n- HydraBoost Moisturizer (50ml)\n- Gentle Cleanser (120ml)\n\nSave 30% vs. buying separately. Your skin will thank you.',
      platform: 'meta',
      status: 'in_review' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['bundle', 'upsell'],
      rating: 3,
      campaign: 'Spring Glow 2026',
    },
    // UGC Scripts (5)
    {
      id: '00000000-0000-0000-0000-b00000000015',
      type: 'ugc_script' as const,
      title: 'UGC Script — Unboxing GlowSerum',
      body: '[HOOK 0-3s]\n"Okay my GlowSerum finally arrived, let\'s see what the hype is about."\n\n[UNBOXING 3-10s]\nShow packaging — clean, minimal, premium feel.\n"The packaging alone is gorgeous."\n\n[FIRST USE 10-20s]\nApply 2-3 drops. Show texture on fingers.\n"It absorbs so fast and doesn\'t feel sticky at all."\n\n[VERDICT 20-27s]\n"I\'ve only been using it for a week but my skin already looks brighter. I\'m obsessed."\n\n[CTA 27-30s]\n"Link is in their bio. Trust me on this one."',
      platform: 'tiktok',
      status: 'approved' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['ugc', 'unboxing'],
      rating: 5,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000016',
      type: 'ugc_script' as const,
      title: 'UGC Script — 30-Day Results',
      body: '[HOOK 0-3s]\n"30 days with GlowSerum — here are my honest results."\n\n[DAY 1 3-8s]\nShow skin before starting. No filter.\n"Day 1. Some texture, uneven tone."\n\n[WEEK 2 8-15s]\n"Week 2 — already seeing a difference in brightness."\n\n[DAY 30 15-25s]\nSide-by-side comparison.\n"Day 30. The difference is unreal. Smoother, brighter, more even."\n\n[CTA 25-30s]\n"I\'m never going back. Link in bio."',
      platform: 'tiktok',
      status: 'published' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['ugc', 'results', 'before-after'],
      rating: 5,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000017',
      type: 'ugc_script' as const,
      title: 'UGC Script — Morning Routine',
      body: '[HOOK 0-3s]\n"My 5-minute morning skincare routine"\n\n[ROUTINE 3-20s]\nStep 1: Gentle cleanser\nStep 2: GlowSerum — "this is the game changer"\nStep 3: Moisturizer\nStep 4: SPF\n\n[CLOSE 20-28s]\n"Simple, effective, and my skin has never looked better."\n\n[CTA 28-30s]\n"Check the link for the full routine breakdown."',
      platform: 'tiktok',
      status: 'in_review' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['ugc', 'routine'],
      rating: 4,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000018',
      type: 'ugc_script' as const,
      title: 'UGC Script — GRWM Date Night',
      body: '[HOOK 0-3s]\n"Get ready with me for date night"\n\n[SKINCARE 3-12s]\nApply GlowSerum. "Starting with the good stuff."\n\n[MAKEUP 12-22s]\n"This serum makes my makeup go on SO smooth."\nShow foundation application.\n\n[REVEAL 22-28s]\nFinal look. "The glow is real."\n\n[CTA 28-30s]\n"GlowSerum — link in bio"',
      platform: 'tiktok',
      status: 'draft' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['ugc', 'grwm'],
      rating: null,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000019',
      type: 'ugc_script' as const,
      title: 'UGC Script — Dermatologist Review',
      body: '[HOOK 0-3s]\n"A dermatologist reviews GlowSerum\'s ingredient list."\n\n[INGREDIENTS 3-15s]\n"20% Vitamin C — excellent for brightening."\n"Hyaluronic acid — hydration powerhouse."\n"Niacinamide — great for texture."\n\n[VERDICT 15-25s]\n"This is a well-formulated serum. The concentration of actives is clinical-grade."\n\n[CTA 25-30s]\n"Would I recommend it? Absolutely. Link below."',
      platform: 'tiktok',
      status: 'approved' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['ugc', 'expert', 'derm'],
      rating: 5,
      campaign: 'UGC Q2 2026',
    },
    // Hooks (4)
    {
      id: '00000000-0000-0000-0000-b00000000020',
      type: 'hook' as const,
      title: 'Hook — Pattern Interrupt',
      body: 'Stop scrolling. Your skin is begging you to watch this.',
      platform: 'tiktok',
      status: 'published' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['hook'],
      rating: 4,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000021',
      type: 'hook' as const,
      title: 'Hook — Controversy',
      body: 'Unpopular opinion: most Vitamin C serums are a waste of money. Except this one.',
      platform: 'tiktok',
      status: 'approved' as const,
      brandVoiceId: brandVoice2.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['hook', 'controversy'],
      rating: 5,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000022',
      type: 'hook' as const,
      title: 'Hook — Social Proof',
      body: '2 million bottles sold. Here\'s what nobody\'s telling you about this serum.',
      platform: 'meta',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['hook', 'social-proof'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000023',
      type: 'hook' as const,
      title: 'Hook — Question',
      body: 'Why do dermatologists keep recommending this $39 serum over $200 alternatives?',
      platform: 'meta',
      status: 'draft' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['hook', 'question'],
      rating: null,
      campaign: 'Spring Glow 2026',
    },
    // Video Concepts (3)
    {
      id: '00000000-0000-0000-0000-b00000000024',
      type: 'video_concept' as const,
      title: 'Video Concept — Before/After Timelapse',
      body: 'CONCEPT: 30-Day Skin Transformation\nFORMAT: Before/After Timelapse\nDURATION: 15s\n\n1. Day 1 selfie — natural lighting, no filter (2s)\n2. Text: "I tried GlowSerum for 30 days" (2s)\n3. Quick montage of daily application (5s)\n4. Day 30 selfie — same lighting (3s)\n5. Side-by-side comparison (2s)\n6. CTA: "Link in bio" (1s)\n\nMOOD: Authentic, satisfying, aspirational',
      platform: 'tiktok',
      status: 'approved' as const,
      brandVoiceId: null,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['video', 'before-after'],
      rating: 5,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000025',
      type: 'video_concept' as const,
      title: 'Video Concept — Ingredient Deep Dive',
      body: 'CONCEPT: Why These 3 Ingredients Changed Skincare\nFORMAT: Educational / Talking Head\nDURATION: 30-60s\n\n1. Hook: "3 ingredients your skin needs" (3s)\n2. Vitamin C — what it does, show bottle (8s)\n3. Hyaluronic Acid — benefits, demo (8s)\n4. Niacinamide — texture improvement (8s)\n5. "All three in one serum" — show GlowSerum (5s)\n6. CTA (3s)\n\nMOOD: Educational, trustworthy',
      platform: 'tiktok',
      status: 'draft' as const,
      brandVoiceId: null,
      aiGenerated: false,
      aiModel: null,
      tags: ['video', 'educational'],
      rating: 3,
      campaign: 'UGC Q2 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000026',
      type: 'video_concept' as const,
      title: 'Video Concept — Summer Bundle Launch',
      body: 'CONCEPT: Summer Glow Kit Reveal\nFORMAT: Product Launch\nDURATION: 30s\n\n1. Mysterious box on table (2s)\n2. Text: "Your summer skin routine just arrived" (2s)\n3. Unbox each product dramatically (12s)\n4. Show all products together — aesthetic flat lay (5s)\n5. Quick demo montage (5s)\n6. Price + CTA (4s)\n\nMOOD: Premium, exciting, FOMO-inducing',
      platform: 'meta',
      status: 'draft' as const,
      brandVoiceId: null,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['video', 'launch', 'summer'],
      rating: null,
      campaign: 'Summer Launch 2026',
    },
    // Social Captions (2)
    {
      id: '00000000-0000-0000-0000-b00000000027',
      type: 'social_caption' as const,
      title: 'Instagram Caption — Product Shot',
      body: 'Your new morning essential. One pump, seven days, visible glow.\n\nGlowSerum is formulated with 20% Vitamin C, hyaluronic acid, and niacinamide for skin that speaks for itself.\n\nTap the link in bio to try it risk-free.\n\n#skincare #vitaminc #glowserum #cleanbeauty #skincareRoutine',
      platform: 'meta',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['instagram', 'caption'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000028',
      type: 'social_caption' as const,
      title: 'Instagram Caption — UGC Repost',
      body: 'Real results from real people. No filters, no faking it.\n\nThank you @sarahcreates for sharing your 30-day journey with GlowSerum. Your skin looks incredible.\n\nWant to be featured? Tag us in your glow-up!\n\n#glowserum #skincarejunkie #realresults #beforeandafter',
      platform: 'meta',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['instagram', 'ugc-repost'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    // CTAs (2)
    {
      id: '00000000-0000-0000-0000-b00000000029',
      type: 'cta' as const,
      title: 'CTA — Main Shop',
      body: 'Shop now and get free shipping on your first order. Use code GLOW at checkout.',
      platform: 'universal',
      status: 'published' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: false,
      aiModel: null,
      tags: ['cta', 'main'],
      rating: 4,
      campaign: 'Spring Glow 2026',
    },
    {
      id: '00000000-0000-0000-0000-b00000000030',
      type: 'cta' as const,
      title: 'CTA — Limited Time Bundle',
      body: 'The Complete Glow Kit is 30% off this week only. Grab yours before it sells out.',
      platform: 'universal',
      status: 'approved' as const,
      brandVoiceId: brandVoice1.id,
      aiGenerated: true,
      aiModel: 'filapen-v1',
      tags: ['cta', 'bundle', 'urgency'],
      rating: 3,
      campaign: 'Spring Glow 2026',
    },
  ];

  for (const piece of contentPieces) {
    await prisma.contentPiece.upsert({
      where: { id: piece.id },
      update: {},
      create: {
        id: piece.id,
        orgId: ORG_ID,
        type: piece.type,
        title: piece.title,
        body: piece.body,
        platform: piece.platform,
        status: piece.status,
        brandVoiceId: piece.brandVoiceId,
        aiGenerated: piece.aiGenerated,
        aiModel: piece.aiModel,
        tags: piece.tags,
        rating: piece.rating,
        campaign: piece.campaign,
      },
    });
  }

  console.log(`  Created ${contentPieces.length} content pieces`);
  console.log('Content Hub seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
