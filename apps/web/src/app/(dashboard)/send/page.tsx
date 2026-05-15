'use client';

import { useEffect, useState } from 'react';
import { Send, Inbox, ArrowUpToLine, Trash2, Download, CheckCircle2, Clock, Plus, EyeOff, Loader2, FileIcon, Folder, X } from 'lucide-react';
import { sendApi, fmtSize, type InboxTransfer, type OutboxTransfer } from '@/lib/filapen-send';
import { PageHeader, btn } from '@/components/sales/SalesUI';
import { SendModal } from './SendModal';
import { cn } from '@/lib/utils';

type Tab = 'inbox' | 'outbox';

export default function FilapenSendPage() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [inbox, setInbox] = useState<InboxTransfer[]>([]);
  const [outbox, setOutbox] = useState<OutboxTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendModal, setSendModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [i, o] = await Promise.all([sendApi.inbox(), sendApi.outbox()]);
      setInbox(i);
      setOutbox(o);
    } catch (e: any) { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const unreadInbox = inbox.filter((t) => !t.receivedAt).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Filapen Send"
        subtitle="Dateien & Ordner sicher an Team-Mitglieder senden"
        actions={
          <button onClick={() => setSendModal(true)} className={btn('primary')}>
            <Plus className="h-4 w-4" /> Neue Sendung
          </button>
        }
      />

      <div className="flex border-b border-gray-200 dark:border-white/8">
        <TabBtn active={tab === 'inbox'} onClick={() => setTab('inbox')} icon={<Inbox className="h-4 w-4" />} label="Empfangen" count={inbox.length} highlight={unreadInbox} />
        <TabBtn active={tab === 'outbox'} onClick={() => setTab('outbox')} icon={<ArrowUpToLine className="h-4 w-4" />} label="Gesendet" count={outbox.length} />
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Laedt …
        </div>
      ) : tab === 'inbox' ? (
        inbox.length === 0 ? <EmptyState text="Noch keine Sendungen empfangen" /> : (
          <div className="space-y-3">
            {inbox.map((t) => <InboxRow key={t.id} transfer={t} onUpdate={load} />)}
          </div>
        )
      ) : (
        outbox.length === 0 ? <EmptyState text="Noch nichts gesendet" /> : (
          <div className="space-y-3">
            {outbox.map((t) => <OutboxRow key={t.id} transfer={t} onUpdate={load} />)}
          </div>
        )
      )}

      {sendModal && (
        <SendModal onClose={() => setSendModal(false)} onSent={() => { setSendModal(false); load(); }} />
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label, count, highlight,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; highlight?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-200',
      )}
    >
      {icon} {label}
      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400">
        {count}
      </span>
      {highlight && highlight > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums bg-red-500 text-white">
          {highlight}
        </span>
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] py-16 text-center">
      <Send className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function InboxRow({ transfer, onUpdate }: { transfer: InboxTransfer; onUpdate: () => void }) {
  const senderName = transfer.sender?.name
    || [transfer.sender?.firstName, transfer.sender?.lastName].filter(Boolean).join(' ').trim()
    || transfer.sender?.email
    || 'Absender';
  const isUnread = !transfer.receivedAt;

  async function markRead() {
    try { await sendApi.markReceived(transfer.id); onUpdate(); } catch {}
  }
  async function hide() {
    if (!confirm('Sendung aus deiner Inbox entfernen?')) return;
    try { await sendApi.hide(transfer.id); onUpdate(); } catch {}
  }
  async function downloadAll() {
    if (!transfer.receivedAt) markRead();
    for (const item of transfer.items) {
      try { await sendApi.downloadItem(item.id, item.fileName); } catch (e: any) { alert(e.message); break; }
    }
  }

  return (
    <div className={cn(
      'rounded-2xl border bg-white dark:bg-white/[0.03] p-4 shadow-sm transition-colors',
      isUnread ? 'border-primary-300/60 dark:border-primary-500/30 ring-1 ring-primary-200/30 dark:ring-primary-500/20' : 'border-gray-200/80 dark:border-white/8',
    )}>
      <div className="flex items-start gap-3">
        {transfer.sender.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={transfer.sender.avatarUrl} alt="" className="h-10 w-10 rounded-full flex-shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
            {senderName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{senderName}</span>
            {isUnread && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" /> NEU
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(transfer.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs text-gray-500">· {transfer.items.length} {transfer.items.length === 1 ? 'Datei' : 'Dateien'} · {fmtSize(transfer.totalSize)}</span>
          </div>
          {transfer.message && (
            <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
              {transfer.message}
            </div>
          )}
          <FileList items={transfer.items} />
          <div className="flex items-center gap-2 mt-3">
            <button onClick={downloadAll} className={btn('primary', 'text-xs')}>
              <Download className="h-3.5 w-3.5" /> Alle laden
            </button>
            {isUnread && (
              <button onClick={markRead} className={btn('secondary', 'text-xs')}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Als gelesen
              </button>
            )}
            <button onClick={hide} className={btn('ghost', 'text-xs')}>
              <EyeOff className="h-3.5 w-3.5" /> Ausblenden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutboxRow({ transfer, onUpdate }: { transfer: OutboxTransfer; onUpdate: () => void }) {
  async function revoke() {
    if (!confirm('Sendung widerrufen? Dateien werden geloescht und sind fuer Empfaenger nicht mehr verfuegbar.')) return;
    try { await sendApi.revoke(transfer.id); onUpdate(); } catch (e: any) { alert(e.message); }
  }
  const allReceived = transfer.recipients.every((r) => r.receivedAt);
  return (
    <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 dark:text-gray-300">
            <span className="font-semibold">An:</span>
            {transfer.recipients.map((r) => {
              const name = r.user.name
                || [r.user.firstName, r.user.lastName].filter(Boolean).join(' ').trim()
                || r.user.email;
              return (
                <span key={r.recipientId} className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]',
                  r.receivedAt
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300',
                )}>
                  {r.receivedAt ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {name}
                </span>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 mt-1.5">
            {new Date(transfer.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} ·
            {' '}{transfer.items.length} {transfer.items.length === 1 ? 'Datei' : 'Dateien'} · {fmtSize(transfer.totalSize)}
            {allReceived && <span className="text-emerald-600 dark:text-emerald-400 ml-1">· Alle abgeholt</span>}
          </div>
          {transfer.message && (
            <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap break-words italic">
              "{transfer.message}"
            </div>
          )}
          <FileList items={transfer.items} />
        </div>
        <button onClick={revoke} className={btn('danger', 'text-xs')}>
          <Trash2 className="h-3.5 w-3.5" /> Widerrufen
        </button>
      </div>
    </div>
  );
}

function FileList({ items }: { items: InboxTransfer['items'] }) {
  if (items.length === 0) return null;
  // Gruppiert nach Top-Level-Folder wenn filePath gesetzt
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
          {it.filePath?.includes('/') ? (
            <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          ) : (
            <FileIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          )}
          <button
            onClick={() => sendApi.downloadItem(it.id, it.fileName).catch((e) => alert(e.message))}
            className="flex-1 min-w-0 text-left hover:underline"
          >
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
              {it.filePath || it.fileName}
            </div>
            <div className="text-[10px] text-gray-400">{fmtSize(it.fileSize)}</div>
          </button>
          <Download className="h-3 w-3 text-gray-300" />
        </div>
      ))}
    </div>
  );
}
