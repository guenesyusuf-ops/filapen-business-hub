'use client';

import { useState, useCallback } from 'react';
import {
  Mic,
  Plus,
  X,
  Star,
  Trash2,
  Edit3,
  Shield,
  MessageSquare,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useBrandVoices,
  useCreateBrandVoice,
  useUpdateBrandVoice,
  useDeleteBrandVoice,
} from '@/hooks/content/useBrandVoice';
import type { BrandVoice, CreateBrandVoiceDto } from '@/hooks/content/useBrandVoice';

// ---------------------------------------------------------------------------
// Tone Attribute Slider
// ---------------------------------------------------------------------------

function ToneSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-16 capitalize">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 accent-accent-content"
      />
      <span className="text-xs font-medium text-gray-700 w-8 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create/Edit Modal
// ---------------------------------------------------------------------------

function BrandVoiceModal({
  open,
  onClose,
  editingVoice,
}: {
  open: boolean;
  onClose: () => void;
  editingVoice?: BrandVoice | null;
}) {
  const createMutation = useCreateBrandVoice();
  const updateMutation = useUpdateBrandVoice();

  const [form, setForm] = useState<CreateBrandVoiceDto>({
    name: editingVoice?.name ?? '',
    description: editingVoice?.description ?? '',
    toneAttributes: editingVoice?.toneAttributes ?? {
      formality: 0.5,
      humor: 0.3,
      energy: 0.5,
      warmth: 0.5,
    },
    examples: editingVoice?.examples ?? [''],
    bannedWords: editingVoice?.bannedWords ?? [],
    isDefault: editingVoice?.isDefault ?? false,
  });

  const [bannedWordsText, setBannedWordsText] = useState(
    (editingVoice?.bannedWords ?? []).join(', '),
  );

  const handleSubmit = useCallback(async () => {
    if (!form.name?.trim()) return;
    const data: CreateBrandVoiceDto = {
      ...form,
      bannedWords: bannedWordsText
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean),
      examples: (form.examples ?? []).filter((e) => e.trim()),
    };

    if (editingVoice) {
      await updateMutation.mutateAsync({ id: editingVoice.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  }, [form, bannedWordsText, editingVoice, createMutation, updateMutation, onClose]);

  if (!open) return null;

  const toneAttrs = form.toneAttributes ?? { formality: 0.5, humor: 0.3, energy: 0.5, warmth: 0.5 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-dropdown w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingVoice ? 'Edit Brand Voice' : 'Create Brand Voice'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Brand voice name..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Describe the tone, personality, and style..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content resize-none"
            />
          </div>

          {/* Tone Attributes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Tone Attributes</label>
            <div className="space-y-2.5 rounded-lg bg-surface-secondary p-3">
              {Object.entries(toneAttrs).map(([key, val]) => (
                <ToneSlider
                  key={key}
                  label={key}
                  value={val as number}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      toneAttributes: { ...toneAttrs, [key]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>

          {/* Examples */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Example Phrases
            </label>
            {(form.examples ?? ['']).map((ex, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={ex}
                  onChange={(e) => {
                    const next = [...(form.examples ?? [''])];
                    next[i] = e.target.value;
                    setForm({ ...form, examples: next });
                  }}
                  placeholder="Example phrase..."
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
                />
                {(form.examples ?? []).length > 1 && (
                  <button
                    onClick={() => {
                      const next = [...(form.examples ?? [])];
                      next.splice(i, 1);
                      setForm({ ...form, examples: next });
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() =>
                setForm({ ...form, examples: [...(form.examples ?? []), ''] })
              }
              className="text-xs text-accent-content hover:underline"
            >
              + Add example
            </button>
          </div>

          {/* Banned Words */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Banned Words (comma separated)
            </label>
            <input
              type="text"
              value={bannedWordsText}
              onChange={(e) => setBannedWordsText(e.target.value)}
              placeholder="cheap, buy now, limited time"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-content/30 focus:border-accent-content"
            />
          </div>

          {/* Default */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault ?? false}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-border text-accent-content focus:ring-accent-content/30"
            />
            <span className="text-sm text-gray-700">Set as default brand voice</span>
          </label>
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
            disabled={
              (createMutation.isPending || updateMutation.isPending) || !form.name?.trim()
            }
            className="rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors disabled:opacity-50"
          >
            {(createMutation.isPending || updateMutation.isPending)
              ? 'Saving...'
              : editingVoice
                ? 'Update'
                : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand Voice Card
// ---------------------------------------------------------------------------

function BrandVoiceCard({
  voice,
  onEdit,
}: {
  voice: BrandVoice;
  onEdit: () => void;
}) {
  const deleteMutation = useDeleteBrandVoice();
  const toneAttrs = (voice.toneAttributes ?? {}) as Record<string, number>;

  return (
    <div className="rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-accent-content-light text-accent-content shrink-0">
            <Mic className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">{voice.name}</h4>
            {voice.isDefault && (
              <span className="inline-flex items-center gap-0.5 text-xxs text-accent-content font-medium">
                <Star className="h-2.5 w-2.5 fill-accent-content" />
                Default
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteMutation.mutate(voice.id)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Description */}
      {voice.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{voice.description}</p>
      )}

      {/* Tone bars */}
      {Object.keys(toneAttrs).length > 0 && (
        <div className="space-y-1.5 mb-3">
          {Object.entries(toneAttrs).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xxs text-gray-400 w-14 capitalize">{key}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-content/60 rounded-full transition-all"
                  style={{ width: `${(val as number) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Examples */}
      {voice.examples.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xxs text-gray-400 mb-1">
            <MessageSquare className="h-3 w-3" />
            Examples
          </div>
          <div className="space-y-1">
            {voice.examples.slice(0, 2).map((ex, i) => (
              <p key={i} className="text-xs text-gray-600 italic line-clamp-1">
                &ldquo;{ex}&rdquo;
              </p>
            ))}
            {voice.examples.length > 2 && (
              <p className="text-xxs text-gray-400">
                +{voice.examples.length - 2} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banned words */}
      {voice.bannedWords.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xxs text-gray-400 mb-1">
            <Ban className="h-3 w-3" />
            Banned
          </div>
          <div className="flex flex-wrap gap-1">
            {voice.bannedWords.slice(0, 4).map((word) => (
              <span
                key={word}
                className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xxs text-red-500"
              >
                {word}
              </span>
            ))}
            {voice.bannedWords.length > 4 && (
              <span className="text-xxs text-gray-400">
                +{voice.bannedWords.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content count */}
      {voice.contentCount !== undefined && (
        <div className="text-xxs text-gray-400 mt-3">
          {voice.contentCount} content piece{voice.contentCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BrandVoicePage() {
  const [showModal, setShowModal] = useState(false);
  const [editingVoice, setEditingVoice] = useState<BrandVoice | null>(null);
  const voicesQuery = useBrandVoices();
  const items = voicesQuery.data?.items ?? [];

  const handleEdit = useCallback((voice: BrandVoice) => {
    setEditingVoice(voice);
    setShowModal(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
    setEditingVoice(null);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {showModal && (
        <BrandVoiceModal
          open={showModal}
          onClose={handleClose}
          editingVoice={editingVoice}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Brand Voice</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Define tone, style, and personality for your content
          </p>
        </div>
        <button
          onClick={() => {
            setEditingVoice(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-3 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Voice
        </button>
      </div>

      {/* Loading */}
      {voicesQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-5 shadow-card animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
              </div>
              <div className="h-3 w-full rounded bg-gray-100 mb-2" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {!voicesQuery.isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((voice) => (
            <BrandVoiceCard
              key={voice.id}
              voice={voice}
              onEdit={() => handleEdit(voice)}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!voicesQuery.isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-full bg-accent-content-light text-accent-content mb-4">
            <Mic className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No brand voices yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create a brand voice to maintain consistent tone across content.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-content px-4 py-2 text-sm font-medium text-white hover:bg-accent-content-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Voice
          </button>
        </div>
      )}
    </div>
  );
}
