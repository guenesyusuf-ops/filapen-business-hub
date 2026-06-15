'use client';

import { useState, useEffect } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { nfcPublicApi } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPinPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setError('Reset-Link ungültig oder unvollständig');
  }, [token]);

  async function submit() {
    if (!pin || !/^[0-9]{4,6}$/.test(pin)) { setError('PIN muss 4–6 Ziffern haben'); return; }
    if (pin !== pin2) { setError('PIN-Wiederholung stimmt nicht überein'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await nfcPublicApi.resetPin(params.code, token, pin);
      setDone(true);
      setTimeout(() => router.push(`/${params.code}/edit`), 2000);
    } catch (e: any) {
      setError(e?.message ?? 'Reset fehlgeschlagen');
    } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-100 items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">PIN gesetzt</h1>
          <p className="text-sm text-slate-600">Du wirst weitergeleitet …</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-50 items-center justify-center mb-4">
          <KeyRound className="h-7 w-7 text-brand-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Neue PIN festlegen</h1>
        <p className="text-sm text-slate-600 mb-5">Wähle eine PIN mit 4–6 Ziffern für Code <span className="font-mono font-bold">{params.code}</span>.</p>

        <div className="space-y-3">
          <input
            type="tel" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Neue PIN"
            inputMode="numeric"
            autoFocus
            className="w-full text-center text-2xl font-mono tracking-[0.4em] rounded-xl border-2 border-slate-300 px-3 py-3 focus:outline-none focus:border-brand-500"
          />
          <input
            type="tel" value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Wiederholen"
            inputMode="numeric"
            className="w-full text-center text-2xl font-mono tracking-[0.4em] rounded-xl border-2 border-slate-300 px-3 py-3 focus:outline-none focus:border-brand-500"
          />
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !pin || !pin2 || !token}
          className="w-full mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 disabled:opacity-50 px-5 py-3.5 text-base font-semibold text-white"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
          {submitting ? 'Setzt …' : 'PIN setzen'}
        </button>
      </div>
    </div>
  );
}
