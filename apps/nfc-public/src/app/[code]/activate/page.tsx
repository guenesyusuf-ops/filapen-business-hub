'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, CheckCircle2, AlertCircle, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { nfcPublicApi } from '@/lib/api';

export default function ActivatePage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [phone2,    setPhone2]    = useState('');
  const [notes,     setNotes]     = useState('');
  const [street,    setStreet]    = useState('');
  const [zip,       setZip]       = useState('');
  const [city,      setCity]      = useState('');
  const [email,     setEmail]     = useState('');
  const [pin,       setPin]       = useState('');
  const [pin2,      setPin2]      = useState('');
  const [consent,   setConsent]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError('Bitte Datenschutzerklärung bestätigen');
      return;
    }
    if (pin) {
      if (!/^[0-9]{4,6}$/.test(pin)) {
        setError('PIN muss 4–6 Ziffern haben');
        return;
      }
      if (pin !== pin2) {
        setError('PIN-Wiederholung stimmt nicht überein');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await nfcPublicApi.activate(params.code, {
        firstName, lastName, phone, phone2, notes, street, zip, city, email, pin,
        consent: true,
      });
      setDone(true);
      // Nach 2 Sekunden zur Help-Seite
      setTimeout(() => router.push(`/${params.code}/help`), 1800);
    } catch (err: any) {
      setError(err?.message ?? 'Fehler beim Speichern');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-100 items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Aktiviert!</h1>
          <p className="text-sm text-slate-600">Deine Daten sind gespeichert. Du wirst weitergeleitet …</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 items-center justify-center shadow-md mb-3">
            <Radio className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Band aktivieren</h1>
          <p className="text-sm text-slate-600 mt-1">
            Code: <span className="font-mono font-bold">{params.code}</span>
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Fülle aus, was du teilen möchtest. Alle Felder sind <strong>freiwillig</strong>.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-md p-5 space-y-5">
          <Section title="Kontakt-Person">
            <Grid>
              <Field label="Vorname">
                <Input value={firstName} onChange={setFirstName} placeholder="z.B. Anna" />
              </Field>
              <Field label="Nachname">
                <Input value={lastName} onChange={setLastName} placeholder="z.B. Müller" />
              </Field>
            </Grid>
          </Section>

          <Section title="Telefonnummern">
            <Grid>
              <Field label="Telefon">
                <Input type="tel" value={phone} onChange={setPhone} placeholder="+49 …" />
              </Field>
              <Field label="Zweite Rufnummer">
                <Input type="tel" value={phone2} onChange={setPhone2} placeholder="+49 …" />
              </Field>
            </Grid>
          </Section>

          <Field label="Notiz" hint='z.B. "spricht nur englisch", "ist Allergiker"'>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Wichtige Hinweise für den Finder …"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </Field>

          <Section title="Adresse (optional)">
            <Field label="Straße">
              <Input value={street} onChange={setStreet} placeholder="Musterstraße 12" />
            </Field>
            <Grid>
              <Field label="PLZ">
                <Input value={zip} onChange={setZip} placeholder="12345" />
              </Field>
              <Field label="Ort">
                <Input value={city} onChange={setCity} placeholder="Berlin" />
              </Field>
            </Grid>
          </Section>

          <Section title="PIN für späteres Ändern (optional)">
            <p className="text-xs text-slate-500 mb-3">
              Mit PIN kannst du später deine Daten ändern oder löschen. Ohne PIN ist das nicht möglich.
            </p>
            <Grid>
              <Field label="PIN (4–6 Ziffern)">
                <Input type="tel" value={pin} onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} placeholder="z.B. 1234" inputMode="numeric" />
              </Field>
              <Field label="PIN wiederholen">
                <Input type="tel" value={pin2} onChange={(v) => setPin2(v.replace(/\D/g, '').slice(0, 6))} placeholder="…" inputMode="numeric" />
              </Field>
            </Grid>
          </Section>

          <Field label="E-Mail (optional)" hint="Nur für spätere Benachrichtigungen — kein Pflichtfeld.">
            <Input type="email" value={email} onChange={setEmail} placeholder="email@beispiel.de" />
          </Field>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox" checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              Ich habe die <a href="/datenschutz" target="_blank" className="text-brand-600 underline">Datenschutzerklärung</a> gelesen und stimme der Speicherung der angegebenen Daten zum Zweck der Notfall-Kontaktaufnahme zu. *
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !consent}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            {submitting ? 'Wird gespeichert …' : 'Band aktivieren'}
          </button>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-brand-600" />
            <div>Daten werden verschlüsselt gespeichert und sind nur für Personen sichtbar, die das Band physisch in der Hand halten.</div>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">{title}</div>
      <div className="space-y-3">{children}</div>
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
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40"
    />
  );
}
