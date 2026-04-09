'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';

interface PortalBriefing {
  id: string;
  title: string;
  content: string;
  dealTitle?: string;
  status: string;
  createdAt: string;
}

const API_BASE = '/api';

export default function PortalBriefingsPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [briefings, setBriefings] = useState<PortalBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('creator_data');
    if (stored) {
      try {
        const c = JSON.parse(stored);
        setCreatorId(c.id);
      } catch {
        router.push('/creator-portal');
      }
    } else {
      router.push('/creator-portal');
    }
  }, [router]);

  useEffect(() => {
    if (!creatorId) return;
    async function fetchBriefings() {
      setLoading(true);
      try {
        // First get deals for this creator, then get briefings for those deals
        const dealsRes = await fetch(`${API_BASE}/deals?creatorId=${creatorId}`);
        if (!dealsRes.ok) {
          setLoading(false);
          return;
        }
        const dealsData = await dealsRes.json();
        const dealsList = Array.isArray(dealsData) ? dealsData : dealsData.items ?? [];

        const allBriefings: PortalBriefing[] = [];
        for (const deal of dealsList) {
          try {
            const briefRes = await fetch(`${API_BASE}/briefings?dealId=${deal.id}`);
            if (briefRes.ok) {
              const briefs = await briefRes.json();
              const items = Array.isArray(briefs) ? briefs : briefs.items ?? [];
              allBriefings.push(
                ...items.map((b: any) => ({ ...b, dealTitle: deal.title })),
              );
            }
          } catch {
            // ignore individual failures
          }
        }
        setBriefings(allBriefings);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchBriefings();
  }, [creatorId]);

  if (!creatorId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Briefings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View briefings for your deals
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-white p-5 border border-gray-100 animate-pulse"
            >
              <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
              <div className="h-3 w-32 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : briefings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">No briefings yet</p>
          <p className="text-xs text-gray-500">
            Briefings for your deals will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map((briefing) => (
            <div
              key={briefing.id}
              className="rounded-xl bg-white border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === briefing.id ? null : briefing.id)
                }
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {briefing.title}
                  </h3>
                  {briefing.dealTitle && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Deal: {briefing.dealTitle}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(briefing.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </button>
              {expandedId === briefing.id && (
                <div className="px-5 pb-4 border-t border-gray-50">
                  <div className="prose prose-sm max-w-none text-gray-700 mt-3">
                    <p className="whitespace-pre-wrap">{briefing.content}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
