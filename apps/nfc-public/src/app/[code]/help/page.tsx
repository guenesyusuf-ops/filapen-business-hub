import { Phone, MapPin, FileText, User, AlertCircle } from 'lucide-react';
import { nfcPublicApi } from '@/lib/api';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HelpPage({ params }: { params: { code: string } }) {
  let status;
  try { status = await nfcPublicApi.getStatus(params.code); }
  catch { notFound(); }
  if (status.status !== 'active' || !status.data) {
    // Falls zwischenzeitlich deaktiviert
    notFound();
  }

  const d = status.data;
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();

  return (
    <div className="min-h-[100dvh] py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Hero — Hauptmessage */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-3xl shadow-xl p-6 text-center mb-5">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-white/20 backdrop-blur items-center justify-center mb-3">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Bitte rufen Sie uns an</h1>
          <p className="text-sm text-white/90">Dieses Kind braucht Hilfe — die Eltern erreichen Sie hier.</p>
        </div>

        {/* Primary Action — Big Call Button */}
        {d.phone && (
          <a
            href={`tel:${d.phone}`}
            className="block w-full mb-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-center px-6 py-5 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-center gap-3">
              <Phone className="h-6 w-6" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider opacity-90">Hauptkontakt</div>
                <div className="font-bold text-lg">{d.phone}</div>
              </div>
            </div>
          </a>
        )}

        {/* Secondary phone */}
        {d.phone2 && (
          <a
            href={`tel:${d.phone2}`}
            className="block w-full mb-5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-emerald-300 text-center px-6 py-4 shadow-md active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-center gap-3 text-emerald-700">
              <Phone className="h-5 w-5" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider opacity-80">Zweite Rufnummer</div>
                <div className="font-bold text-base">{d.phone2}</div>
              </div>
            </div>
          </a>
        )}

        {/* Info-Cards */}
        <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
          {fullName && (
            <Block icon={<User className="h-4 w-4" />} label="Name">{fullName}</Block>
          )}
          {d.notes && (
            <Block icon={<AlertCircle className="h-4 w-4 text-amber-600" />} label="Wichtige Info" highlight>
              {d.notes}
            </Block>
          )}
          {(d.street || d.zip || d.city) && (
            <Block icon={<MapPin className="h-4 w-4" />} label="Adresse">
              <div>{d.street}</div>
              <div>{[d.zip, d.city].filter(Boolean).join(' ')}</div>
            </Block>
          )}
        </div>

        {/* Edit-Hinweis fuer Eltern */}
        {d.editEnabled && (
          <div className="mt-5 text-center">
            <Link
              href={`/${params.code}/edit`}
              className="inline-block text-xs text-slate-500 hover:text-brand-600 underline"
            >
              Du bist die Inhaber-Person? Daten ändern oder löschen
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ icon, label, children, highlight }: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'rounded-xl bg-amber-50 border border-amber-200 p-3' : ''}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">
        {icon} {label}
      </div>
      <div className={`text-base ${highlight ? 'text-amber-900 font-medium' : 'text-slate-900'} whitespace-pre-wrap`}>
        {children}
      </div>
    </div>
  );
}
