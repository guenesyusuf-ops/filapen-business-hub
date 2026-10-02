-- Meta Ads — Produkt-/Analysegruppen (Phase: Redesign)
--
-- Trennt die Meta-Ads-Analyseebene vom Shop-Produktkatalog. Rein additiv +
-- Backfill + EIN nicht-destruktives DROP NOT NULL. Kein DROP TABLE, keine
-- Datenlöschung. Re-runnable (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Rollback: Spalte ma_ad.product_group_id droppen, Tabelle + Enum droppen,
-- ma_ad.product_id wieder NOT NULL setzen (sofern alle gefüllt).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_product_group_type') THEN
    CREATE TYPE ma_product_group_type AS ENUM ('linked', 'manual', 'bundle');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ma_product_group (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  type       ma_product_group_type NOT NULL DEFAULT 'manual',
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_product_group_org_name ON ma_product_group (org_id, name);
CREATE INDEX IF NOT EXISTS idx_ma_product_group_org ON ma_product_group (org_id);

ALTER TABLE ma_ad ADD COLUMN IF NOT EXISTS product_group_id UUID REFERENCES ma_product_group(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ma_ad_product_group ON ma_ad (product_group_id);

-- Backfill 1: pro bestehendem (org, product) eine linked-Gruppe (Name = Produkttitel).
INSERT INTO ma_product_group (org_id, name, type, product_id)
SELECT DISTINCT a.org_id, p.title, 'linked'::ma_product_group_type, a.product_id
FROM ma_ad a
JOIN products p ON p.id = a.product_id
WHERE a.product_group_id IS NULL AND a.product_id IS NOT NULL
ON CONFLICT (org_id, name) DO NOTHING;

UPDATE ma_ad a
SET product_group_id = g.id
FROM ma_product_group g
WHERE a.product_group_id IS NULL AND g.org_id = a.org_id AND g.product_id = a.product_id;

-- Backfill 2 (Safety): Titel-Kollisionen -> eindeutiger Name mit Produkt-ID-Präfix.
INSERT INTO ma_product_group (org_id, name, type, product_id)
SELECT DISTINCT a.org_id, COALESCE(p.title, 'Produkt') || ' · ' || left(a.product_id::text, 8), 'linked'::ma_product_group_type, a.product_id
FROM ma_ad a
LEFT JOIN products p ON p.id = a.product_id
WHERE a.product_group_id IS NULL AND a.product_id IS NOT NULL
ON CONFLICT (org_id, name) DO NOTHING;

UPDATE ma_ad a
SET product_group_id = g.id
FROM ma_product_group g
WHERE a.product_group_id IS NULL AND g.org_id = a.org_id AND g.product_id = a.product_id;

-- product_id ist künftig optional (manuelle/Bundle-Ads haben kein Shop-Produkt).
ALTER TABLE ma_ad ALTER COLUMN product_id DROP NOT NULL;
