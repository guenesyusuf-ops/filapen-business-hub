'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, Type, Heading1, Image as ImageIcon, MousePointer, Minus, Square, Package, Eye } from 'lucide-react';
import { btn, input as inputCls, label as labelCls } from '@/components/purchases/PurchaseUI';

export type BlockType = 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'product';

export interface Block {
  _id?: string;
  type: BlockType;
  content?: string;
  level?: 1 | 2 | 3;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  src?: string;
  alt?: string;
  width?: number;
  link?: string;
  label?: string;
  href?: string;
  buttonColor?: string;
  textColor?: string;
  height?: number;
  title?: string;
  price?: string;
  imageUrl?: string;
  productHref?: string;
  padding?: number;
}

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

const BLOCK_OPTIONS: Array<{ type: BlockType; label: string; icon: any }> = [
  { type: 'heading', label: 'Überschrift', icon: Heading1 },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Bild', icon: ImageIcon },
  { type: 'button', label: 'Button', icon: MousePointer },
  { type: 'product', label: 'Produkt', icon: Package },
  { type: 'divider', label: 'Trennlinie', icon: Minus },
  { type: 'spacer', label: 'Abstand', icon: Square },
];

export function BlockEditor({ blocks, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const blocksWithIds = blocks.map((b, i) => ({ ...b, _id: b._id || `b_${i}` }));

  const addBlock = (type: BlockType) => {
    const defaults: Block = { type };
    if (type === 'text') defaults.content = 'Dein Text hier.';
    if (type === 'heading') { defaults.content = 'Überschrift'; defaults.level = 2; }
    if (type === 'button') { defaults.label = 'Jetzt ansehen'; defaults.href = 'https://'; defaults.align = 'center'; }
    if (type === 'spacer') defaults.height = 24;
    if (type === 'image') { defaults.src = ''; defaults.width = 600; defaults.align = 'center'; }
    if (type === 'product') { defaults.title = 'Produktname'; defaults.price = '€'; defaults.productHref = '#'; }
    defaults._id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([...blocksWithIds, defaults]);
    setShowAdd(false);
  };

  const update = (idx: number, patch: Partial<Block>) => {
    const next = blocksWithIds.map((b, i) => i === idx ? { ...b, ...patch } : b);
    onChange(next);
  };

  const remove = (idx: number) => onChange(blocksWithIds.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...blocksWithIds];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocksWithIds.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-white/10 p-8 text-center text-sm text-gray-400">
          Noch keine Blöcke. Klicke unten auf „Block hinzufügen".
        </div>
      )}

      {blocksWithIds.map((block, idx) => (
        <div key={block._id} className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-white/8 bg-gray-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 tracking-wide">
                {BLOCK_OPTIONS.find((o) => o.type === block.type)?.label || block.type}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(idx, 1)} disabled={idx === blocksWithIds.length - 1} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(idx)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="p-3">
            <BlockForm block={block} onChange={(p) => update(idx, p)} />
          </div>
        </div>
      ))}

      <div className="relative">
        <button onClick={() => setShowAdd(!showAdd)} className={btn('secondary', 'w-full justify-center')}>
          <Plus className="h-4 w-4" /> Block hinzufügen
        </button>
        {showAdd && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1117] shadow-xl p-2 grid grid-cols-2 gap-1">
            {BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button key={type} onClick={() => addBlock(type)} className="flex items-center gap-2 p-2 rounded text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                <Icon className="h-4 w-4 text-gray-400" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockForm({ block, onChange }: { block: Block; onChange: (p: Partial<Block>) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-4"><label className={labelCls()}>Text</label><input className={inputCls()} value={block.content || ''} onChange={(e) => onChange({ content: e.target.value })} /></div>
          <div><label className={labelCls()}>Level</label>
            <select value={String(block.level || 2)} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })} className={inputCls()}>
              <option value="1">H1</option><option value="2">H2</option><option value="3">H3</option>
            </select>
          </div>
          <div><label className={labelCls()}>Ausrichtung</label>
            <select value={block.align || 'left'} onChange={(e) => onChange({ align: e.target.value as any })} className={inputCls()}>
              <option value="left">Links</option><option value="center">Mitte</option><option value="right">Rechts</option>
            </select>
          </div>
        </div>
      );
    case 'text':
      return (
        <div>
          <label className={labelCls()}>Inhalt (HTML erlaubt)</label>
          <textarea rows={4} className={inputCls()} value={block.content || ''} onChange={(e) => onChange({ content: e.target.value })} placeholder="Hallo {{first_name}}, …" />
          <p className="text-xs text-gray-400 mt-1">Variablen: {'{{first_name}}'}, {'{{email}}'}, {'{{shop_name}}'}, {'{{unsubscribe_url}}'}</p>
        </div>
      );
    case 'image':
      return (
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-3"><label className={labelCls()}>Bild-URL</label><input className={inputCls()} value={block.src || ''} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://..." /></div>
          <div><label className={labelCls()}>Breite</label><input type="number" className={inputCls()} value={block.width || 600} onChange={(e) => onChange({ width: Number(e.target.value) })} /></div>
          <div className="col-span-2"><label className={labelCls()}>Alt-Text</label><input className={inputCls()} value={block.alt || ''} onChange={(e) => onChange({ alt: e.target.value })} /></div>
          <div className="col-span-2"><label className={labelCls()}>Link (optional)</label><input className={inputCls()} value={block.link || ''} onChange={(e) => onChange({ link: e.target.value })} placeholder="https://..." /></div>
        </div>
      );
    case 'button':
      return (
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2"><label className={labelCls()}>Beschriftung</label><input className={inputCls()} value={block.label || ''} onChange={(e) => onChange({ label: e.target.value })} /></div>
          <div className="col-span-2"><label className={labelCls()}>Link</label><input className={inputCls()} value={block.href || ''} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://{{shop.domain}}" /></div>
          <div><label className={labelCls()}>Farbe</label><input type="color" className={inputCls('h-9 p-1')} value={block.buttonColor || '#2563eb'} onChange={(e) => onChange({ buttonColor: e.target.value })} /></div>
          <div><label className={labelCls()}>Schrift</label><input type="color" className={inputCls('h-9 p-1')} value={block.textColor || '#ffffff'} onChange={(e) => onChange({ textColor: e.target.value })} /></div>
          <div className="col-span-2"><label className={labelCls()}>Ausrichtung</label>
            <select value={block.align || 'center'} onChange={(e) => onChange({ align: e.target.value as any })} className={inputCls()}>
              <option value="left">Links</option><option value="center">Mitte</option><option value="right">Rechts</option>
            </select>
          </div>
        </div>
      );
    case 'spacer':
      return (
        <div className="grid grid-cols-4 gap-2">
          <div><label className={labelCls()}>Höhe (px)</label><input type="number" className={inputCls()} value={block.height || 24} onChange={(e) => onChange({ height: Number(e.target.value) })} /></div>
        </div>
      );
    case 'divider':
      return (
        <div className="grid grid-cols-4 gap-2">
          <div><label className={labelCls()}>Farbe</label><input type="color" className={inputCls('h-9 p-1')} value={block.color || '#e5e7eb'} onChange={(e) => onChange({ color: e.target.value })} /></div>
        </div>
      );
    case 'product':
      return (
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-2"><label className={labelCls()}>Produktname</label><input className={inputCls()} value={block.title || ''} onChange={(e) => onChange({ title: e.target.value })} /></div>
          <div><label className={labelCls()}>Preis</label><input className={inputCls()} value={block.price || ''} onChange={(e) => onChange({ price: e.target.value })} placeholder="19,99 €" /></div>
          <div><label className={labelCls()}>Link</label><input className={inputCls()} value={block.productHref || ''} onChange={(e) => onChange({ productHref: e.target.value })} placeholder="https://..." /></div>
          <div className="col-span-4"><label className={labelCls()}>Bild-URL</label><input className={inputCls()} value={block.imageUrl || ''} onChange={(e) => onChange({ imageUrl: e.target.value })} placeholder="https://..." /></div>
        </div>
      );
    default:
      return null;
  }
}

/** Very simple HTML preview — mirrors the backend rendering for local preview only. */
export function renderBlocksPreview(blocks: Block[]): string {
  return blocks.map((b) => {
    const align = b.align || 'left';
    const pad = b.padding ?? 16;
    switch (b.type) {
      case 'heading': {
        const level = b.level || 2;
        const size = level === 1 ? 28 : level === 3 ? 18 : 22;
        return `<div style="padding:${pad}px;text-align:${align};"><h${level} style="margin:0;font-size:${size}px;color:${b.color || '#111'};">${escape(b.content || '')}</h${level}></div>`;
      }
      case 'text':
        return `<div style="padding:${pad}px;text-align:${align};font-size:${b.fontSize || 15}px;color:${b.color || '#1f2937'};line-height:1.6;">${b.content || ''}</div>`;
      case 'image':
        if (!b.src) return `<div style="padding:${pad}px;color:#9ca3af;font-size:12px;text-align:center;">[Bild]</div>`;
        return `<div style="padding:${pad}px;text-align:${align};"><img src="${escape(b.src)}" alt="${escape(b.alt || '')}" width="${b.width || 600}" style="max-width:100%;display:inline-block;" /></div>`;
      case 'button':
        return `<div style="padding:${pad}px;text-align:${align};"><a href="${escape(b.href || '#')}" style="display:inline-block;background:${b.buttonColor || '#2563eb'};color:${b.textColor || '#fff'};padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">${escape(b.label || 'Click')}</a></div>`;
      case 'divider':
        return `<div style="padding:${pad}px;"><hr style="border:0;border-top:1px solid ${b.color || '#e5e7eb'};" /></div>`;
      case 'spacer':
        return `<div style="height:${b.height || 24}px;"></div>`;
      case 'product':
        return `<div style="padding:${pad}px;display:flex;gap:16px;align-items:flex-start;">${b.imageUrl ? `<img src="${escape(b.imageUrl)}" alt="" width="120" style="border-radius:8px;" />` : ''}<div><div style="font-weight:600;font-size:15px;">${escape(b.title || '')}</div><div style="color:#6b7280;margin-top:4px;">${escape(b.price || '')}</div></div></div>`;
      default:
        return '';
    }
  }).join('');
}

function escape(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
