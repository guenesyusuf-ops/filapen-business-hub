'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { getAuthHeaders } from '@/stores/auth';

const API_BASE = `${API_URL}/api/meta-ads/import`;

export type ImportType = 'meta' | 'hyros';
export type RowStatus = 'ready' | 'warning' | 'unknown' | 'duplicate' | 'invalid' | 'skipped';

export interface PreviewRow {
  rowIndex: number;
  metaAdId: string | null;
  adName: string | null;
  date: string | null;
  dateAmbiguous: boolean;
  values: Record<string, number>;
  matchedAdId: string | null;
  matchedAdName: string | null;
  matchedBy: 'id' | 'name' | null;
  status: RowStatus;
  errors: string[];
  warnings: string[];
}

export interface AnalyzeResult {
  type: ImportType;
  filename: string;
  headers: string[];
  mapping: Record<string, string | null>;
  unmapped: string[];
  rows: PreviewRow[];
  summary: { total: number; ready: number; warning: number; unknown: number; duplicate: number; invalid: number };
}

export interface CommitRow {
  date: string;
  values: Record<string, number>;
  action: 'insert' | 'update' | 'skip';
  adId?: string | null;
  createAd?: Record<string, unknown> | null;
}

export interface CommitResult {
  importId: string;
  status: 'completed' | 'partial' | 'failed';
  summary: { total: number; created: number; updated: number; skipped: number; errors: number };
  errorDetails: { row: number; message: string }[];
}

export interface ImportRecord {
  id: string; type: ImportType; filename: string;
  rowCount: number; successCount: number; errorCount: number; skippedCount: number; updatedCount: number;
  status: string; mappingConfig: Record<string, string | null> | null;
  errorSummary: { row: number; message: string }[] | null; createdAt: string | null;
}

async function analyzeRequest(input: {
  type: ImportType; file: File; mapping?: Record<string, string | null>; prefer?: 'dmy' | 'mdy';
}): Promise<AnalyzeResult> {
  const fd = new FormData();
  fd.append('file', input.file);
  fd.append('type', input.type);
  if (input.mapping) fd.append('mapping', JSON.stringify(input.mapping));
  if (input.prefer) fd.append('prefer', input.prefer);
  // WICHTIG: KEIN Content-Type setzen — der Browser setzt die multipart-boundary.
  const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', headers: getAuthHeaders(), body: fd });
  if (!res.ok) throw new Error(await errMessage(res));
  return res.json();
}

async function commitRequest(input: {
  type: ImportType; filename: string; mappingConfig?: Record<string, string | null>; rows: CommitRow[];
}): Promise<CommitResult> {
  const res = await fetch(`${API_BASE}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errMessage(res));
  return res.json();
}

async function errMessage(res: Response): Promise<string> {
  try { const j = await res.json(); return Array.isArray(j?.message) ? j.message.join(', ') : (j?.message ?? `Fehler ${res.status}`); }
  catch { return `Fehler ${res.status}`; }
}

export function useAnalyzeImport() {
  return useMutation({ mutationFn: analyzeRequest });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: commitRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meta-ads', 'import-history'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'ads'] });
      qc.invalidateQueries({ queryKey: ['meta-ads', 'overview'] });
    },
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: ['meta-ads', 'import-history'],
    queryFn: async (): Promise<{ items: ImportRecord[] }> => {
      const res = await fetch(`${API_BASE}/history`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await errMessage(res));
      return res.json();
    },
  });
}

export const IMPORT_FIELD_LABELS: Record<string, string> = {
  metaAdId: 'Meta Ad ID', adName: 'Ad Name', date: 'Datum', spend: 'Spend', impressions: 'Impressionen',
  hookRate: 'Hook Rate', holdRate: 'Hold Rate', videoViews3s: '3s Views', videoViews25: '25% Views',
  videoViews50: '50% Views', videoViews75: '75% Views', videoViews95: '95% Views', videoViews100: '100% Views',
  thruplays: 'ThruPlays', averageWatchTimeSeconds: 'Ø Wiedergabe (s)', cpcAll: 'CPC (Alle)', ctrAll: 'CTR (Alle)',
  outboundCtr: 'Ausgehende CTR', totalSales: 'Sales gesamt', uniqueSales: 'Unique Sales', hyrosRoas: 'Hyros ROAS', revenue: 'Umsatz',
};

export const META_FIELD_KEYS = [
  'metaAdId', 'adName', 'date', 'spend', 'impressions', 'hookRate', 'holdRate',
  'videoViews3s', 'videoViews25', 'videoViews50', 'videoViews75', 'videoViews95', 'videoViews100',
  'thruplays', 'averageWatchTimeSeconds', 'cpcAll', 'ctrAll', 'outboundCtr',
];
export const HYROS_FIELD_KEYS = ['metaAdId', 'adName', 'date', 'totalSales', 'uniqueSales', 'hyrosRoas', 'revenue'];
