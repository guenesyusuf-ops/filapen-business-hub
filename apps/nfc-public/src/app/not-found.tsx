import Link from 'next/link';
import { Radio, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-slate-100 items-center justify-center mb-3">
          <Search className="h-7 w-7 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Code nicht gefunden</h1>
        <p className="text-sm text-slate-600 mb-5">
          Dieser Code gehört zu keinem aktiven NFC-Band. Bitte prüfe die URL oder kontaktiere den Besitzer.
        </p>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
          <Radio className="h-4 w-4" /> Zur Startseite
        </Link>
      </div>
    </div>
  );
}
