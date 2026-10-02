'use client';

import { useState, useCallback } from 'react';
import {
  Copy, Check, Save, Sparkles, Loader2, Target, RefreshCw, Lightbulb, Zap,
  TrendingUp, MessageSquare, LayoutGrid, List, Type, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MetaPageHeader, MetaSectionLabel, MetaDivider, MetaEmptyState, META_FRAME, btnPrimary, btnGhost,
} from '@/components/meta-ads/MetaUI';
import { ProductGroupSelect } from '@/components/meta-ads/ProductGroupSelect';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';
import { useQuery } from '@tanstack/react-query';
import {
  useGenerateContent, useCreateContent, CONTENT_TYPES, CONTENT_TYPE_LABELS,
  FRAMEWORK_LABELS, FRAMEWORK_COLORS, PLATFORM_LABELS,
} from '@/hooks/content/useContent';
import type { GeneratedItem, AngleSuggestion } from '@/hooks/content/useContent';
import { useBrandVoices } from '@/hooks/content/useBrandVoice';
import { useMetaProductGroups } from '@/hooks/meta-ads/useMetaAds';

// Shared control styles (neue Meta-Ads-Sprache)
const inp = 'h-[38px] w-full min-w-0 rounded-[9px] border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[var(--card-bg)] px-3 text-[13.5px] text-gray-900 dark:text-white outline-none transition focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25';
const ta = 'w-full min-w-0 rounded-[9px] border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[var(--card-bg)] px-3 py-2 text-[13.5px] text-gray-900 dark:text-white outline-none transition focus:border-accent-meta focus:ring-2 focus:ring-accent-meta/25 resize-none';
const sel = cn(inp, 'appearance-none pr-8 cursor-pointer');
const lbl = 'block text-[12px] font-medium text-gray-500 dark:text-white/50 mb-1.5';

const ANGLE_ICONS: Record<string, typeof Target> = {
  'Problem-Solution': Target, 'Problem-Losung': Target, 'Transformation Story': TrendingUp, 'Transformations-Geschichte': TrendingUp,
  'Social Proof Avalanche': MessageSquare, 'Social-Proof-Lawine': MessageSquare, 'Contrarian / Hot Take': Zap, 'Kontroverse / Hot Take': Zap,
  'Us vs. Them': LayoutGrid, 'Wir vs. Die': LayoutGrid, 'Urgency / Scarcity': Lightbulb, 'Dringlichkeit / Knappheit': Lightbulb,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

// Leichte Result-Row (statt schwerer Card)
function VariantRow({ variant, index, onSave, saving }: { variant: GeneratedItem; index: number; onSave: () => void; saving: boolean; }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => { navigator.clipboard.writeText(variant.body); setCopied(true); setTimeout(() => setCopied(false), 1800); }, [variant.body]);
  const fw = FRAMEWORK_LABELS[variant.framework] || variant.framework;
  const fwColor = FRAMEWORK_COLORS[variant.framework] || 'bg-gray-100 text-gray-600';
  return (
    <div className="group rounded-[10px] border border-gray-200/70 bg-white px-4 py-3 transition hover:border-gray-300 hover:bg-gray-50/50 dark:border-white/[0.07] dark:bg-[var(--card-bg)] dark:hover:border-white/15 dark:hover:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent-meta/10 text-[11px] font-semibold tabular-nums text-accent-meta">{index + 1}</span>
          <span className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{variant.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-accent-meta transition hover:bg-accent-meta/10 disabled:opacity-50"><Save className="h-3 w-3" />{saving ? 'Speichern…' : 'Speichern'}</button>
          <button onClick={copy} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium transition', copied ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white')}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Kopiert' : 'Kopieren'}</button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700 dark:text-white/80">{variant.body}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10.5px] text-gray-400 dark:text-white/40">
        <span className={cn('rounded-full px-1.5 py-0.5 font-medium', fwColor)}>{fw}</span>
        {variant.platform && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 dark:bg-white/10">{PLATFORM_LABELS[variant.platform] || variant.platform}</span>}
        {variant.tone && <span>· {variant.tone}</span>}
        <span className="ml-auto flex items-center gap-2.5"><span className="flex items-center gap-1"><Type className="h-2.5 w-2.5" />{variant.wordCount}</span><span className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" />{variant.charCount}</span></span>
      </div>
    </div>
  );
}

function AngleRow({ angle }: { angle: AngleSuggestion }) {
  const Icon = ANGLE_ICONS[angle.name] || Lightbulb;
  return (
    <div className="flex gap-3 rounded-[10px] border border-gray-200/70 bg-white p-4 dark:border-white/[0.07] dark:bg-[var(--card-bg)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-meta/10 text-accent-meta"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <h4 className="text-[13px] font-semibold text-gray-900 dark:text-white">{angle.name}</h4>
        <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500 dark:text-white/50">{angle.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] font-medium">
          <span className="rounded-full bg-accent-meta/10 px-2 py-0.5 text-accent-meta">{angle.emotion}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-white/10 dark:text-white/50">{angle.bestFor}</span>
        </div>
        <p className="mt-2 text-[12px] italic text-gray-400 dark:text-white/40">„{angle.example}"</p>
      </div>
    </div>
  );
}

export default function GenerateContentPage() {
  const generateMutation = useGenerateContent();
  const createMutation = useCreateContent();
  const brandVoices = useBrandVoices().data?.items ?? [];
  const groups = useMetaProductGroups().data?.items ?? [];

  const { data: productsData } = useQuery({
    queryKey: ['finance', 'products', 'catalog-for-generator'],
    queryFn: () => fetch(`${API_URL}/api/finance/products/catalog?pageSize=200`, { headers: getAuthHeaders() }).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const products = productsData?.items ?? [];

  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [formState, setFormState] = useState({
    type: 'headline', language: 'English', product: '', productDescription: '', keyBenefits: '', pricePoint: '', usps: '',
    audience: '', targetPersona: '', painPoints: '', desiresGoals: '', awarenessLevel: 'Problem Aware', funnelStage: 'TOFU',
    competitorNames: '', keyDifferentiators: '', angle: 'AIDA', emotionalTrigger: 'Desire', ctaType: 'Learn More', tone: 'Professional',
    bestPerformingHook: '', topCompetitorAdCopy: '', marketInsights: '', brandVoiceId: '', count: 5, useEmojis: false,
    headlineRequirements: '1 Headline (max. 110 Zeichen, mit starker Hook, Hook-orientiert, Aufmerksamkeit im Feed erzeugen, emotional oder neugierig machend)',
    primaryTextRequirements: 'Max. 500 Zeichen, PAS oder AIDA Struktur, emotionale Verbindung aufbauen, Social Proof einbauen, klarer USP, starker CTA am Ende',
    linkDescriptionRequirements: 'Max. 30 Zeichen, neugierig machend, Benefit betonen, zum Klicken animieren',
    ctaRequirements: 'Zielgerichtet, KEINE generischen CTAs wie "Klick hier" oder "Mehr erfahren", Urgency oder konkreten Benefit einbauen',
    headlineCount: 5, primaryTextCount: 3, linkDescriptionCount: 3, ctaCount: 5,
  });
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const set = (patch: Partial<typeof formState>) => setFormState((s) => ({ ...s, ...patch }));

  // ProductGroupSelect → Produktname (+ Auto-Fill bei linked-Gruppe via Finance-Katalog)
  const onGroupChange = (id: string | undefined, group?: { id: string; name: string; productId: string | null }) => {
    setGroupId(id);
    const g = group ?? groups.find((x) => x.id === id);
    if (!g) return;
    const patch: Partial<typeof formState> = { product: g.name };
    if (g.productId) {
      const p = products.find((x: any) => x.id === g.productId);
      if (p) {
        const clean = (p.description || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
        patch.productDescription = clean || p.title;
        if (p.minPrice != null) patch.pricePoint = p.minPrice === p.maxPrice ? `${p.minPrice.toFixed(2)} EUR` : `${p.minPrice.toFixed(2)} - ${p.maxPrice.toFixed(2)} EUR`;
      }
    }
    set(patch);
  };

  const handleGenerate = useCallback(async () => {
    await generateMutation.mutateAsync({
      type: formState.type, language: formState.language, product: formState.product || undefined,
      productDescription: formState.productDescription || undefined, keyBenefits: formState.keyBenefits || undefined,
      pricePoint: formState.pricePoint || undefined, usps: formState.usps || undefined, audience: formState.audience || undefined,
      targetPersona: formState.targetPersona || undefined, painPoints: formState.painPoints || undefined, desiresGoals: formState.desiresGoals || undefined,
      awarenessLevel: formState.awarenessLevel, funnelStage: formState.funnelStage, competitorNames: formState.competitorNames || undefined,
      keyDifferentiators: formState.keyDifferentiators || undefined, angle: formState.angle, emotionalTrigger: formState.emotionalTrigger,
      ctaType: formState.ctaType, tone: formState.tone, bestPerformingHook: formState.bestPerformingHook || undefined,
      topCompetitorAdCopy: formState.topCompetitorAdCopy || undefined, marketInsights: formState.marketInsights || undefined,
      brandVoiceId: formState.brandVoiceId || undefined, count: formState.count, useEmojis: formState.useEmojis,
      headlineRequirements: formState.headlineRequirements || undefined, primaryTextRequirements: formState.primaryTextRequirements || undefined,
      linkDescriptionRequirements: formState.linkDescriptionRequirements || undefined, ctaRequirements: formState.ctaRequirements || undefined,
      headlineCount: formState.headlineCount, primaryTextCount: formState.primaryTextCount, linkDescriptionCount: formState.linkDescriptionCount, ctaCount: formState.ctaCount,
    });
  }, [formState, generateMutation]);

  const handleSave = useCallback(async (variant: GeneratedItem, index: number) => {
    setSavingIndex(index);
    try {
      await createMutation.mutateAsync({ type: variant.type, title: variant.title, body: variant.body, aiGenerated: true, aiModel: variant.aiModel || 'filapen-v2', brandVoiceId: formState.brandVoiceId || undefined, status: 'draft' } as any);
    } finally { setSavingIndex(null); }
  }, [createMutation, formState.brandVoiceId]);

  const generatedItems: GeneratedItem[] = generateMutation.data?.items ?? [];
  const angles: AngleSuggestion[] = generateMutation.data?.angles ?? [];
  const meta = generateMutation.data?.meta;
  const grouped: Record<string, GeneratedItem[]> = {};
  for (const it of generatedItems) { (grouped[it.type] = grouped[it.type] || []).push(it); }
  const typeLabels: Record<string, string> = { headline: 'Headlines', primary_text: 'Primary Texts', ugc_script: 'UGC Scripts', hook: 'Hooks', cta: 'Call-to-Action Varianten', video_concept: 'Short-Form Video Scripts', social_caption: 'Social Captions' };

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-7">
      <MetaPageHeader eyebrow="Meta Ads" title="Generieren"
        description="Hooks, Headlines, Primary Text, CTAs & Angles — gestützt auf bewährte Copywriting-Frameworks."
        actions={meta && generatedItems.length > 0 ? <span className="hidden rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-white/5 dark:text-white/50 md:inline">{meta.totalGenerated} generiert</span> : undefined}
      />

      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="lg:col-span-5">
          <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto lg:pr-2">
            {/* Kontext */}
            <section className="flex flex-col gap-4">
              <MetaSectionLabel>Kontext</MetaSectionLabel>
              <Field label="Produkt / Bundle"><ProductGroupSelect value={groupId} onChange={onGroupChange} /></Field>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Produktname"><input className={inp} value={formState.product} onChange={(e) => set({ product: e.target.value })} placeholder="z. B. GlowSerum" /></Field>
                <Field label="Preis"><input className={inp} value={formState.pricePoint} onChange={(e) => set({ pricePoint: e.target.value })} placeholder="z. B. 49,99 €" /></Field>
              </div>
              <Field label="Produktbeschreibung"><textarea className={ta} rows={2} value={formState.productDescription} onChange={(e) => set({ productDescription: e.target.value })} placeholder="Was macht das Produkt?" /></Field>
              <Field label="Key Benefits (kommagetrennt)"><textarea className={ta} rows={2} value={formState.keyBenefits} onChange={(e) => set({ keyBenefits: e.target.value })} placeholder="z. B. reduziert Falten, spendet Feuchtigkeit" /></Field>
              <Field label="USPs"><input className={inp} value={formState.usps} onChange={(e) => set({ usps: e.target.value })} placeholder="Alleinstellungsmerkmale" /></Field>
              <Field label="Zielgruppe / Persona"><input className={inp} value={formState.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="z. B. Frauen 25–34, Hautpflege" /></Field>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Pain Points"><textarea className={ta} rows={2} value={formState.painPoints} onChange={(e) => set({ painPoints: e.target.value })} placeholder="z. B. trockene Haut" /></Field>
                <Field label="Desires / Ziele"><textarea className={ta} rows={2} value={formState.desiresGoals} onChange={(e) => set({ desiresGoals: e.target.value })} placeholder="z. B. strahlende Haut" /></Field>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Wettbewerber"><input className={inp} value={formState.competitorNames} onChange={(e) => set({ competitorNames: e.target.value })} placeholder="Brand A, Brand B" /></Field>
                <Field label="Differenzierung"><input className={inp} value={formState.keyDifferentiators} onChange={(e) => set({ keyDifferentiators: e.target.value })} placeholder="Was unterscheidet dich?" /></Field>
              </div>
            </section>

            <MetaDivider />

            {/* Generation */}
            <section className="flex flex-col gap-4">
              <MetaSectionLabel>Generation</MetaSectionLabel>
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <Field label="Content Type"><select className={sel} value={formState.type} onChange={(e) => set({ type: e.target.value })}>{CONTENT_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}</select></Field>
                <Field label="Sprache"><select className={sel} value={formState.language} onChange={(e) => set({ language: e.target.value })}><option value="English">English</option><option value="Deutsch">Deutsch</option></select></Field>
                <Field label="Awareness Level"><select className={sel} value={formState.awarenessLevel} onChange={(e) => set({ awarenessLevel: e.target.value })}>{['Cold', 'Problem Aware', 'Solution Aware', 'Product Aware', 'Most Aware'].map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Funnel Stage"><select className={sel} value={formState.funnelStage} onChange={(e) => set({ funnelStage: e.target.value })}><option value="TOFU">TOFU</option><option value="MOFU">MOFU</option><option value="BOFU">BOFU</option></select></Field>
                <Field label="Angle / Framework"><select className={sel} value={formState.angle} onChange={(e) => set({ angle: e.target.value })}>{['AIDA', 'PAS', 'BAB', 'Story', '4P', 'Before-After', 'Social Proof', 'Authority', 'Urgency', 'Curiosity'].map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Emotional Trigger"><select className={sel} value={formState.emotionalTrigger} onChange={(e) => set({ emotionalTrigger: e.target.value })}>{['Fear', 'Desire', 'Curiosity', 'Trust', 'Urgency', 'Social Proof'].map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="CTA Type"><select className={sel} value={formState.ctaType} onChange={(e) => set({ ctaType: e.target.value })}>{['Buy Now', 'Learn More', 'Get Started', 'Try Free', 'Limited Offer'].map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Tone"><select className={sel} value={formState.tone} onChange={(e) => set({ tone: e.target.value })}>{['Professional', 'Casual', 'Excited', 'Empathetic', 'Authoritative', 'Playful', 'Luxury'].map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Brand Voice"><select className={sel} value={formState.brandVoiceId} onChange={(e) => set({ brandVoiceId: e.target.value })}><option value="">Keine</option>{brandVoices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.isDefault ? ' (Default)' : ''}</option>)}</select></Field>
                <div className="flex items-end justify-between gap-3">
                  <div><label className={lbl}>Emojis</label><p className="text-[11px] text-gray-400 dark:text-white/40">Passende Emojis im Text</p></div>
                  <button type="button" onClick={() => set({ useEmojis: !formState.useEmojis })} className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition', formState.useEmojis ? 'bg-accent-meta' : 'bg-gray-200 dark:bg-white/15')}>
                    <span className={cn('inline-block h-4 w-4 rounded-full bg-white transition-transform', formState.useEmojis ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                {([['Headlines', 'headlineCount', 10], ['Primärtexte', 'primaryTextCount', 5], ['Linkbeschr.', 'linkDescriptionCount', 5], ['CTAs', 'ctaCount', 10]] as const).map(([label, key, maxN]) => (
                  <Field key={key} label={label}><select className={sel} value={formState[key] as number} onChange={(e) => set({ [key]: parseInt(e.target.value) } as any)}>{Array.from({ length: maxN }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
                ))}
              </div>
            </section>

            <MetaDivider />

            {/* Zusatzanweisungen */}
            <section className="flex flex-col gap-4">
              <MetaSectionLabel>Zusatzanweisungen (Prompt)</MetaSectionLabel>
              <Field label="Anforderungen — Headline"><textarea className={ta} rows={2} value={formState.headlineRequirements} onChange={(e) => set({ headlineRequirements: e.target.value })} /></Field>
              <Field label="Anforderungen — Primärtext"><textarea className={ta} rows={2} value={formState.primaryTextRequirements} onChange={(e) => set({ primaryTextRequirements: e.target.value })} /></Field>
              <Field label="Anforderungen — Linkbeschreibung"><textarea className={ta} rows={2} value={formState.linkDescriptionRequirements} onChange={(e) => set({ linkDescriptionRequirements: e.target.value })} /></Field>
              <Field label="Anforderungen — CTA"><textarea className={ta} rows={2} value={formState.ctaRequirements} onChange={(e) => set({ ctaRequirements: e.target.value })} /></Field>
              <Field label="Best Performing Hook (optional)"><input className={inp} value={formState.bestPerformingHook} onChange={(e) => set({ bestPerformingHook: e.target.value })} placeholder="Referenz aus früheren Kampagnen" /></Field>
              <Field label="Top Competitor Ad Copy (optional)"><textarea className={ta} rows={2} value={formState.topCompetitorAdCopy} onChange={(e) => set({ topCompetitorAdCopy: e.target.value })} /></Field>
              <Field label="Market Insights (optional)"><textarea className={ta} rows={2} value={formState.marketInsights} onChange={(e) => set({ marketInsights: e.target.value })} /></Field>
            </section>

            <button onClick={handleGenerate} disabled={generateMutation.isPending} className={cn(btnPrimary, 'w-full justify-center py-3 text-sm')}>
              {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Claude AI generiert…</> : <><Sparkles className="h-4 w-4" /> Mit KI generieren</>}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-7">
          {generateMutation.isError ? (
            <div className={cn(META_FRAME, 'flex flex-col items-center gap-3 border-red-200 bg-red-50/60 px-6 py-14 text-center dark:border-red-900/40 dark:bg-red-950/15')}>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Generierung fehlgeschlagen.</p>
              <button onClick={handleGenerate} className={btnGhost}><RefreshCw className="h-4 w-4" /> Erneut versuchen</button>
            </div>
          ) : generateMutation.isPending ? (
            <div className="flex flex-col gap-5">
              <MetaSectionLabel>Generiere…</MetaSectionLabel>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-[10px] border border-gray-200/70 p-4 dark:border-white/[0.07]">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                  <div className="mt-3 space-y-2"><div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" /><div className="h-3 w-5/6 animate-pulse rounded bg-gray-100 dark:bg-white/5" /></div>
                </div>
              ))}
            </div>
          ) : generatedItems.length === 0 ? (
            <div className={META_FRAME}>
              <MetaEmptyState icon={Sparkles} title="Noch nichts generiert"
                description={'Konfiguriere den Kontext links und klicke „Mit KI generieren", um Varianten auf Basis von AIDA, PAS, BAB & Co. zu erstellen.'} />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-2">
                <MetaSectionLabel>{generatedItems.length} Varianten</MetaSectionLabel>
                <div className="flex items-center gap-2">
                  <button onClick={handleGenerate} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-gray-900 dark:text-white/50 dark:hover:text-white"><RefreshCw className="h-3.5 w-3.5" /> Neu generieren</button>
                  <div className="flex gap-0.5 rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
                    {([['list', List], ['grid', LayoutGrid]] as const).map(([m, Ico]) => (
                      <button key={m} onClick={() => setViewMode(m)} className={cn('rounded-md p-1.5 transition', viewMode === m ? 'bg-accent-meta/10 text-accent-meta' : 'text-gray-400 hover:text-gray-600 dark:hover:text-white/70')}><Ico className="h-3.5 w-3.5" /></button>
                    ))}
                  </div>
                </div>
              </div>

              {Object.entries(grouped).map(([type, items]) => (
                <section key={type} className="flex flex-col gap-3">
                  <MetaSectionLabel>{typeLabels[type] || type} · {items.length}</MetaSectionLabel>
                  <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'flex flex-col gap-2.5')}>
                    {items.map((v) => { const gi = generatedItems.indexOf(v); return <VariantRow key={gi} variant={v} index={gi} onSave={() => handleSave(v, gi)} saving={savingIndex === gi} />; })}
                  </div>
                </section>
              ))}

              {angles.length > 0 && (
                <section className="flex flex-col gap-3">
                  <MetaSectionLabel>Angle-Vorschläge · {angles.length}</MetaSectionLabel>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">{angles.map((a, i) => <AngleRow key={i} angle={a} />)}</div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
