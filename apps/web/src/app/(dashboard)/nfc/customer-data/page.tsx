'use client';

import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Users, Search, Loader2, X, ShieldCheck, AlertTriangle, Phone, Mail, MapPin, FileText, KeyRound, Trash2, ChevronRight } from 'lucide-react';
import { nfcApi, fmtDateTime, type NfcCustomerSummary, type NfcCustomerDetail } from '@/lib/nfc';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/Toast';

const PAGE_SIZE = 30;

export default function NfcCustomerDataPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [debounced]);

  const q = useQuery({
    queryKey: ['nfc-customers', { debounced, page }],
    queryFn: () => nfcApi.listCustomers({
      search: debounced || undefined,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    }),
    placeholderData: keepPreviousData,
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 items-center justify-center shadow-md">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
              Kundendaten
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {total} aktivierte Bänder · DSGVO-geschützt, jeder Zugriff wird protokolliert
            </p>
          </div>
        </div>
      </div>

      {/* DSGVO-Hinweis */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>DSGVO-Hinweis:</strong> Die hier sichtbaren Daten sind personenbezogen. Jeder Zugriff (Liste + Detail) wird im Audit-Log protokolliert (User, IP, Zeitpunkt). Löschungen sind irreversibel und werden ebenfalls vermerkt.
        </div>
      </div>

      {/* Suche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, Telefon, Email, Code, Stadt …"
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>

      {/* Tabelle */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] overflow-hidden">
        {q.isLoading && items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Lädt …
          </div>
        ) : q.isError ? (
          <div className="p-12 text-center text-sm text-red-600">Zugriff verweigert oder Fehler.</div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-500">Noch keine aktivierten Bänder.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8 text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3 text-left">Code</th>
                    <th className="px-3 py-3 text-left">Name</th>
                    <th className="px-3 py-3 text-left hidden sm:table-cell">Telefon (maskiert)</th>
                    <th className="px-3 py-3 text-left hidden md:table-cell">Ort</th>
                    <th className="px-3 py-3 text-right hidden md:table-cell">Scans</th>
                    <th className="px-3 py-3 text-left hidden lg:table-cell">Aktiviert</th>
                    <th className="px-3 py-3 text-center">PIN</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <CustomerRow key={c.id} c={c} onOpen={() => setDetailId(c.id)} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/8 text-xs text-gray-500 dark:text-gray-400">
              <div>Seite {page + 1} / {totalPages}</div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Zurück</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="rounded-md border border-gray-200 dark:border-white/10 px-2 py-1 disabled:opacity-40">Weiter</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {detailId && (
        <CustomerDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onDeleted={() => { setDetailId(null); q.refetch(); }}
        />
      )}
    </div>
  );
}

function CustomerRow({ c, onOpen }: { c: NfcCustomerSummary; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-cyan-50/40 dark:hover:bg-cyan-900/10 cursor-pointer group transition-colors">
      <td className="px-3 py-3 font-mono font-semibold text-cyan-700 dark:text-cyan-300">{c.bandCode}</td>
      <td className="px-3 py-3">
        <div className="font-medium text-gray-900 dark:text-white">
          {(c.firstName || c.lastName) ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : <span className="italic text-gray-400">Anonym</span>}
        </div>
        {c.email && <div className="text-[11px] text-gray-500 truncate max-w-[200px]">{c.email}</div>}
      </td>
      <td className="px-3 py-3 hidden sm:table-cell text-gray-700 dark:text-gray-300 font-mono text-xs">{c.phone ?? '—'}</td>
      <td className="px-3 py-3 hidden md:table-cell text-gray-600 dark:text-gray-300">{c.city ?? '—'}</td>
      <td className="px-3 py-3 hidden md:table-cell text-right tabular-nums">{c.scanCount}</td>
      <td className="px-3 py-3 hidden lg:table-cell text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(c.createdAt)}</td>
      <td className="px-3 py-3 text-center">
        {c.hasPin ? (
          <span title="PIN gesetzt — Kunde kann selbst editieren"><KeyRound className="h-3.5 w-3.5 text-emerald-500 inline-block" /></span>
        ) : (
          <span title="Keine PIN — Edit nur über Hub" className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-cyan-500" />
      </td>
    </tr>
  );
}

function CustomerDetailModal({ id, onClose, onDeleted }: { id: string; onClose: () => void; onDeleted: () => void }) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const detailQuery = useQuery({
    queryKey: ['nfc-customer', id],
    queryFn: () => nfcApi.getCustomer(id),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function deleteCustomer() {
    const ok = await confirm({
      title: 'Kundendaten endgültig löschen?',
      message: 'Alle Daten zu diesem Band werden gelöscht. Das Band bleibt physisch nutzbar (kann neu aktiviert werden). Diese Aktion ist nicht rückgängig zu machen.',
      variant: 'danger', confirmLabel: 'Endgültig löschen',
    });
    if (!ok) return;
    try {
      await nfcApi.deleteCustomer(id, 'Admin-Löschung über Business-Hub');
      toast.success('Daten gelöscht');
      onDeleted();
    } catch (e: any) {
      toast.error('Löschen fehlgeschlagen', e?.message ?? '');
    }
  }

  const c = detailQuery.data;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative z-[5] w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[92vh] bg-white dark:bg-[#0f1117] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-white/10 modal-panel flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kundendaten</h2>
              {c && <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">Code: {c.bandCode}</div>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {detailQuery.isLoading ? (
            <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
          ) : c ? (
            <div className="space-y-5">
              <Section icon={<Users className="h-3.5 w-3.5" />} title="Kontakt">
                <Grid>
                  <Info label="Vorname" value={c.firstName} />
                  <Info label="Nachname" value={c.lastName} />
                  <Info label="Telefon" value={c.phone} icon={<Phone className="h-3 w-3" />} link={c.phone ? `tel:${c.phone}` : undefined} />
                  <Info label="Zweite Rufnummer" value={c.phone2} icon={<Phone className="h-3 w-3" />} link={c.phone2 ? `tel:${c.phone2}` : undefined} />
                  <Info label="E-Mail" value={c.email} icon={<Mail className="h-3 w-3" />} link={c.email ? `mailto:${c.email}` : undefined} wide />
                </Grid>
              </Section>
              {(c.street || c.zip || c.city) && (
                <Section icon={<MapPin className="h-3.5 w-3.5" />} title="Adresse">
                  <Grid>
                    <Info label="Straße" value={c.street} wide />
                    <Info label="PLZ" value={c.zip} />
                    <Info label="Ort" value={c.city} />
                  </Grid>
                </Section>
              )}
              {c.notes && (
                <Section icon={<FileText className="h-3.5 w-3.5" />} title="Notiz">
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.notes}</div>
                </Section>
              )}
              <Section icon={<ShieldCheck className="h-3.5 w-3.5" />} title="DSGVO & Audit">
                <Grid>
                  <Info label="Consent gegeben" value={fmtDateTime(c.consentGivenAt)} />
                  <Info label="Consent-Version" value={c.consentVersion} mono />
                  <Info label="Aktivierungs-IP" value={c.activationIp} mono />
                  <Info label="Aktiviert am" value={fmtDateTime(c.createdAt)} />
                  <Info label="Letzte Änderung" value={fmtDateTime(c.updatedAt)} />
                  <Info label="Letzter Scan" value={fmtDateTime(c.lastScanAt)} />
                  <Info label="Anzahl Scans" value={String(c.scanCount)} />
                  <Info label="PIN gesetzt" value={c.hasPin ? 'Ja (Kunde kann selbst editieren)' : 'Nein (Edit nur über Hub)'} />
                </Grid>
              </Section>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02] mobile-safe-bottom">
          <button onClick={deleteCustomer} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-3 py-2 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" /> Endgültig löschen
          </button>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200/80 dark:border-white/8 bg-gray-50/40 dark:bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300 flex items-center justify-center">{icon}</div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">{children}</div>;
}

function Info({ label, value, icon, link, wide, mono }: { label: string; value: string | null | undefined; icon?: React.ReactNode; link?: string; wide?: boolean; mono?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">{icon} {label}</div>
      {value ? (
        link ? (
          <a href={link} className={`text-sm text-cyan-700 dark:text-cyan-300 hover:underline break-all ${mono ? 'font-mono' : ''}`}>{value}</a>
        ) : (
          <div className={`text-sm text-gray-800 dark:text-gray-200 break-words ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
        )
      ) : (
        <div className="text-sm text-gray-400 italic">—</div>
      )}
    </div>
  );
}
