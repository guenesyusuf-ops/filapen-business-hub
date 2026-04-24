'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  Users,
  MessageSquare,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@filapen/shared/src/utils/money';
import { useBrands, useCreateBrand } from '@/hooks/influencers/useBrands';

// ---------------------------------------------------------------------------
// Brand Logo placeholder
// ---------------------------------------------------------------------------

const BRAND_COLORS = [
  '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#0EA5E9', '#D946EF', '#22C55E', '#E11D48', '#7C3AED',
];

function BrandLogo({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % BRAND_COLORS.length;
  const color = BRAND_COLORS[colorIndex];
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-xl',
  };

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center font-bold text-white shrink-0',
        sizeClasses[size],
      )}
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Brand Modal
// ---------------------------------------------------------------------------

function CreateBrandModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState('');
  const createMutation = useCreateBrand();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      createMutation.mutate(
        {
          name: name.trim(),
          category: category.trim() || undefined,
          website: website.trim() || undefined,
        },
        { onSuccess: onClose },
      );
    },
    [name, category, website, createMutation, onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Brand</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nike"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Sports & Fitness"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-300 focus:ring-1 focus:ring-orange-200 outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand Card
// ---------------------------------------------------------------------------

function BrandCard({ brand }: { brand: any }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/influencers/brands/${brand.id}`)}
      className="group text-left rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all border-t-2 border-orange-400"
    >
      <div className="flex items-start gap-3 mb-3">
        <BrandLogo name={brand.name} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
            {brand.name}
          </h3>
          {brand.category && (
            <span className="text-xs text-gray-500">{brand.category}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">
            <span className="font-semibold text-gray-900 dark:text-white">{brand.totalInfluencers}</span> creators
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">
            <span className="font-semibold text-gray-900 dark:text-white">{brand.totalMentions}</span> mentions
          </span>
        </div>
      </div>

      {brand.channels && brand.channels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {brand.channels.map((ch: string) => (
            <span
              key={ch}
              className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-gray-600"
            >
              {ch}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BrandsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { data: brands, isLoading, isError } = useBrands(searchQuery || undefined);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Brands</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track brand relationships and influencer collaborations
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Brand
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:border-orange-300 focus-within:ring-1 focus-within:ring-orange-200">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
            >
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load brands. Please try again.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-5 shadow-card animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-gray-200" />
                <div className="flex-1">
                  <div className="h-3.5 w-24 rounded bg-gray-200 mb-1" />
                  <div className="h-2.5 w-16 rounded bg-gray-100" />
                </div>
              </div>
              <div className="h-6 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && brands && (
        <>
          {brands.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No brands found</h3>
              <p className="text-xs text-gray-500 mb-4">
                Add brands to start tracking influencer relationships
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Brand
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {brands.map((brand) => (
                <BrandCard key={brand.id} brand={brand} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && <CreateBrandModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
