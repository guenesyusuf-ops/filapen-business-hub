/**
 * Menu permissions — must stay in sync with dashboard nav (apps/web/src/app/(dashboard)/layout.tsx).
 * Admins/Owners bypass these entirely. For Mitarbeiter, the user only sees menus where
 * the permission key is in their `menuPermissions` array.
 */
export const MENU_PERMISSIONS = [
  { key: 'finance', label: 'Finanzen', description: 'Finance Hub (Umsatz, Produkte, Kampagnen ...)' },
  { key: 'channels', label: 'Channels', description: 'Shopify und andere Sales Channels' },
  { key: 'creators', label: 'Creator Hub', description: 'Creator, Projekte, Uploads, Briefings' },
  { key: 'influencers', label: 'Influencer Hub', description: 'Influencer Discovery, Brands, Watchlists' },
  { key: 'content', label: 'Content Hub', description: 'Content Bibliothek, Generator, Templates' },
  { key: 'work-management', label: 'Work Management', description: 'Projekte, Aufgaben, Board, Team-Chat' },
  { key: 'purchases', label: 'Einkauf', description: 'Lieferanten, Bestellungen, Rechnungen, Zahlungen, CSV/DATEV-Export' },
  { key: 'email-marketing', label: 'Email Marketing', description: 'Kontakte, Segmente, Kampagnen, Automations (Flows), Analytics' },
  { key: 'shipping', label: 'Versand', description: 'Bestellungen, Labels, Sendungen, Versandregeln, Carrier-Konten' },
] as const;

export type MenuPermissionKey = (typeof MENU_PERMISSIONS)[number]['key'];

/**
 * Map pathname to the permission key that gates it.
 * Pages not in this map are visible to everyone (login, settings, dashboard root).
 */
export function pathToPermission(pathname: string): MenuPermissionKey | null {
  if (pathname.startsWith('/finance')) return 'finance';
  if (pathname.startsWith('/channels')) return 'channels';
  if (pathname.startsWith('/creators')) return 'creators';
  if (pathname.startsWith('/influencers')) return 'influencers';
  if (pathname.startsWith('/content')) return 'content';
  if (pathname.startsWith('/work-management')) return 'work-management';
  if (pathname.startsWith('/purchases')) return 'purchases';
  if (pathname.startsWith('/email-marketing')) return 'email-marketing';
  if (pathname.startsWith('/shipping')) return 'shipping';
  return null;
}

/**
 * Returns true if a user with given role + menuPermissions can access a given permission key.
 * Admins and owners always return true.
 */
export function hasMenuAccess(
  role: string | undefined,
  menuPermissions: string[] | undefined,
  key: MenuPermissionKey | null,
): boolean {
  if (!key) return true; // unrestricted path
  if (role === 'admin' || role === 'owner') return true;
  return (menuPermissions ?? []).includes(key);
}
