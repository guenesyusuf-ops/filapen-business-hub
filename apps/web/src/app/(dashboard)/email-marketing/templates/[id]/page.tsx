'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { emailApi, type EmailTemplate } from '@/lib/email-marketing';
import { PageHeader, btn, input as inputCls, label as labelCls, SectionCard } from '@/components/email-marketing/EmailMarketingUI';
import { BlockEditor, renderBlocksPreview, type Block } from '@/components/email-marketing/BlockEditor';

export default function TemplateEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    emailApi.getTemplate(id)
      .then((t) => {
        setName(t.name);
        setSubject(t.subject);
        setPreviewText(t.previewText || '');
        setDescription(t.description || '');
        setBlocks(Array.isArray(t.blocks) ? t.blocks : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await emailApi.updateTemplate(id, { name, subject, previewText: previewText || null, description: description || null, blocks });
      setDirty(false);
    } catch (e: any) {
      setError(e.message || 'Speichern fehlgeschlagen');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title={name || 'Template'}
        subtitle={subject}
        actions={
          <>
            <Link href="/email-marketing/templates" className={btn('ghost')}><ArrowLeft className="h-4 w-4" /> Liste</Link>
            <button onClick={() => setPreviewOpen(true)} className={btn('secondary')}><Eye className="h-4 w-4" /> Vorschau</button>
            <button onClick={save} disabled={busy} className={btn('primary')}><Save className="h-4 w-4" /> {busy ? 'Speichert …' : 'Speichern'}</button>
          </>
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <SectionCard title="Meta">
            <div className="space-y-3">
              <div><label className={labelCls()}>Name *</label><input className={inputCls()} value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></div>
              <div><label className={labelCls()}>Betreff *</label><input className={inputCls()} value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} /></div>
              <div><label className={labelCls()}>Preview-Text (zeigt im Inbox-Listing)</label><input className={inputCls()} value={previewText} onChange={(e) => { setPreviewText(e.target.value); setDirty(true); }} /></div>
              <div><label className={labelCls()}>Interne Beschreibung</label><textarea rows={2} className={inputCls()} value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} /></div>
            </div>
          </SectionCard>
          <SectionCard title="Verfügbare Variablen">
            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 font-mono">
              <li>{'{{first_name}}'} — Vorname des Kontakts</li>
              <li>{'{{last_name}}'} — Nachname</li>
              <li>{'{{email}}'} — Email-Adresse</li>
              <li>{'{{shop_name}}'} — Name des Shops</li>
              <li>{'{{unsubscribe_url}}'} — Abmelde-Link</li>
            </ul>
          </SectionCard>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Inhalt">
            <BlockEditor blocks={blocks} onChange={(b) => { setBlocks(b); setDirty(true); }} />
          </SectionCard>
        </div>
      </div>

      {previewOpen && (
        <PreviewModal blocks={blocks} subject={subject} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function PreviewModal({ blocks, subject, onClose }: { blocks: Block[]; subject: string; onClose: () => void }) {
  const html = renderBlocksPreview(blocks);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/10">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">Vorschau</div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{subject}</h3>
          </div>
          <button onClick={onClose} className={btn('ghost', 'h-8 px-2 py-1')}>Schließen</button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-black/40 p-6">
          <div className="max-w-[600px] mx-auto bg-white rounded-lg shadow" dangerouslySetInnerHTML={{ __html: html }} />
          <div className="mt-4 text-xs text-gray-400 text-center">Hinweis: Variablen wie {'{{first_name}}'} werden erst beim Versand ersetzt.</div>
        </div>
      </div>
    </div>
  );
}
