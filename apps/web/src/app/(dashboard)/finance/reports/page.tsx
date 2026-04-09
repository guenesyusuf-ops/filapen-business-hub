'use client';

import { useState, useCallback } from 'react';
import {
  FileText,
  BarChart3,
  ShoppingBag,
  Download,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const REPORTS: ReportDef[] = [
  {
    id: 'pnl',
    title: 'P&L Report',
    description: 'Comprehensive profit and loss statement with revenue, costs, and net profit breakdown by period.',
    icon: <FileText className="h-5 w-5" />,
    color: '#2563EB',
  },
  {
    id: 'product',
    title: 'Product Report',
    description: 'Product-level revenue, units sold, margins, and performance rankings.',
    icon: <ShoppingBag className="h-5 w-5" />,
    color: '#059669',
  },
  {
    id: 'channel',
    title: 'Channel Report',
    description: 'Revenue, ad spend, ROAS, and conversion metrics per acquisition channel.',
    icon: <BarChart3 className="h-5 w-5" />,
    color: '#D97706',
  },
];

// ---------------------------------------------------------------------------
// Report Card
// ---------------------------------------------------------------------------

type FormatType = 'csv' | 'pdf';

function ReportCard({ report }: { report: ReportDef }) {
  const [format, setFormat] = useState<FormatType>('csv');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toastVisible, setToastVisible] = useState(false);

  const handleGenerate = useCallback(() => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  return (
    <div className="rounded-xl bg-white p-6 shadow-card hover:shadow-card-hover transition-all duration-200 relative overflow-hidden">
      {/* Toast */}
      {toastVisible && (
        <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 animate-fade-in z-10">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Report generation coming soon
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div
          className="flex items-center justify-center h-10 w-10 rounded-lg"
          style={{ backgroundColor: `${report.color}12`, color: report.color }}
        >
          {report.icon}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{report.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{report.description}</p>
        </div>
      </div>

      {/* Date Range */}
      <div className="mb-4">
        <label className="text-xxs font-medium uppercase tracking-wider text-gray-400 block mb-2">
          Date Range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border pl-8 pr-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border pl-8 pr-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Format Selector */}
      <div className="mb-5">
        <label className="text-xxs font-medium uppercase tracking-wider text-gray-400 block mb-2">
          Format
        </label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['csv', 'pdf'] as FormatType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                format === f
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-500 hover:bg-surface-secondary',
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Generate Report
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate and download financial reports for your business
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {REPORTS.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-900">Scheduled Reports</h4>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Automated report scheduling is coming soon. You will be able to configure weekly or
              monthly reports delivered directly to your inbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
