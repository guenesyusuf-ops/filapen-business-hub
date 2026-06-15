'use client';

import { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { nfcPublicApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ForgotPinPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) { setError('Bitte E-Mail eingeben'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await nfcPublicApi.requestPinReset(params.code, email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Fehler');
    } finally { setSubmitting(false); }
  }

  if (sent) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-100 items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Mail unterwegs</h1>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Falls die E-Mail bei diesem Band hinterlegt ist, haben wir dir einen Link geschickt.
            Der Link ist <strong>15 Minuten</strong> gültig.
          </p>
          <p className="text-xs text-slate-500">
            Schau in den Spam-Ordner falls keine Mail ankommt.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <button onClick={() => router.push(`/${params.code}/edit`)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 mb-4">
          <ArrowLeft className="h-3 w-3" /> Zurück
        </button>
        <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-50 items-center justify-center mb-4">
          <Mail className="h-7 w-7 text-brand-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">PIN vergessen</h1>
        <p className="text-sm text-slate-600 mb-5">
          Gib die E-Mail-Adresse ein, die du bei der Aktivierung angegeben hast.
          Wir senden dir einen Link zum Zurücksetzen.
        </p>
        <input
          type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@beispiel.de"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={submitting || !email}
          className="w-full mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 disabled:opacity-50 px-5 py-3.5 text-base font-semibold text-white"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
          {submitting ? 'Sendet …' : 'Reset-Link senden'}
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-4">
          Aus Sicherheitsgründen erhältst du auch dann eine Bestätigung, wenn die E-Mail nicht zugeordnet werden kann.
        </p>
      </div>
    </div>
  );
}
