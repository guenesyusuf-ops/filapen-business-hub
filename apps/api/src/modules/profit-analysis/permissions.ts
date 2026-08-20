import { ForbiddenException } from '@nestjs/common';

/**
 * §67 Granulare Berechtigungen fuer die Gewinnanalyse.
 *
 * Backend-seitiges Enforcement: Owner + Admin haben Vollzugriff.
 * Fuer Member werden die Feineinstellungen ueber menuPermissions geprueft.
 *
 * Alle Keys sind opt-in — wenn die Rolle den Key hat, ist die Aktion erlaubt.
 * Diese Keys werden auch im Frontend zur Sidebar-Zugriffskontrolle genutzt.
 */

export const PA_PERMISSIONS = {
  VIEW: 'profit-analysis',
  EDIT_DAILY: 'profit-analysis.edit-daily',
  EDIT_PRODUCT_COSTS: 'profit-analysis.edit-product-costs',
  EDIT_WHOLESALE: 'profit-analysis.edit-wholesale',
  EDIT_OVERHEAD: 'profit-analysis.edit-overhead',
  EDIT_SETTINGS: 'profit-analysis.edit-settings',
  EDIT_TARGETS: 'profit-analysis.edit-targets',
  EXPORT: 'profit-analysis.export',
  IMPORT: 'profit-analysis.import',
  CLOSE_MONTH: 'profit-analysis.close-month',
  UNLOCK_MONTH: 'profit-analysis.unlock-month',   // effektiv nur Owner
  VIEW_AUDIT: 'profit-analysis.view-audit',
} as const;

export type PaPermission = (typeof PA_PERMISSIONS)[keyof typeof PA_PERMISSIONS];

/**
 * Prueft ob eine Rolle + menuPermissions eine bestimmte Aktion darf.
 * Owner/Admin duerfen alles.
 * Member braucht das entsprechende menuPermission.
 * Viewer darf nie schreiben.
 */
export function hasPaPermission(
  role: string,
  menuPermissions: string[] | undefined,
  key: PaPermission,
): boolean {
  if (role === 'owner') return true;
  if (role === 'admin' && key !== PA_PERMISSIONS.UNLOCK_MONTH) return true;
  if (role === 'viewer') return false;
  return (menuPermissions ?? []).includes(key);
}

export function assertPaPermission(
  role: string,
  menuPermissions: string[] | undefined,
  key: PaPermission,
): void {
  if (!hasPaPermission(role, menuPermissions, key)) {
    throw new ForbiddenException(`Aktion nicht erlaubt (${key})`);
  }
}
