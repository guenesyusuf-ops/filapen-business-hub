'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Printer, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { shippingApi, SHIPMENT_STATUS_LABELS, CARRIER_LABELS, fmtDateTime, type OrderShipmentStatus } from '@/lib/shipping';
import { PageHeader, btn, Badge, SectionCard, input as inputCls, label as labelCls } from '@/components/shipping/ShippingUI';

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');

  const reload = () => {
    shippingApi.getShipment(id)
      .then((d) => { setData(d); setTrackingInput(d.trackingNumber || ''); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [id]);

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>;
  if (!data) return null;

  const s = data;
  const st = SHIPMENT_STATUS_LABELS[s.status as OrderShipmentStatus];
  const addr = s.recipientAddress as any;

  const setStatus = async (next: OrderShipmentStatus) => {
    try { await shippingApi.setShipmentStatus(id, next); reload(); }
    catch (e: any) { alert(e.message); }
  };

  const saveTracking = async () => {
    try { await shippingApi.setTracking(id, trackingInput); setEditingTracking(false); reload(); }
    catch (e: any) { alert(e.message); }
  };

  const printLabel = (url: string) => {
    // Open in new window with print trigger
    const w = window.open(url + '#print', '_blank');
    if (!w) window.open(url, '_blank');
  };

  const regenerateLabel = async () => {
    try { await shippingApi.regenerateLabel(id); reload(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title={`Sendung ${s.trackingNumber || '—'}`}
        subtitle={`Bestellung #${s.order?.orderNumber} · ${CARRIER_LABELS[s.carrier as keyof typeof CARRIER_LABELS]}`}
        actions={<Link href="/shipping/shipments" className={btn('ghost')}><ArrowLeft className="h-4 w-4" /> Liste</Link>}
      />

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Badge color={st.color}>{st.label}</Badge>
            {s.apiMode ? (
              <Badge color="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">API-Mode</Badge>
            ) : (
              <Badge color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Stub-Mode</Badge>
            )}
            {s.trackingUrl && (
              <a href={s.trackingUrl} target="_blank" rel="noopener" className="text-xs text-primary-600 hover:underline">
                Tracking extern öffnen →
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {s.status === 'label_created' && <button onClick={() => setStatus('handed_to_carrier')} className={btn('secondary')}>Übergeben</button>}
            {['handed_to_carrier', 'in_transit'].includes(s.status) && <button onClick={() => setStatus('out_for_delivery')} className={btn('secondary')}>In Zustellung</button>}
            {s.status === 'out_for_delivery' && <button onClick={() => setStatus('delivered')} className={btn('secondary')}>Zugestellt</button>}
            {!['delivered', 'returned', 'cancelled'].includes(s.status) && (
              <>
                <button onClick={() => setStatus('ready_for_pickup')} className={btn('secondary', 'text-xs')}>Abholbereit</button>
                <button onClick={() => setStatus('delivery_failed')} className={btn('secondary', 'text-xs')}>Zustellung gescheitert</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left */}
        <div className="space-y-4">
          <SectionCard title="Empfänger">
            <div className="text-sm space-y-1">
              <div className="font-medium text-gray-900 dark:text-white">{s.recipientName}</div>
              <div>{addr?.street}</div>
              {addr?.address2 && <div>{addr.address2}</div>}
              <div>{addr?.zip} {addr?.city}</div>
              <div className="text-xs text-gray-500 mt-2">{addr?.country}</div>
              {s.recipientEmail && <div className="text-xs text-gray-500 mt-2">{s.recipientEmail}</div>}
              {s.recipientPhone && <div className="text-xs text-gray-500">{s.recipientPhone}</div>}
            </div>
          </SectionCard>

          <SectionCard title="Tracking">
            {editingTracking ? (
              <div className="space-y-2">
                <input className={inputCls()} value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={saveTracking} className={btn('primary', 'flex-1')}>Speichern</button>
                  <button onClick={() => { setEditingTracking(false); setTrackingInput(s.trackingNumber || ''); }} className={btn('ghost')}>Abbr.</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="font-mono text-sm text-gray-900 dark:text-white">{s.trackingNumber || '—'}</div>
                <button onClick={() => setEditingTracking(true)} className="mt-2 text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
                  <Edit className="h-3 w-3" /> Bearbeiten
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Maße & Gewicht">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Gewicht</dt><dd>{s.weightG ? (s.weightG / 1000).toFixed(2) + ' kg' : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">L × B × H</dt><dd>{s.lengthMm && s.widthMm && s.heightMm ? `${s.lengthMm}×${s.widthMm}×${s.heightMm} mm` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Methode</dt><dd>{s.shippingMethod || '—'}</dd></div>
            </dl>
          </SectionCard>
        </div>

        {/* Right: labels + events */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard
            title={`Labels (${s.labels?.length || 0})`}
            actions={<button onClick={regenerateLabel} className={btn('secondary', 'h-8 px-2 py-1 text-xs')}><RefreshCw className="h-3 w-3" /> Neu generieren</button>}
          >
            {!s.labels?.length ? (
              <div className="text-sm text-gray-400 text-center py-6">Keine Labels vorhanden</div>
            ) : (
              <div className="space-y-2">
                {s.labels.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-white/8 rounded-lg">
                    <div>
                      <div className="font-mono text-xs text-gray-700 dark:text-gray-300">{l.trackingNumber || '—'}</div>
                      <div className="text-xs text-gray-400">Format: {l.format} · {l.widthMm && l.heightMm ? `${l.widthMm}×${l.heightMm} mm` : '—'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => printLabel(l.url)} className={btn('primary', 'h-8 px-3 py-1 text-xs')}>
                        <Printer className="h-3.5 w-3.5" /> Drucken
                      </button>
                      <a href={l.url} target="_blank" rel="noopener" className={btn('secondary', 'h-8 px-3 py-1 text-xs')}>
                        <Download className="h-3.5 w-3.5" /> Öffnen
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={`Verlauf (${s.statusEvents?.length || 0})`}>
            {!s.statusEvents?.length ? (
              <div className="text-sm text-gray-400">Keine Events</div>
            ) : (
              <ol className="space-y-2">
                {s.statusEvents.map((e: any) => {
                  const est = SHIPMENT_STATUS_LABELS[e.status as OrderShipmentStatus];
                  return (
                    <li key={e.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary-500" />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <Badge color={est.color}>{est.label}</Badge>
                          <span className="text-xs text-gray-400">{fmtDateTime(e.occurredAt)}</span>
                        </div>
                        {e.note && <div className="text-xs text-gray-500 mt-1">{e.note}</div>}
                        <div className="text-[10px] text-gray-400 uppercase mt-0.5">Quelle: {e.source}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
