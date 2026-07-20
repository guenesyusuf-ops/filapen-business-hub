'use client';

import { useMemo } from 'react';

// Minimaler Markdown-Renderer fuer unseren kontrollierten Anleitungs-Content.
// Unterstuetzt: H1-H4, Absaetze, ungeordnete + geordnete Listen, **fett**,
// *kursiv*, `code`, > blockquote, --- (hr), Links [text](url).
// Kein XSS-Risiko: Wir escapen HTML bevor wir Inline-Markup rendern und
// erzeugen keine dangerouslySetInnerHTML mit User-HTML.

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'quote' | 'hr' | 'code';
  content: string | string[];
  lang?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline-Markup — reihenfolge wichtig: erst code (schuetzt vor **/*),
// dann Links, dann bold, dann italic.
function renderInline(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[0.85em] font-mono text-gray-800 dark:text-gray-200">$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}

function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Leere Zeile
    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: 'hr', content: '' });
      i++; continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length as 1 | 2 | 3 | 4;
      blocks.push({ kind: (`h${level}`) as Block['kind'], content: h[2].trim() });
      i++; continue;
    }

    // Fenced code
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++; // schliessendes ```
      blocks.push({ kind: 'code', content: buf.join('\n'), lang });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
      blocks.push({ kind: 'quote', content: buf.join(' ') });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        buf.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', content: buf });
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        buf.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', content: buf });
      continue;
    }

    // Paragraph (bis Leerzeile oder neuer Block-Start)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s|^---+$|^```|^[-*]\s|^\d+\.\s|^>\s/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    blocks.push({ kind: 'p', content: buf.join(' ') });
  }

  return blocks;
}

export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parse(text), [text]);

  return (
    <div className="max-w-none">
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case 'h1':
            return <h1 key={idx} className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white mt-8 mb-4 first:mt-0" dangerouslySetInnerHTML={{ __html: renderInline(b.content as string) }} />;
          case 'h2':
            return <h2 key={idx} id={slugify(b.content as string)} className="text-xl font-semibold text-gray-900 dark:text-white mt-10 mb-3 scroll-mt-20" dangerouslySetInnerHTML={{ __html: renderInline(b.content as string) }} />;
          case 'h3':
            return <h3 key={idx} className="text-base font-semibold text-gray-900 dark:text-white mt-6 mb-2" dangerouslySetInnerHTML={{ __html: renderInline(b.content as string) }} />;
          case 'h4':
            return <h4 key={idx} className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-4 mb-1.5" dangerouslySetInnerHTML={{ __html: renderInline(b.content as string) }} />;
          case 'p':
            return <p key={idx} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: renderInline(b.content as string) }} />;
          case 'ul':
            return (
              <ul key={idx} className="list-disc list-outside pl-5 my-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                {(b.content as string[]).map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="list-decimal list-outside pl-5 my-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                {(b.content as string[]).map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />)}
              </ol>
            );
          case 'quote':
            return (
              <blockquote key={idx} className="border-l-4 border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 my-4 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 rounded-r" dangerouslySetInnerHTML={{ __html: renderInline(b.content as string) }} />
            );
          case 'code':
            return (
              <pre key={idx} className="my-4 rounded-lg bg-gray-900 text-gray-100 text-xs p-4 overflow-x-auto">
                <code>{b.content as string}</code>
              </pre>
            );
          case 'hr':
            return <hr key={idx} className="my-6 border-gray-200 dark:border-white/10" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

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
