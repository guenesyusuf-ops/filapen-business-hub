'use client';

import { useState } from 'react';
import { Save, Building2, Globe, Clock, Calendar, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme';
import { useLanguageStore } from '@/stores/language';
import { useFinanceUI } from '@/stores/finance-ui';

const TIMEZONES = [
  'UTC',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

const FISCAL_MONTHS = [
  { value: '1', label: 'January' },
  { value: '4', label: 'April' },
  { value: '7', label: 'July' },
  { value: '10', label: 'October' },
];

export default function GeneralSettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const { locale, setLocale } = useLanguageStore();
  const { currency, setCurrency } = useFinanceUI();

  const [orgName, setOrgName] = useState('My Organization');
  const [timezone, setTimezone] = useState('UTC');
  const [fiscalStart, setFiscalStart] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    // Simulate save
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">General Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage your organization preferences
        </p>
      </div>

      {/* Organization */}
      <section className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Building2 className="h-4 w-4 text-primary-500" />
          Organization
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Organization Name
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full rounded-lg border border-border dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
        </div>
      </section>

      {/* Regional */}
      <section className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Globe className="h-4 w-4 text-primary-500" />
          Regional
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-border dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Fiscal Year Start
            </label>
            <select
              value={fiscalStart}
              onChange={(e) => setFiscalStart(e.target.value)}
              className="w-full rounded-lg border border-border dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            >
              {FISCAL_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Language
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'en' | 'de')}
              className="w-full rounded-lg border border-border dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-xl bg-white dark:bg-[var(--card-bg)] shadow-card dark:shadow-[var(--card-shadow)] p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Palette className="h-4 w-4 text-primary-500" />
          Appearance
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setTheme(opt)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  theme === opt
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-white/5 border-border dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10',
                )}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all',
            saving
              ? 'bg-primary-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]',
          )}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 animate-fade-in">
            Settings saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
