'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Package, Clock, Boxes, AlertTriangle, Info } from 'lucide-react';
import { PageHeader, Button, Card, CardBody, KpiTile, StatusPill } from '@/components/ds';
import { dropshippingApi, DsStats, DsSyncLog, DsOrderStatus, DS_STATUS_LABELS } from '@/lib/dropshipping';

const STATUS_TONE: Record<DsOrderStatus, 'ok' | 'warn' | 'crit' | 'info' | 'neutral'> = {
  new: 'info',
  shipped_cn: 'warn',
  in_de: 'info',
  delivered: 'ok',
  on_hold: 'crit',
};

export default function DropshippingOverviewPage() {
  const [stats, setStats] = useState<DsStats | null>(null);
  const [lastSync, setLastSync] = useState<DsSyncLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, ls] = await Promise.all([dropshippingApi.stats(), dropshippingApi.lastSync()]);
      setStats(s);
      setLastSync(ls);
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await dropshippingApi.runSync();
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Sync fehlgeschlagen');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
      <PageHeader
        eyebrow="Dropshipping"
        title="Übersicht"
        subtitle="Bestellungen mit Dropship-Artikeln werden stündlich aus Shopify übernommen und dem Partner bereitgestellt."
        actions={
          <Button variant="primary" leftIcon={<RefreshCw size={16} />} loading={syncing} onClick={runSync}>
            Jetzt synchronisieren
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Aktive Regeln" value={loading ? '–' : stats?.activeRules ?? 0} visual={<Boxes size={18} />} />
        <KpiTile label="Bestellungen gesamt" value={loading ? '–' : stats?.total ?? 0} visual={<Package size={18} />} />
        <KpiTile label="Neu / offen" value={loading ? '–' : stats?.byStatus.new ?? 0} visual={<Clock size={18} />} />
        <KpiTile label="Überfällig (>48h)" value={loading ? '–' : stats?.overdue ?? 0} trend={stats && stats.overdue > 0 ? 'down' : 'flat'} visual={<AlertTriangle size={18} />} />
      </div>

      <Card>
        <CardBody>
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-[var(--text-primary)]">Status-Verteilung</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DS_STATUS_LABELS) as DsOrderStatus[]).map((s) => (
              <StatusPill key={s} tone={STATUS_TONE[s]}>
                {DS_STATUS_LABELS[s]}: {loading ? '–' : stats?.byStatus[s] ?? 0}
              </StatusPill>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-[var(--text-primary)]">Letzter Sync</h3>
          {lastSync ? (
            <div className="text-[14px] text-[var(--text-secondary)] flex flex-col gap-1">
              <div>
                {new Date(lastSync.startedAt).toLocaleString('de-DE')} · Auslöser:{' '}
                <span className="font-medium text-[var(--text-primary)]">{lastSync.trigger}</span>{' '}
                {lastSync.status === 'ok'
                  ? <StatusPill tone="ok">OK</StatusPill>
                  : <StatusPill tone="crit">Fehler</StatusPill>}
              </div>
              <div>
                {lastSync.ordersScanned} geprüft · {lastSync.ordersCreated} neu · {lastSync.ordersUpdated} aktualisiert
              </div>
              {lastSync.error && <div className="text-[rgb(var(--color-error))]">{lastSync.error}</div>}
            </div>
          ) : (
            <div className="text-[14px] text-[var(--text-secondary)]">Noch kein Sync gelaufen. Klicke auf „Jetzt synchronisieren".</div>
          )}
        </CardBody>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-[13.5px] text-[var(--text-secondary)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Das externe Partner-Portal (englisch, eigener Login) und die automatische Rückschreibung der
          Sendungsnummer nach Shopify folgen in Phase&nbsp;2 und&nbsp;3. In Phase&nbsp;1 kann noch niemand von außen zugreifen.
        </span>
      </div>
    </div>
  );
}
