'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, KeyRound, Link2, Copy, Check } from 'lucide-react';
import { PageHeader, Button, Card, CardBody, Input, StatusPill, Toggle, EmptyState } from '@/components/ds';
import { dropshippingApi, DsPartner } from '@/lib/dropshipping';

export default function DropshippingAccessPage() {
  const [partners, setPartners] = useState<DsPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/partner` : '/partner';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setPartners(await dropshippingApi.listPartners());
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setError('Name, E-Mail und Passwort (min. 8 Zeichen) erforderlich');
      return;
    }
    setCreating(true); setError(null); setInfo(null);
    try {
      const r = await dropshippingApi.createPartner({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      setInfo(
        r.emailSent
          ? `Partner „${form.name.trim()}" angelegt — Einladungs-E-Mail mit Zugangsdaten wurde an ${form.email.trim()} gesendet.`
          : `Partner „${form.name.trim()}" angelegt. ⚠️ E-Mail konnte nicht gesendet werden (kein E-Mail-Dienst konfiguriert) — bitte Zugangsdaten manuell weitergeben: ${form.email.trim()} / ${form.password}`,
      );
      setForm({ name: '', email: '', password: '' });
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Anlegen fehlgeschlagen');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (p: DsPartner) => {
    setPartners((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    try { await dropshippingApi.updatePartner(p.id, { active: !p.active }); }
    catch (e: any) {
      setPartners((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)));
      setError(e.message ?? 'Konnte nicht speichern');
    }
  };

  const resetPw = async (p: DsPartner) => {
    const pw = prompt(`Neues Passwort für ${p.name} (min. 8 Zeichen):`);
    if (!pw) return;
    try { await dropshippingApi.updatePartner(p.id, { password: pw }); setInfo(`Passwort für ${p.name} geändert.`); }
    catch (e: any) { setError(e.message ?? 'Fehlgeschlagen'); }
  };

  const remove = async (p: DsPartner) => {
    if (!confirm(`Partner ${p.name} wirklich löschen? Zugewiesene Bestellungen bleiben erhalten.`)) return;
    try { await dropshippingApi.deletePartner(p.id); await load(); }
    catch (e: any) { setError(e.message ?? 'Löschen fehlgeschlagen'); }
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(portalUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5">
      <PageHeader
        eyebrow="Dropshipping"
        title="Zugang"
        subtitle="Lege Zugänge für externe Dropship-Partner an. Jeder Partner sieht nur die ihm zugewiesenen Bestellungen — ohne Zugriff auf den Hub."
      />

      {/* Portal-Link */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
        <Link2 size={16} className="text-[var(--text-secondary)] shrink-0" />
        <span className="text-[13.5px] text-[var(--text-secondary)]">Portal-Link für den Partner:</span>
        <code className="text-[13.5px] font-mono text-[var(--text-primary)]">{portalUrl}</code>
        <Button variant="ghost" size="sm" leftIcon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyUrl}>
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>

      {info && <div className="rounded-xl border border-[rgb(var(--color-success))]/30 bg-[rgb(var(--color-success))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-success))]">{info}</div>}
      {error && <div className="rounded-xl border border-[rgb(var(--color-error))]/30 bg-[rgb(var(--color-error))]/10 px-4 py-3 text-[14px] text-[rgb(var(--color-error))]">{error}</div>}

      {/* Neuer Partner */}
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">Neuen Partner anlegen</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="E-Mail (Login)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Passwort (min. 8)" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <Button variant="primary" leftIcon={<UserPlus size={16} />} loading={creating} onClick={create}>Partner anlegen</Button>
          </div>
        </CardBody>
      </Card>

      {/* Liste */}
      {loading ? (
        <div className="px-4 py-10 text-center text-[14px] text-[var(--text-secondary)]">Lädt…</div>
      ) : partners.length === 0 ? (
        <EmptyState icon={<UserPlus size={28} />} title="Noch kein Partner" description="Lege oben den ersten Dropship-Partner an." />
      ) : (
        <div className="flex flex-col gap-3">
          {partners.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-[var(--text-primary)]">{p.name}</span>
                      {p.active ? <StatusPill tone="ok" dot={false}>aktiv</StatusPill> : <StatusPill tone="neutral" dot={false}>inaktiv</StatusPill>}
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)]">
                      {p.email} · {p._count?.orders ?? 0} Bestellungen · {p.lastLoginAt ? `zuletzt online ${new Date(p.lastLoginAt).toLocaleString('de-DE')}` : 'noch nie eingeloggt'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Toggle checked={p.active} onChange={() => toggleActive(p)} label="Zugang aktiv" />
                    <Button variant="ghost" size="sm" leftIcon={<KeyRound size={15} />} onClick={() => resetPw(p)}>Passwort</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(p)} aria-label="Löschen"><Trash2 size={15} /></Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
