import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getModule, MANUAL_MODULES } from '@/lib/manual/modules';
import { loadModuleContent } from '@/content/manual/_registry';
import { extractSections } from '@/components/manual/markdown-utils';
import { ModuleContent } from '@/components/manual/ModuleContent';

interface Props {
  params: { module: string };
}

export function generateStaticParams() {
  return MANUAL_MODULES.map((m) => ({ module: m.slug }));
}

export default async function ManualModulePage({ params }: Props) {
  const mod = getModule(params.module);
  if (!mod) notFound();

  const content = await loadModuleContent(params.module);
  const sections = content ? extractSections(content) : [];
  const Icon = mod.icon;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/settings/manual" className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Anleitungen
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">{mod.label}</span>
      </div>

      <div className="flex items-start gap-3">
        <div className={`inline-flex h-10 w-10 rounded-xl bg-gray-50 dark:bg-white/[0.05] items-center justify-center flex-shrink-0 ${mod.accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white">
            {mod.label}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{mod.description}</p>
        </div>
      </div>

      {content === null ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-10 text-center">
          <p className="text-sm text-gray-500">Für dieses Modul gibt es noch keine Anleitung.</p>
        </div>
      ) : (
        <ModuleContent content={content} sections={sections} />
      )}
    </div>
  );
}
