'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, Plus, Trash2, Pencil, Copy } from 'lucide-react';
import { emailApi, fmtDateTime, type EmailTemplate } from '@/lib/email-marketing';
import { PageHeader, Empty, btn } from '@/components/email-marketing/EmailMarketingUI';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    emailApi.listTemplates().then(setTemplates).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    const name = prompt('Name des neuen Templates?');
    if (!name?.trim()) return;
    try {
      const tpl = await emailApi.createTemplate({
        name: name.trim(),
        subject: 'Neuer Betreff',
        blocks: [
          { type: 'heading', level: 1, content: 'Hallo {{first_name}}!', align: 'center' },
          { type: 'text', content: 'Willkommen bei uns. Wir freuen uns, dich hier zu haben.' },
          { type: 'button', label: 'Jetzt ansehen', href: 'https://', align: 'center' },
        ],
      });
      router.push(`/email-marketing/templates/${tpl.id}`);
    } catch (e: any) { alert(e.message); }
  };

  const onDelete = async (t: EmailTemplate) => {
    if (!confirm(`"${t.name}" löschen?`)) return;
    try {
      await emailApi.deleteTemplate(t.id);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const onDuplicate = async (t: EmailTemplate) => {
    try {
      const full = await emailApi.getTemplate(t.id);
      const copy = await emailApi.createTemplate({
        name: `${full.name} (Kopie)`,
        subject: full.subject,
        previewText: full.previewText,
        description: full.description,
        blocks: full.blocks,
        htmlOverride: full.htmlOverride,
      });
      router.push(`/email-marketing/templates/${copy.id}`);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Email-Vorlagen"
        subtitle="Wiederverwendbare Email-Designs"
        actions={<button onClick={create} className={btn('primary')}><Plus className="h-4 w-4" /> Neues Template</button>}
      />

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Lädt …</div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03]">
          <Empty
            icon={<LayoutTemplate className="h-10 w-10" />}
            title="Noch keine Vorlagen"
            hint="Lege dein erstes Email-Template an. Nutze Blocks wie Text, Bild, Button, Produkt. Variablen wie {{first_name}} werden beim Versand ersetzt."
            action={<button onClick={create} className={btn('primary')}><Plus className="h-4 w-4" /> Neues Template</button>}
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-gray-200/80 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4 hover:shadow-lg transition-shadow">
              <Link href={`/email-marketing/templates/${t.id}`} className="block">
                <div className="font-semibold text-gray-900 dark:text-white truncate">{t.name}</div>
                <div className="text-xs text-gray-400 mt-1 truncate">{t.subject}</div>
                {t.description && <div className="text-xs text-gray-500 mt-2 line-clamp-2">{t.description}</div>}
                <div className="text-xs text-gray-400 mt-3">Erstellt {fmtDateTime(t.createdAt)}</div>
              </Link>
              <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-white/8">
                <Link href={`/email-marketing/templates/${t.id}`} title="Bearbeiten" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><Pencil className="h-3.5 w-3.5" /></Link>
                <button onClick={() => onDuplicate(t)} title="Duplizieren" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><Copy className="h-3.5 w-3.5" /></button>
                <button onClick={() => onDelete(t)} title="Löschen" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
