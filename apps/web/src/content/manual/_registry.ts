// Zentraler Content-Registry.
// Neue Modul-Anleitung: Datei in diesem Ordner anlegen (slug.ts) und hier
// mappen. Content wird lazy-geladen (per Server-Component Import).

export type ManualContentLoader = () => Promise<{ content: string }>;

export const MANUAL_CONTENT: Record<string, ManualContentLoader> = {
  'home': () => import('./home').then((m) => ({ content: m.content })),
  'finance-hub': () => import('./finance-hub').then((m) => ({ content: m.content })),
  'creator-hub': () => import('./creator-hub').then((m) => ({ content: m.content })),
  'influencer-hub': () => import('./influencer-hub').then((m) => ({ content: m.content })),
  'content-hub': () => import('./content-hub').then((m) => ({ content: m.content })),
  'work-management': () => import('./work-management').then((m) => ({ content: m.content })),
  'whiteboard': () => import('./whiteboard').then((m) => ({ content: m.content })),
  'purchases': () => import('./purchases').then((m) => ({ content: m.content })),
  'email-marketing': () => import('./email-marketing').then((m) => ({ content: m.content })),
  'shipping': () => import('./shipping').then((m) => ({ content: m.content })),
  'sales': () => import('./sales').then((m) => ({ content: m.content })),
  'nfc': () => import('./nfc').then((m) => ({ content: m.content })),
  'returns': () => import('./returns').then((m) => ({ content: m.content })),
  'invoices': () => import('./invoices').then((m) => ({ content: m.content })),
  'documents': () => import('./documents').then((m) => ({ content: m.content })),
  'settings': () => import('./settings').then((m) => ({ content: m.content })),
  'screen-share': () => import('./screen-share').then((m) => ({ content: m.content })),
  'filapen-send': () => import('./filapen-send').then((m) => ({ content: m.content })),
};

export async function loadModuleContent(slug: string): Promise<string | null> {
  const loader = MANUAL_CONTENT[slug];
  if (!loader) return null;
  try {
    const { content } = await loader();
    return content;
  } catch {
    return null;
  }
}
