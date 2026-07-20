// Reine Utility-Funktionen ohne React — bewusst KEIN 'use client' Marker,
// damit sowohl Server- als auch Client-Components importieren koennen.

export function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' } as any)[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Extrahiert alle H2-Ueberschriften — fuer Sidebar-Navigation. */
export function extractSections(text: string): Array<{ id: string; title: string }> {
  const sections: Array<{ id: string; title: string }> = [];
  for (const line of text.split('\n')) {
    const m = /^##\s+(.+)$/.exec(line);
    if (m) sections.push({ id: slugify(m[1].trim()), title: m[1].trim() });
  }
  return sections;
}
