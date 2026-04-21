'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MailPlus, ExternalLink, Save } from 'lucide-react';
import { shippingApi, SHIPMENT_STATUS_LABELS, type OrderShipmentStatus } from '@/lib/shipping';
import { emailApi as emApi, type EmailTemplate } from '@/lib/email-marketing';
import { PageHeader, btn, Badge, input as inputCls, label as lblCls, SectionCard } from '@/components/shipping/ShippingUI';

type EditState = Record<string, { templateId: string; enabled: boolean; sendDelayMinutes: number; subject: string }>;

const TRIGGER_HINTS: Partial<Record<OrderShipmentStatus, string>> = {
  label_created: 'Email sofort nach Label-Erstellung (z.B. "Deine Bestellung wird versandfertig gemacht")',
  handed_to_carrier: 'Sobald Paket an Carrier übergeben wurde',
  in_transit: 'Paket ist unterwegs',
  out_for_delivery: 'Paket ist in der Zustellung',
  delivered: 'Zustellbestätigung',
  delivery_failed: 'Zustellung fehlgeschlagen — wichtig für Kundenservice',
  ready_for_pickup: 'Paket liegt zur Abholung bereit (Packstation/Postfiliale)',
  returned: 'Paket wurde retourniert',
  exception: 'Ausnahme — manueller Eingriff nötig',
};

export default function ShippingEmailsPage() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [edits, setEdits] = useState<EditState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        shippingApi.listAutomations(),
        emApi.listTemplates(),
      ]);
      setAutomations(a);
      setTemplates(t);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function getFor(status: OrderShipmentStatus) {
    const existing = automations.find((a) => a.triggerStatus === status);
    const edit = edits[status];
    return {
      templateId: edit?.templateId ?? existing?.templateId ?? '',
      enabled: edit?.enabled ?? existing?.enabled ?? false,
      sendDelayMinutes: edit?.sendDelayMinutes ?? existing?.sendDelayMinutes ?? 0,
      subject: edit?.subject ?? existing?.subject ?? '',
      isNew: !existing,
    };
  }

  function setField(status: OrderShipmentStatus, patch: Partial<EditState[string]>) {
    const current = getFor(status);
    setEdits((prev) => ({
      ...prev,
      [status]: { templateId: current.templateId, enabled: current.enabled, sendDelayMinutes: current.sendDelayMinutes, subject: current.subject, ...patch },
    }));
  }

  async function save(status: OrderShipmentStatus) {
    const data = getFor(status);
    setSaving(status);
    try {
      await shippingApi.upsertAutomation({
        triggerStatus: status,
        templateId: data.templateId || null,
        enabled: data.enabled,
        sendDelayMinutes: data.sendDelayMinutes,
        subject: data.subject || null,
      });
      setEdits((prev) => { const next = { ...prev }; delete next[status]; return next; });
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(null); }
  }

  const statuses = Object.keys(SHIPMENT_STATUS_LABELS) as OrderShipmentStatus[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Automatische Emails"
        subtitle="Pro Sendungsstatus automatisch eine Email an den Kunden senden. Templates stammen aus dem Email-Marketing-Modul."
      />

      {templates.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
          Noch keine Templates vorhanden — lege welche im{' '}
          <Link href="/email-marketing/templates" className="underline font-medium inline-flex items-center gap-1">
            Email-Marketing-Modul <ExternalLink className="h-3 w-3" />
          </Link>{' '}an.
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : (
        <div className="space-y-3">
          {statuses.map((status) => {
            const data = getFor(status);
            const st = SHIPMENT_STATUS_LABELS[status];
            const dirty = !!edits[status];
            return (
              <SectionCard key={status} title="" className="p-0">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Badge color={st.color}>{st.label}</Badge>
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={data.enabled} onChange={(e) => setField(status, { enabled: e.target.checked })} />
                        <span className={data.enabled ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500'}>
                          {data.enabled ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                      </label>
                    </div>
                    {dirty && (
                      <button onClick={() => save(status)} disabled={saving === status} className={btn('primary', 'h-8 px-3 py-1 text-xs')}>
                        <Save className="h-3.5 w-3.5" /> {saving === status ? '…' : 'Speichern'}
                      </button>
                    )}
                  </div>
                  {TRIGGER_HINTS[status] && <p className="text-xs text-gray-500 mb-3">{TRIGGER_HINTS[status]}</p>}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={lblCls()}>Template</label>
                      <select value={data.templateId} onChange={(e) => setField(status, { templateId: e.target.value })} className={inputCls()} disabled={!data.enabled}>
                        <option value="">— kein Template —</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lblCls()}>Verzögerung (Min.)</label>
                      <input type="number" min="0" value={data.sendDelayMinutes} onChange={(e) => setField(status, { sendDelayMinutes: Number(e.target.value) })} className={inputCls()} disabled={!data.enabled} />
                    </div>
                    <div className="col-span-3">
                      <label className={lblCls()}>Betreff-Override (optional)</label>
                      <input value={data.subject} onChange={(e) => setField(status, { subject: e.target.value })} className={inputCls()} disabled={!data.enabled} placeholder="Leer → Betreff aus Template" />
                    </div>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
