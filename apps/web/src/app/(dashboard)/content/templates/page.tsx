'use client';

import { useState, useCallback } from 'react';
import {
  LayoutTemplate,
  Plus,
  Search,
  X,
  Shield,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useTemplates, useCreateTemplate } from '@/hooks/content/useTemplates';
import type { ContentTemplate } from '@/hooks/content/useTemplates';
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
} from '@/hooks/content/useContent';

// ---------------------------------------------------------------------------
// Create Template Modal
// ---------------------------------------------------------------------------

function CreateTemplateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreateTemplate();
  const [form, setForm] = useState({
    name: '',
    type: 'headline',
    promptTemplate: '',
    category: '',
    productName: '',
    performanceNotes: '',
  });

  // Fetch products from Finance Hub
  const { data: productsData } = useQuery({
    queryKey: ['finance', 'products', 'all-for-templates'],
    queryFn: () =>
      fetch(`${API_URL}/api/finance/products?startDate=2020-01-01&endDate=2030-01-01&pageSize=100`)
        .then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const products = productsData?.products ?? [];

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.promptTemplate.trim()) return;
    await createMutation.mutateAsync({
      name: form.name,
      type: form.type,
      promptTemplate: form.promptTemplate,
      category: form.category || undefined,
      productName: form.productName || undefined,
      performanceNotes: form.performanceNotes || undefined,
    } as any);
    onClose();
    setForm({ name: '', type: 'headline', promptTemplate: '', category: '', productName: '', performanceNotes: '' });
  }, [form, createMutation, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Template name..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONTENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Headlines, Ad Copy"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
              />
            </div>
          </div>
          {/* Product Dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Produkt zuordnen</label>
            <select
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            >
              <option value="">Kein Produkt zugeordnet</option>
              {products.map((p: any) => (
                <option key={p.productId} value={p.title}>
                  {p.title} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Winning Example / Prompt Template
            </label>
            <textarea
              value={form.promptTemplate}
              onChange={(e) => setForm({ ...form, promptTemplate: e.target.value })}
              rows={5}
              placeholder="Erfolgreicher Text-Beispiel oder Template mit {variable} Syntax..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
            />
            <p className="text-xxs text-gray-400 mt-1">
              Trage hier erfolgreiche Texte ein, die als Referenz fuer die KI dienen.
              Oder nutze {'{product}'}, {'{audience}'}, {'{benefit}'} als Variablen.
            </p>
          </div>

          {/* Performance Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Warum funktioniert es? (optional)
            </label>
            <textarea
              value={form.performanceNotes}
              onChange={(e) => setForm({ ...form, performanceNotes: e.target.value })}
              rows={2}
              placeholder="z.B. Hohe CTR durch emotionalen Hook, Social Proof im ersten Satz..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.name.trim() || !form.promptTemplate.trim()}
            className="rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

function TemplateCard({ template }: { template: ContentTemplate }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium',
              CONTENT_TYPE_COLORS[template.type] ?? 'bg-gray-100 text-gray-600',
            )}
          >
            {CONTENT_TYPE_LABELS[template.type] ?? template.type}
          </span>
          {template.isSystem && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-xxs font-medium text-blue-600">
              <Shield className="h-2.5 w-2.5" />
              System
            </span>
          )}
          {template.productName && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xxs font-medium text-emerald-600">
              <Package className="h-2.5 w-2.5" />
              {template.productName}
            </span>
          )}
        </div>
        {template.category && (
          <span className="text-xxs text-gray-400">{template.category}</span>
        )}
      </div>

      <h4 className="text-sm font-medium text-gray-900 mb-2">{template.name}</h4>

      <div className="rounded-lg bg-surface-secondary p-3 mb-3">
        <p className="text-xs text-gray-600 font-mono line-clamp-3 whitespace-pre-line">
          {template.promptTemplate}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xxs text-gray-400">
          Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}
        </span>
        <button className="inline-flex items-center gap-1 rounded-lg border border-accent-content text-accent-content px-2.5 py-1 text-xs font-medium hover:bg-accent-content hover:text-white transition-colors opacity-0 group-hover:opacity-100">
          Use
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function HowTemplatesWork() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-semibold text-blue-900">How Templates Work</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-blue-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-600" />
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 text-sm text-blue-800">
          <p>
            Each template contains a <strong>prompt template</strong> with variables like{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">{'{{product_name}}'}</code>,{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">{'{{benefits}}'}</code>,{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">{'{{audience}}'}</code>.
          </p>
          <p>
            When you generate content, the template variables are replaced with the inputs you provide
            (product name, target audience, key benefits, etc.) to produce tailored marketing copy.
          </p>
          <p>
            <strong>System templates</strong> (marked with the{' '}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xxs font-medium text-blue-600">
              <Shield className="h-2.5 w-2.5" /> System
            </span>{' '}
            badge) are pre-built by Filapen and optimized for common use cases.
          </p>
          <p>
            <strong>Custom templates</strong> are created by you. Click &ldquo;Create Template&rdquo; to add your own
            templates with custom prompt structures tailored to your brand and workflows.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const templatesQuery = useTemplates({
    search: search || undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    pageSize: 50,
  });

  const items = templatesQuery.data?.items ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <CreateTemplateModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Content Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reusable templates for consistent content creation
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-3 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Template
        </button>
      </div>

      {/* How Templates Work */}
      <HowTemplatesWork />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-lg border border-border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-content/30"
        >
          <option value="all">All Types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {templatesQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-5 shadow-card animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-5 w-16 rounded-full bg-gray-200" />
              </div>
              <div className="h-4 w-40 rounded bg-gray-200 mb-3" />
              <div className="h-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {!templatesQuery.isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!templatesQuery.isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-50 text-blue-600 mb-4">
            <LayoutTemplate className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No templates found</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first template to get started.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Template
          </button>
        </div>
      )}
    </div>
  );
}
