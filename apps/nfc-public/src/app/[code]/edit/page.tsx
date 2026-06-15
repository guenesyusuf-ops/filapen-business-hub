'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, AlertCircle, Save, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { nfcPublicApi } from '@/lib/api';

type Step = 'pin' | 'form' | 'done-edit' | 'done-delete';

export default function EditPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form-Daten
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [phone2,    setPhone2]    = useState('');
  const [notes,     setNotes]     = useState('');
  const [street,    setStreet]    = useState('');
  const [zip,       setZip]       = useState('');
  const [city,      setCity]      = useState('');
  const [email,     setEmail]     = useState('');
  const [newPin,    setNewPin]    = useState('');

  async function authenticate() {
    if (!pin) { setError('Bitte PIN eingeben'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await nfcPublicApi.authenticate(params.code, pin);
      const d = res.data;
      setFirstName(d.firstName ?? '');
      setLastName(d.lastName ?? '');
      setPhone(d.phone ?? '');
      setPhone2(d.phone2 ?? '');
      setNotes(d.notes ?? '');
      setStreet(d.street ?? '');
      setZip(d.zip ?? '');
      setCity(d.city ?? '');
      setEmail(d.email ?? '');
      setStep('form');
    } catch (e: any) {
      setError(e?.message ?? 'PIN falsch');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (newPin && !/^[0-9]{4,6}$/.test(newPin)) {
      setError('Neue PIN muss 4–6 Ziffern haben');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await nfcPublicApi.updateData(params.code, pin, {
        firstName, lastName, phone, phone2, notes, street, zip, city, email,
        pin: newPin || undefined,
        consent: true,
      });
      setStep('done-edit');
    } catch (e: any) {
      setError(e?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAll() {
    if (!confirm('Alle Daten endgültig löschen? Das Band wird deaktiviert.')) return;
    setLoading(true);
    setError(null);
    try {
      await nfcPublicApi.deleteData(params.code, pin);
      setStep('done-delete');
    } catch (e: any) {
      setError(e?.message ?? 'Löschen fehlgeschlagen');
      setLoading(false);
    }
  }

  // -----------------------
  if (step === 'done-edit' || step === 'done-delete') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className={`inline-flex h-16 w-16 rounded-full ${step === 'done-edit' ? 'bg-emerald-100' : 'bg-red-100'} items-center justify-center mb-4`}>
            {step === 'done-edit' ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : <Trash2 className="h-8 w-8 text-red-600" />}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {step === 'done-edit' ? 'Gespeichert' : 'Daten gelöscht'}
          </h1>
          <p className="text-sm text-slate-600 mb-5">
            {step === 'done-edit' ? 'Deine Änderungen sind aktiv.' : 'Alle Daten wurden gelöscht. Das Band kann jederzeit neu aktiviert werden.'}
          </p>
          <button onClick={() => router.push(step === 'done-edit' ? `/${params.code}/help` : '/')} className="text-brand-600 underline text-sm">
            {step === 'done-edit' ? 'Zur Profil-Seite' : 'Zur Startseite'}
          </button>
        </div>
      </div>
    );
  }

  // -----------------------
  if (step === 'pin') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <button onClick={() => router.push(`/${params.code}/help`)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 mb-4">
            <ArrowLeft className="h-3 w-3" /> Zurück
          </button>
          <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-50 items-center justify-center mb-4">
            <KeyRound className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">PIN eingeben</h1>
          <p className="text-sm text-slate-600 mb-5">
            Gib die PIN ein, die du bei der Aktivierung festgelegt hast.
          </p>
          <input
            type="tel"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
            inputMode="numeric"
            autoFocus
            className="w-full text-center text-3xl font-mono tracking-[0.5em] rounded-xl border-2 border-slate-300 px-3 py-4 focus:outline-none focus:border-brand-500"
          />
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <button
            onClick={authenticate}
            disabled={loading || !pin}
            className="w-full mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 px-5 py-3.5 text-base font-semibold text-white"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            {loading ? 'Prüft …' : 'Einloggen'}
          </button>
          <div className="mt-4 text-center">
            <a href={`/${params.code}/forgot-pin`} className="text-xs text-slate-500 hover:text-brand-600 underline">
              PIN vergessen?
            </a>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------
  // Form
  return (
    <div className="min-h-[100dvh] py-6 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Daten ändern</h1>
        <p className="text-sm text-slate-600 mb-5">Code: <span className="font-mono font-bold">{params.code}</span></p>

        <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
          <Grid>
            <Field label="Vorname"><Input value={firstName} onChange={setFirstName} /></Field>
            <Field label="Nachname"><Input value={lastName} onChange={setLastName} /></Field>
          </Grid>
          <Grid>
            <Field label="Telefon"><Input type="tel" value={phone} onChange={setPhone} /></Field>
            <Field label="Zweite Rufnummer"><Input type="tel" value={phone2} onChange={setPhone2} /></Field>
          </Grid>
          <Field label="Notiz">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
          </Field>
          <Field label="Straße"><Input value={street} onChange={setStreet} /></Field>
          <Grid>
            <Field label="PLZ"><Input value={zip} onChange={setZip} /></Field>
            <Field label="Ort"><Input value={city} onChange={setCity} /></Field>
          </Grid>
          <Field label="E-Mail"><Input type="email" value={email} onChange={setEmail} /></Field>
          <Field label="Neue PIN (optional)" hint="Leer lassen, um aktuelle PIN beizubehalten">
            <Input type="tel" value={newPin} onChange={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="z.B. 4321" />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <button
            onClick={save}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 px-5 py-3.5 text-base font-semibold text-white shadow"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {loading ? 'Speichert …' : 'Speichern'}
          </button>

          <div className="pt-3 border-t border-slate-200">
            <button
              onClick={deleteAll}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 px-5 py-3 text-sm font-medium"
            >
              <Trash2 className="h-4 w-4" /> Alle Daten endgültig löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-700 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </label>
  );
}
function Input({ value, onChange, type = 'text', placeholder, inputMode }: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
}) {
  return (
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} inputMode={inputMode}
      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40"
    />
  );
}
