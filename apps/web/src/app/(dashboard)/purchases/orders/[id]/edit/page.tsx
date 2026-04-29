'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { purchasesApi, type PurchaseOrder } from '@/lib/purchases';
import { btn, input, label, PageHeader, Money } from '@/components/purchases/PurchaseUI';
import { useAuthStore } from '@/stores/auth';

/**
 * Edit-Page für angelegte Bestellungen. Bewusst MINIMAL gehalten — nur
 * Felder die nach Anlage typisch korrigiert werden:
 *   - orderDate, expectedDelivery, paymentTerms, currency
 *   - notes (wichtige Infos), internalNotes
 *
 * Line-Items, totals und supplier sind immutable damit Finanz-Tracking nicht
 * inkonsistent wird. Wer das ändern muss → stornieren + neu anlegen.
 *
 * Permission: nur Ersteller oder admin/owner. Bei Verstoss zeigen wir eine
 * read-only-Meldung statt Form. Backend-Schutz waere Phase 2.
 */
export default function OrderEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { user } = useAuthStore();

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable Form-State
  const [orderDate, setOrderDate] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    purchasesApi.getOrder(id)
      .then((d) => {
        setOrder(d);
        setOrderDate(d.orderDate?.split('T')[0] ?? '');
        setExpectedDelivery(d.expectedDelivery?.split('T')[0] ?? '');
        setPaymentTerms((d as any).paymentTerms ?? '');
        setNotes(d.notes ?? '');
        setInternalNotes((d as any).internalNotes ?? '');
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }
  if (!order) return null;

  const canEdit = !!user && (
    user.id === order.createdById ||
    user.role === 'admin' ||
    user.role === 'owner'
  );

  if (!canEdit) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <PageHeader
          title={`${order.orderNumber} bearbeiten`}
          actions={<Link href={`/purchases/orders/${id}`} className={btn('ghost')}><ArrowLeft className="h-4 w-4" /> Zurück</Link>}
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-6 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <Lock className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Keine Berechtigung.</strong>
            <p className="mt-1">Nur der Ersteller dieser Bestellung oder ein Admin kann sie bearbeiten.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await purchasesApi.updateOrder(id, {
        orderDate: orderDate || undefined,
        expectedDelivery: expectedDelivery || null,
        paymentTerms: paymentTerms.trim() || null,
        notes: notes.trim() || null,
        internalNotes: internalNotes.trim() || null,
      });
      router.push(`/purchases/orders/${id}`);
    } catch (e: any) {
      alert(`Speichern fehlgeschlagen: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader
        title={`${order.orderNumber} bearbeiten`}
        subtitle={`${order.supplier?.companyName} · ${order.items?.length || 0} Position${order.items?.length === 1 ? '' : 'en'}`}
        actions={
          <Link href={`/purchases/orders/${id}`} className={btn('ghost')}>
            <ArrowLeft className="h-4 w-4" /> Abbrechen
          </Link>
        }
      />

      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label()}>Bestelldatum</label>
            <input type="date" className={input()} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label className={label()}>Erwartetes Lieferdatum</label>
            <input type="date" className={input()} value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={label()}>Zahlungsbedingungen</label>
            <input type="text" className={input()} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="z.B. Netto 30 Tage" />
          </div>
          <div className="col-span-2">
            <label className={label()}>Wichtige Infos / Notiz</label>
            <textarea
              rows={3}
              className={input()}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. Lieferung in 2 Tranchen, Sonderkonditionen…"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Wird in der Bestell-Übersicht als Kommentar-Icon angezeigt.
            </p>
          </div>
          <div className="col-span-2">
            <label className={label()}>Interne Notiz (nur intern sichtbar)</label>
            <textarea
              rows={2}
              className={input()}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Read-only Hinweis fuer Position/Beträge */}
      <div className="rounded-2xl border border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] p-4 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Read-only:</strong> Lieferant, Positionen und Gesamtbetrag (
          <Money amount={order.totalAmount} currency={order.currency} />
          ) können nach der Anlage nicht mehr geändert werden — sonst wird das Finanz-Tracking inkonsistent. Wenn etwas grundsätzlich falsch ist, Bestellung stornieren und neu anlegen.
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href={`/purchases/orders/${id}`} className={btn('ghost')}>Abbrechen</Link>
        <button onClick={handleSave} disabled={saving} className={btn('primary')}>
          <Save className="h-4 w-4" />
          {saving ? 'Speichere…' : 'Änderungen speichern'}
        </button>
      </div>
    </div>
  );
}
