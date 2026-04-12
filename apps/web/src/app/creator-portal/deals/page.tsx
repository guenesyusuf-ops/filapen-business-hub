'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortalDeal {
  id: string;
  title: string;
  type: string;
  stage: string;
  amount: number | null;
  deadline: string | null;
  paymentStatus: string;
  createdAt: string;
}

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;

const STAGE_COLORS: Record<string, string> = {
  lead: '#6b7280',
  pitched: '#3b82f6',
  negotiation: '#f59e0b',
  contracted: '#8b5cf6',
  in_progress: '#06b6d4',
  review: '#f97316',
  completed: '#10b981',
  paid: '#059669',
  cancelled: '#ef4444',
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  pitched: 'Pitched',
  negotiation: 'Negotiation',
  contracted: 'Contracted',
  in_progress: 'In Progress',
  review: 'Review',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export default function PortalDealsPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [deals, setDeals] = useState<PortalDeal[]>([]);
  const [loading, setLoading] = useState(true);

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
    async function fetchDeals() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/deals?creatorId=${creatorId}`);
        if (res.ok) {
          const data = await res.json();
          setDeals(Array.isArray(data) ? data : data.items ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, [creatorId]);

  if (!creatorId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Deals</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View deals assigned to you
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
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Handshake className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">No deals yet</p>
          <p className="text-xs text-gray-500">
            Deals assigned to you will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="rounded-xl bg-white p-5 border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {deal.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{
                        backgroundColor: STAGE_COLORS[deal.stage] ?? '#6b7280',
                      }}
                    >
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {deal.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {deal.amount != null && deal.amount > 0 && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium">{deal.amount.toLocaleString()}</span>
                    </div>
                  )}
                  {deal.deadline && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span>
                        {new Date(deal.deadline).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
