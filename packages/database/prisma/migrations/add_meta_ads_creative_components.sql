-- Meta Ads — Creative Components & Recipes (Phase 4), rein additiv.
-- Keine Änderung an bestehenden Tabellen/Spalten, kein DROP. Re-runnable.
-- ma_ad.hook_text bleibt unverändert (Schnell-Label); Components sind additiv.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_component_type') THEN
    CREATE TYPE ma_component_type AS ENUM (
      'hook','body','cta','proof','testimonial','product_demo','offer_section',
      'problem_section','solution_section','transition','visual_opening','voiceover','b_roll'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_recipe_status') THEN
    CREATE TYPE ma_recipe_status AS ENUM ('draft','ready','in_production','archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ma_creative_component (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_group_id   UUID REFERENCES ma_product_group(id) ON DELETE SET NULL,
  type               ma_component_type NOT NULL,
  code               VARCHAR(20) NOT NULL,
  name               VARCHAR(300) NOT NULL,
  text               TEXT,
  source_ad_id       UUID REFERENCES ma_ad(id) ON DELETE SET NULL,
  start_time_seconds INTEGER,
  end_time_seconds   INTEGER,
  angle_id           UUID REFERENCES ma_angle(id) ON DELETE SET NULL,
  awareness          ma_awareness,
  notes              TEXT,
  transcript         TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  active             BOOLEAN NOT NULL DEFAULT true,
  created_by_id      UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_component_org_code ON ma_creative_component (org_id, code);
CREATE INDEX IF NOT EXISTS idx_ma_component_org ON ma_creative_component (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_component_org_type ON ma_creative_component (org_id, type);
CREATE INDEX IF NOT EXISTS idx_ma_component_org_group ON ma_creative_component (org_id, product_group_id);
CREATE INDEX IF NOT EXISTS idx_ma_component_source ON ma_creative_component (source_ad_id);

CREATE TABLE IF NOT EXISTS ma_ad_component (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_id        UUID NOT NULL REFERENCES ma_ad(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES ma_creative_component(id) ON DELETE CASCADE,
  role         VARCHAR(40),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_ad_component ON ma_ad_component (ad_id, component_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_component_org ON ma_ad_component (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_component_ad ON ma_ad_component (ad_id);
CREATE INDEX IF NOT EXISTS idx_ma_ad_component_component ON ma_ad_component (component_id);

CREATE TABLE IF NOT EXISTS ma_creative_recipe (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_group_id UUID REFERENCES ma_product_group(id) ON DELETE SET NULL,
  name             VARCHAR(300) NOT NULL,
  angle_id         UUID REFERENCES ma_angle(id) ON DELETE SET NULL,
  awareness        ma_awareness,
  offer_id         UUID REFERENCES ma_offer(id) ON DELETE SET NULL,
  notes            TEXT,
  status           ma_recipe_status NOT NULL DEFAULT 'draft',
  created_by_id    UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ma_recipe_org ON ma_creative_recipe (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_recipe_org_group ON ma_creative_recipe (org_id, product_group_id);

CREATE TABLE IF NOT EXISTS ma_recipe_component (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    UUID NOT NULL REFERENCES ma_creative_recipe(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES ma_creative_component(id) ON DELETE CASCADE,
  role         VARCHAR(40),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_recipe_component ON ma_recipe_component (recipe_id, component_id);
CREATE INDEX IF NOT EXISTS idx_ma_recipe_component_recipe ON ma_recipe_component (recipe_id);
CREATE INDEX IF NOT EXISTS idx_ma_recipe_component_component ON ma_recipe_component (component_id);
