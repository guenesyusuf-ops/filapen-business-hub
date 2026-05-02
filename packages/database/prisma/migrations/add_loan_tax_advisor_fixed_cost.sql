-- Erweitert das Postgres-Enum fixed_cost_category um zwei neue Kategorien.
-- ALTER TYPE ... ADD VALUE muss ausserhalb einer Transaktion laufen, daher
-- als zwei einzelne Statements; IF NOT EXISTS verhindert Fehler bei
-- erneuter Ausfuehrung.

ALTER TYPE fixed_cost_category ADD VALUE IF NOT EXISTS 'loan';
ALTER TYPE fixed_cost_category ADD VALUE IF NOT EXISTS 'tax_advisor';
