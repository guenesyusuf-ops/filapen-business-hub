'use client';

import { useState, useCallback } from 'react';
import {
  Wand2,
  Star,
  Copy,
  Check,
  Save,
  Sparkles,
  Loader2,
  Target,
  LayoutGrid,
  List,
  RefreshCw,
  Lightbulb,
  Zap,
  TrendingUp,
  MessageSquare,
  Hash,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import {
  useGenerateContent,
  useCreateContent,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  ANGLES,
  FRAMEWORK_LABELS,
  FRAMEWORK_COLORS,
  PLATFORM_LABELS,
} from '@/hooks/content/useContent';
import type { GeneratedItem, AngleSuggestion } from '@/hooks/content/useContent';
import { useBrandVoices } from '@/hooks/content/useBrandVoice';

// ---------------------------------------------------------------------------
// Angle Suggestion Card
// ---------------------------------------------------------------------------

const ANGLE_ICONS: Record<string, typeof Target> = {
  'Problem-Solution': Target,
  'Problem-Losung': Target,
  'Transformation Story': TrendingUp,
  'Transformations-Geschichte': TrendingUp,
  'Social Proof Avalanche': MessageSquare,
  'Social-Proof-Lawine': MessageSquare,
  'Contrarian / Hot Take': Zap,
  'Kontroverse / Hot Take': Zap,
  'Us vs. Them': LayoutGrid,
  'Wir vs. Die': LayoutGrid,
  'Urgency / Scarcity': Lightbulb,
  'Dringlichkeit / Knappheit': Lightbulb,
};

function AngleCard({ angle }: { angle: AngleSuggestion }) {
  const Icon = ANGLE_ICONS[angle.name] || Lightbulb;
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-orange-50 to-amber-100 text-orange-600 shrink-0">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{angle.name}</h4>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{angle.description}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xxs font-medium text-rose-600">
              {angle.emotion}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xxs font-medium text-blue-600">
              {angle.bestFor}
            </span>
          </div>
          <p className="text-xs text-gray-400 italic mt-2">"{angle.example}"</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generated Variant Card (Premium)
// ---------------------------------------------------------------------------

function VariantCard({
  variant,
  index,
  onSave,
  saving,
  viewMode,
}: {
  variant: GeneratedItem;
  index: number;
  onSave: () => void;
  saving: boolean;
  viewMode: 'grid' | 'list';
}) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(0);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(variant.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [variant.body]);

  const frameworkLabel = FRAMEWORK_LABELS[variant.framework] || variant.framework;
  const frameworkColor = FRAMEWORK_COLORS[variant.framework] || 'bg-gray-100 text-gray-600';
  const platformLabel = PLATFORM_LABELS[variant.platform] || variant.platform;

  return (
    <div className={cn(
      'rounded-xl bg-white border border-border shadow-card hover:shadow-card-hover transition-all',
      viewMode === 'list' ? 'p-4' : 'p-5',
    )}>
      {/* Header with badges */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-accent-content-light text-accent-content text-xs font-bold shrink-0">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-900 truncate">{variant.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium', frameworkColor)}>
            {frameworkLabel}
          </span>
          {variant.platform && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xxs font-medium text-gray-600">
              {platformLabel}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xxs font-medium text-indigo-600">
            {variant.tone}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xxs font-medium text-purple-600">
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="rounded-lg bg-surface-secondary p-4 mb-3">
        <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
          {variant.body}
        </p>
      </div>

      {/* Stats + Rating + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Stats */}
        <div className="flex items-center gap-3 text-xxs text-gray-400">
          <span className="flex items-center gap-1">
            <Type className="h-3 w-3" />
            {variant.wordCount} words
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {variant.charCount} chars
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-0.5">Rate:</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setRating(i + 1)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  i < rating
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-200 hover:text-amber-300',
                )}
              />
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-content px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-content-dark transition-colors disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors',
              copied
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'text-gray-700 hover:bg-surface-secondary',
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GenerateContentPage() {
  const generateMutation = useGenerateContent();
  const createMutation = useCreateContent();
  const brandVoicesQuery = useBrandVoices();
  const brandVoices = brandVoicesQuery.data?.items ?? [];

  // Fetch products from Finance Hub for auto-fill (Feature 3)
  const { data: productsData } = useQuery({
    queryKey: ['finance', 'products', 'catalog-for-generator'],
    queryFn: () => {
      return fetch(`${API_URL}/api/finance/products/catalog?pageSize=200`).then((r) => r.json());
    },
    staleTime: 5 * 60 * 1000,
  });
  const products = productsData?.items ?? [];

  const [selectedProductId, setSelectedProductId] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [formState, setFormState] = useState({
    type: 'headline',
    language: 'English',
    product: '',
    productDescription: '',
    keyBenefits: '',
    pricePoint: '',
    usps: '',
    audience: '',
    targetPersona: '',
    painPoints: '',
    desiresGoals: '',
    awarenessLevel: 'Problem Aware',
    funnelStage: 'TOFU',
    competitorNames: '',
    keyDifferentiators: '',
    angle: 'AIDA',
    emotionalTrigger: 'Desire',
    ctaType: 'Learn More',
    tone: 'Professional',
    bestPerformingHook: '',
    topCompetitorAdCopy: '',
    marketInsights: '',
    brandVoiceId: '',
    count: 5,
    useEmojis: false,
    headlineRequirements: '1 Headline (max. 110 Zeichen, mit starker Hook, Hook-orientiert, Aufmerksamkeit im Feed erzeugen, emotional oder neugierig machend)',
    primaryTextRequirements: 'Max. 500 Zeichen, PAS oder AIDA Struktur, emotionale Verbindung aufbauen, Social Proof einbauen, klarer USP, starker CTA am Ende',
    linkDescriptionRequirements: 'Max. 30 Zeichen, neugierig machend, Benefit betonen, zum Klicken animieren',
    ctaRequirements: 'Zielgerichtet, KEINE generischen CTAs wie "Klick hier" oder "Mehr erfahren", Urgency oder konkreten Benefit einbauen',
    headlineCount: 5,
    primaryTextCount: 3,
    linkDescriptionCount: 3,
    ctaCount: 5,
  });

  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    await generateMutation.mutateAsync({
      type: formState.type,
      language: formState.language,
      product: formState.product || undefined,
      productDescription: formState.productDescription || undefined,
      keyBenefits: formState.keyBenefits || undefined,
      pricePoint: formState.pricePoint || undefined,
      usps: formState.usps || undefined,
      audience: formState.audience || undefined,
      targetPersona: formState.targetPersona || undefined,
      painPoints: formState.painPoints || undefined,
      desiresGoals: formState.desiresGoals || undefined,
      awarenessLevel: formState.awarenessLevel,
      funnelStage: formState.funnelStage,
      competitorNames: formState.competitorNames || undefined,
      keyDifferentiators: formState.keyDifferentiators || undefined,
      angle: formState.angle,
      emotionalTrigger: formState.emotionalTrigger,
      ctaType: formState.ctaType,
      tone: formState.tone,
      bestPerformingHook: formState.bestPerformingHook || undefined,
      topCompetitorAdCopy: formState.topCompetitorAdCopy || undefined,
      marketInsights: formState.marketInsights || undefined,
      brandVoiceId: formState.brandVoiceId || undefined,
      count: formState.count,
      useEmojis: formState.useEmojis,
      headlineRequirements: formState.headlineRequirements || undefined,
      primaryTextRequirements: formState.primaryTextRequirements || undefined,
      linkDescriptionRequirements: formState.linkDescriptionRequirements || undefined,
      ctaRequirements: formState.ctaRequirements || undefined,
      headlineCount: formState.headlineCount,
      primaryTextCount: formState.primaryTextCount,
      linkDescriptionCount: formState.linkDescriptionCount,
      ctaCount: formState.ctaCount,
    });
  }, [formState, generateMutation]);

  const handleSave = useCallback(
    async (variant: GeneratedItem, index: number) => {
      setSavingIndex(index);
      try {
        await createMutation.mutateAsync({
          type: variant.type,
          title: variant.title,
          body: variant.body,
          aiGenerated: true,
          aiModel: variant.aiModel || 'filapen-v2',
          brandVoiceId: formState.brandVoiceId || undefined,
          status: 'draft',
        } as any);
      } finally {
        setSavingIndex(null);
      }
    },
    [createMutation, formState.brandVoiceId],
  );

  const generatedItems: GeneratedItem[] = generateMutation.data?.items ?? [];
  const angles: AngleSuggestion[] = generateMutation.data?.angles ?? [];
  const meta = generateMutation.data?.meta;

  // Group items by type for section headers
  const groupedItems = generatedItems.reduce<Record<string, GeneratedItem[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    headline: 'Headlines',
    primary_text: 'Primary Texts',
    ugc_script: 'UGC Scripts',
    hook: 'Hooks',
    cta: 'Call-to-Action Variants',
    video_concept: 'Short-Form Video Scripts',
    social_caption: 'Social Captions',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Generate Content</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Elite content generation powered by proven copywriting frameworks.
          </p>
        </div>
        {generatedItems.length > 0 && meta && (
          <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
            <span className="px-2.5 py-1 rounded-lg bg-surface-secondary font-medium">
              {meta.totalGenerated} generated
            </span>
            {meta.frameworks.map((fw) => (
              <span key={fw} className={cn('px-2 py-0.5 rounded-full text-xxs font-medium', FRAMEWORK_COLORS[fw] || 'bg-gray-100 text-gray-600')}>
                {FRAMEWORK_LABELS[fw] || fw}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel -- Configuration */}
        <div className="lg:col-span-4">
          <div className="rounded-xl bg-white p-6 shadow-card sticky top-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-accent-content-light text-accent-content">
                <Wand2 className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Configuration</h2>
            </div>

            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
              {/* Content Type & Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Content Type
                  </label>
                  <select
                    value={formState.type}
                    onChange={(e) => setFormState((s) => ({ ...s, type: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    {CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CONTENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Output Language
                  </label>
                  <select
                    value={formState.language}
                    onChange={(e) => setFormState((s) => ({ ...s, language: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    <option value="English">English</option>
                    <option value="Deutsch">Deutsch</option>
                  </select>
                </div>
              </div>

              {/* --- Product Information --- */}
              <div className="pt-2 border-t border-border">
                <p className="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-3">Product Information</p>
              </div>

              {/* Product Dropdown - Auto-fill from Finance Hub */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Produkt aus System waehlen
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedProductId(pid);
                    if (pid) {
                      const product = products.find((p: any) => p.id === pid);
                      if (product) {
                        // Strip HTML from description
                        const cleanDescription = (product.description || '')
                          .replace(/<[^>]*>/g, ' ')
                          .replace(/&nbsp;/g, ' ')
                          .replace(/&amp;/g, '&')
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>')
                          .replace(/\s+/g, ' ')
                          .trim();
                        // Format price range
                        const priceText = product.minPrice === product.maxPrice
                          ? `${product.minPrice.toFixed(2)} EUR`
                          : `${product.minPrice.toFixed(2)} - ${product.maxPrice.toFixed(2)} EUR`;
                        setFormState((s) => ({
                          ...s,
                          product: product.title,
                          productDescription: cleanDescription || product.title,
                          pricePoint: priceText,
                        }));
                      }
                    }
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                >
                  <option value="">Manuell eingeben...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <p className="text-xxs text-gray-400 mt-1">
                  Waehle ein Produkt, um Name, Beschreibung und Preis automatisch auszufuellen.
                </p>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formState.product}
                  onChange={(e) => setFormState((s) => ({ ...s, product: e.target.value }))}
                  placeholder="e.g. GlowSerum, Vitamin C Serum"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                />
              </div>

              {/* Product Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Product Description
                </label>
                <textarea
                  value={formState.productDescription}
                  onChange={(e) => setFormState((s) => ({ ...s, productDescription: e.target.value }))}
                  rows={2}
                  placeholder="Describe what the product does..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Key Benefits */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Key Benefits (comma-separated)
                </label>
                <textarea
                  value={formState.keyBenefits}
                  onChange={(e) => setFormState((s) => ({ ...s, keyBenefits: e.target.value }))}
                  rows={2}
                  placeholder="e.g. reduces wrinkles, hydrates skin, visible results in 7 days"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Price Point */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Price Point
                  </label>
                  <input
                    type="text"
                    value={formState.pricePoint}
                    onChange={(e) => setFormState((s) => ({ ...s, pricePoint: e.target.value }))}
                    placeholder="e.g. $49.99"
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  />
                </div>

                {/* USPs */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    USPs
                  </label>
                  <input
                    type="text"
                    value={formState.usps}
                    onChange={(e) => setFormState((s) => ({ ...s, usps: e.target.value }))}
                    placeholder="Unique selling points"
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  />
                </div>
              </div>

              {/* --- Target Audience --- */}
              <div className="pt-2 border-t border-border">
                <p className="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-3">Target Audience</p>
              </div>

              {/* Target Persona */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Target Persona
                </label>
                <input
                  type="text"
                  value={formState.audience}
                  onChange={(e) => setFormState((s) => ({ ...s, audience: e.target.value }))}
                  placeholder="e.g. Women 25-34, interested in skincare"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                />
              </div>

              {/* Pain Points */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Pain Points (comma-separated)
                </label>
                <textarea
                  value={formState.painPoints}
                  onChange={(e) => setFormState((s) => ({ ...s, painPoints: e.target.value }))}
                  rows={2}
                  placeholder="e.g. dry skin, acne scars, uneven tone"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Desires / Goals */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Desires / Goals (comma-separated)
                </label>
                <textarea
                  value={formState.desiresGoals}
                  onChange={(e) => setFormState((s) => ({ ...s, desiresGoals: e.target.value }))}
                  rows={2}
                  placeholder="e.g. glowing skin, youthful appearance, clear complexion"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* --- Marketing Context --- */}
              <div className="pt-2 border-t border-border">
                <p className="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-3">Marketing Context</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Awareness Level */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Awareness Level
                  </label>
                  <select
                    value={formState.awarenessLevel}
                    onChange={(e) => setFormState((s) => ({ ...s, awarenessLevel: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    <option value="Cold">Cold</option>
                    <option value="Problem Aware">Problem Aware</option>
                    <option value="Solution Aware">Solution Aware</option>
                    <option value="Product Aware">Product Aware</option>
                    <option value="Most Aware">Most Aware</option>
                  </select>
                </div>

                {/* Funnel Stage */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Funnel Stage
                  </label>
                  <select
                    value={formState.funnelStage}
                    onChange={(e) => setFormState((s) => ({ ...s, funnelStage: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    <option value="TOFU">TOFU (Top of Funnel)</option>
                    <option value="MOFU">MOFU (Middle of Funnel)</option>
                    <option value="BOFU">BOFU (Bottom of Funnel)</option>
                  </select>
                </div>
              </div>

              {/* Competitor Names */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Competitor Names (comma-separated)
                </label>
                <input
                  type="text"
                  value={formState.competitorNames}
                  onChange={(e) => setFormState((s) => ({ ...s, competitorNames: e.target.value }))}
                  placeholder="e.g. Brand A, Brand B"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                />
              </div>

              {/* Key Differentiators */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Key Differentiators vs Competitors
                </label>
                <textarea
                  value={formState.keyDifferentiators}
                  onChange={(e) => setFormState((s) => ({ ...s, keyDifferentiators: e.target.value }))}
                  rows={2}
                  placeholder="What sets you apart from competitors?"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* --- Creative Direction --- */}
              <div className="pt-2 border-t border-border">
                <p className="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-3">Creative Direction</p>
              </div>

              {/* Angle */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Ad Angle / Framework
                </label>
                <select
                  value={formState.angle}
                  onChange={(e) => setFormState((s) => ({ ...s, angle: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                >
                  <option value="AIDA">AIDA (Attention-Interest-Desire-Action)</option>
                  <option value="PAS">PAS (Problem-Agitate-Solve)</option>
                  <option value="BAB">BAB (Before-After-Bridge)</option>
                  <option value="Story">Story-Based (Hook-Tension-Resolution)</option>
                  <option value="4P">4P (Promise-Picture-Proof-Push)</option>
                  <option value="Before-After">Before-After</option>
                  <option value="Social Proof">Social Proof</option>
                  <option value="Authority">Authority</option>
                  <option value="Urgency">Urgency</option>
                  <option value="Curiosity">Curiosity</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Emotional Trigger */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Emotional Trigger
                  </label>
                  <select
                    value={formState.emotionalTrigger}
                    onChange={(e) => setFormState((s) => ({ ...s, emotionalTrigger: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    <option value="Fear">Fear</option>
                    <option value="Desire">Desire</option>
                    <option value="Curiosity">Curiosity</option>
                    <option value="Trust">Trust</option>
                    <option value="Urgency">Urgency</option>
                    <option value="Social Proof">Social Proof</option>
                  </select>
                </div>

                {/* CTA Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    CTA Type
                  </label>
                  <select
                    value={formState.ctaType}
                    onChange={(e) => setFormState((s) => ({ ...s, ctaType: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    <option value="Buy Now">Buy Now</option>
                    <option value="Learn More">Learn More</option>
                    <option value="Get Started">Get Started</option>
                    <option value="Try Free">Try Free</option>
                    <option value="Limited Offer">Limited Offer</option>
                  </select>
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tone
                </label>
                <select
                  value={formState.tone}
                  onChange={(e) => setFormState((s) => ({ ...s, tone: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                >
                  <option value="Professional">Professional</option>
                  <option value="Casual">Casual</option>
                  <option value="Excited">Excited</option>
                  <option value="Empathetic">Empathetic</option>
                  <option value="Authoritative">Authoritative</option>
                  <option value="Playful">Playful</option>
                  <option value="Luxury">Luxury</option>
                </select>
              </div>

              {/* Brand Voice */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Brand Voice
                </label>
                <select
                  value={formState.brandVoiceId}
                  onChange={(e) => setFormState((s) => ({ ...s, brandVoiceId: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                >
                  <option value="">No brand voice</option>
                  {brandVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* --- AI Requirements --- */}
              <div className="pt-2 border-t border-border">
                <p className="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-3">AI Requirements</p>
              </div>

              {/* Emoji Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Emojis verwenden?</label>
                  <p className="text-xxs text-gray-400 mt-0.5">KI verwendet passende Emojis im Text</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormState((s) => ({ ...s, useEmojis: !s.useEmojis }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    formState.useEmojis ? 'bg-accent-content' : 'bg-gray-200',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                      formState.useEmojis ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              {/* Headline Requirements */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Anforderungen - Headline
                </label>
                <textarea
                  value={formState.headlineRequirements}
                  onChange={(e) => setFormState((s) => ({ ...s, headlineRequirements: e.target.value }))}
                  rows={2}
                  placeholder="z.B. Max. 40 Zeichen, Frage als Hook, Zahl einbauen..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Primary Text Requirements */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Anforderungen - Primartext
                </label>
                <textarea
                  value={formState.primaryTextRequirements}
                  onChange={(e) => setFormState((s) => ({ ...s, primaryTextRequirements: e.target.value }))}
                  rows={2}
                  placeholder="z.B. Max. 500 Zeichen, PAS-Struktur, mit Social Proof..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Link Description Requirements */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Anforderungen - Linkbeschreibung
                </label>
                <textarea
                  value={formState.linkDescriptionRequirements}
                  onChange={(e) => setFormState((s) => ({ ...s, linkDescriptionRequirements: e.target.value }))}
                  rows={2}
                  placeholder="z.B. Neugierig machen, max. 30 Zeichen, Benefit betonen..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* CTA Requirements */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Anforderungen - CTA
                </label>
                <textarea
                  value={formState.ctaRequirements}
                  onChange={(e) => setFormState((s) => ({ ...s, ctaRequirements: e.target.value }))}
                  rows={2}
                  placeholder="z.B. Zielgerichtet, NICHT 'Klick hier', Urgency einbauen..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Count Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Anzahl Headlines</label>
                  <select
                    value={formState.headlineCount}
                    onChange={(e) => setFormState((s) => ({ ...s, headlineCount: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Anzahl Primartexte</label>
                  <select
                    value={formState.primaryTextCount}
                    onChange={(e) => setFormState((s) => ({ ...s, primaryTextCount: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Anzahl Linkbeschreibungen</label>
                  <select
                    value={formState.linkDescriptionCount}
                    onChange={(e) => setFormState((s) => ({ ...s, linkDescriptionCount: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Anzahl CTAs</label>
                  <select
                    value={formState.ctaCount}
                    onChange={(e) => setFormState((s) => ({ ...s, ctaCount: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* --- Performance Data (optional) --- */}
              <div className="pt-2 border-t border-border">
                <p className="text-xxs font-semibold text-gray-400 uppercase tracking-wider mb-3">Performance Data (optional)</p>
              </div>

              {/* Best Performing Hook */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Best Performing Hook
                </label>
                <input
                  type="text"
                  value={formState.bestPerformingHook}
                  onChange={(e) => setFormState((s) => ({ ...s, bestPerformingHook: e.target.value }))}
                  placeholder="Reference from past campaigns"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                />
              </div>

              {/* Top Competitor Ad Copy */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Top Competitor Ad Copy
                </label>
                <textarea
                  value={formState.topCompetitorAdCopy}
                  onChange={(e) => setFormState((s) => ({ ...s, topCompetitorAdCopy: e.target.value }))}
                  rows={2}
                  placeholder="Paste competitor ad copy for context..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Market Insights */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Market Insights
                </label>
                <textarea
                  value={formState.marketInsights}
                  onChange={(e) => setFormState((s) => ({ ...s, marketInsights: e.target.value }))}
                  rows={2}
                  placeholder="Any relevant market data or trends..."
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
                />
              </div>

              {/* Count */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Number of Variants
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 3, 5, 8, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setFormState((s) => ({ ...s, count: n }))}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors text-center',
                        formState.count === n
                          ? 'bg-accent-content text-white border-accent-content'
                          : 'border-border text-gray-600 hover:bg-surface-secondary',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-content to-orange-500 px-4 py-3 text-sm font-semibold text-white hover:from-accent-content-dark hover:to-orange-600 transition-all disabled:opacity-60 shadow-lg shadow-accent-content/20"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claude AI generiert...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Mit KI generieren
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel -- Results */}
        <div className="lg:col-span-8">
          {generatedItems.length === 0 && !generateMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-accent-content-light to-orange-100 mb-6">
                <Sparkles className="h-8 w-8 text-accent-content" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to create
              </h3>
              <p className="text-sm text-gray-500 max-w-md">
                Configure your content parameters on the left and click
                &ldquo;Generate Content&rdquo; to create AI-powered variants using
                AIDA, PAS, BAB, Story, and 4P frameworks.
              </p>
            </div>
          )}

          {generateMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex items-center justify-center h-20 w-20 rounded-full bg-accent-content-light mb-6 animate-pulse">
                <Wand2 className="h-8 w-8 text-accent-content" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating with Claude AI...
              </h3>
              <p className="text-sm text-gray-500">
                Performance Copywriter erstellt {formState.headlineCount} Headlines, {formState.primaryTextCount} Primartexte, {formState.ctaCount} CTAs...
              </p>
            </div>
          )}

          {generatedItems.length > 0 && !generateMutation.isPending && (
            <div className="space-y-6">
              {/* Results header with view toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Generated Content ({generatedItems.length} variants)
                  </h3>
                  <button
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-surface-secondary transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </button>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      viewMode === 'list' ? 'bg-surface-secondary text-gray-900' : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      viewMode === 'grid' ? 'bg-surface-secondary text-gray-900' : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Content sections grouped by type */}
              {Object.entries(groupedItems).map(([type, items]) => (
                <div key={type}>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {typeLabels[type] || type} ({items.length})
                  </h4>
                  <div className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 xl:grid-cols-2 gap-4'
                      : 'space-y-3',
                  )}>
                    {items.map((variant, i) => {
                      const globalIndex = generatedItems.indexOf(variant);
                      return (
                        <VariantCard
                          key={globalIndex}
                          variant={variant}
                          index={globalIndex}
                          onSave={() => handleSave(variant, globalIndex)}
                          saving={savingIndex === globalIndex}
                          viewMode={viewMode}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Angle Suggestions */}
              {angles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-orange-500" />
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Angle Suggestions ({angles.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {angles.map((angle, i) => (
                      <AngleCard key={i} angle={angle} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {generateMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mt-4">
              Failed to generate content. Please try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
