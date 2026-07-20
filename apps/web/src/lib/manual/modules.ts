import {
  Home, DollarSign, Users, Heart, Wand2, ListTodo, PencilRuler, ShoppingCart,
  Mail, Truck, ClipboardList, Radio, Inbox, FileText, FolderOpen, Settings,
  Monitor, Send,
} from 'lucide-react';

export type ModuleGroup = 'operativ' | 'analytics' | 'marketing' | 'admin';

export interface ManualModule {
  slug: string;
  label: string;
  description: string;
  icon: React.ElementType;
  group: ModuleGroup;
  accent: string;
}

export const MODULE_GROUPS: Record<ModuleGroup, string> = {
  operativ: 'Operativ (Alltag)',
  analytics: 'Analytics & Reporting',
  marketing: 'Marketing & Content',
  admin: 'Verwaltung & Tools',
};

export const MANUAL_MODULES: ManualModule[] = [
  { slug: 'home', label: 'Home', description: 'Startseite mit KPIs, Widgets und Schnellzugriff', icon: Home, group: 'operativ', accent: 'text-primary-600' },
  { slug: 'finance-hub', label: 'Finance Hub', description: 'Umsatz, Kosten, Attribution, Kohorten, Reports', icon: DollarSign, group: 'analytics', accent: 'text-emerald-600' },
  { slug: 'creator-hub', label: 'Creator Hub', description: 'Creator, Projekte, Briefings, Uploads', icon: Users, group: 'marketing', accent: 'text-purple-600' },
  { slug: 'influencer-hub', label: 'Influencer Hub', description: 'Discovery, Watchlists, Performance-Tracking', icon: Heart, group: 'marketing', accent: 'text-pink-600' },
  { slug: 'content-hub', label: 'Content Hub', description: 'Generierung, Library, Templates, Brand Voice', icon: Wand2, group: 'marketing', accent: 'text-indigo-600' },
  { slug: 'work-management', label: 'Aufgabenverwaltung', description: 'Projekte, Aufgaben, Workload', icon: ListTodo, group: 'operativ', accent: 'text-sky-600' },
  { slug: 'whiteboard', label: 'Whiteboard', description: 'Kollaboratives Board für Ideen', icon: PencilRuler, group: 'operativ', accent: 'text-orange-600' },
  { slug: 'purchases', label: 'Einkauf', description: 'Bestellungen, Lieferanten, Wareneingang, Export', icon: ShoppingCart, group: 'operativ', accent: 'text-amber-600' },
  { slug: 'email-marketing', label: 'Email Marketing', description: 'Kontakte, Segmente, Kampagnen, Flows, Templates', icon: Mail, group: 'marketing', accent: 'text-blue-600' },
  { slug: 'shipping', label: 'Versand', description: 'Bestellungen, Labels, DHL, Regeln, Emails', icon: Truck, group: 'operativ', accent: 'text-cyan-600' },
  { slug: 'sales', label: 'Verkauf', description: 'Bestellungen, Kunden, Import, Export', icon: ClipboardList, group: 'operativ', accent: 'text-teal-600' },
  { slug: 'nfc', label: 'NFC4you', description: 'NFC-Bänder, Generierung, Kundendaten (DSGVO)', icon: Radio, group: 'operativ', accent: 'text-cyan-500' },
  { slug: 'returns', label: 'Retouren', description: 'Retouren-Bearbeitung TikTok/Shopify', icon: Inbox, group: 'operativ', accent: 'text-rose-600' },
  { slug: 'invoices', label: 'Rechnungen', description: 'Eingangs- und Ausgangsrechnungen, OCR, Statistik', icon: FileText, group: 'operativ', accent: 'text-yellow-600' },
  { slug: 'documents', label: 'Dokumente', description: 'Datei-Ablage, Ordner, Sharing', icon: FolderOpen, group: 'admin', accent: 'text-slate-600' },
  { slug: 'settings', label: 'Einstellungen', description: 'Allgemein, Profil, Team, Genehmigungen, Integrationen', icon: Settings, group: 'admin', accent: 'text-gray-600' },
  { slug: 'screen-share', label: 'Bildschirm teilen', description: 'Live-Screenshare zwischen Team-Mitgliedern', icon: Monitor, group: 'admin', accent: 'text-violet-600' },
  { slug: 'filapen-send', label: 'Filapen Send', description: 'Datei-Sharing im Team (LocalSend-Style)', icon: Send, group: 'admin', accent: 'text-fuchsia-600' },
];

export function getModule(slug: string): ManualModule | undefined {
  return MANUAL_MODULES.find((m) => m.slug === slug);
}
