-- Meta Ads — Ideas & Iterations + Task Bridge (Phase 5), rein additiv.
-- Keine Änderung an bestehenden Tabellen/Spalten, kein DROP. Re-runnable.
-- KI-Felder (ai_model/ai_prompt/ai_meta) nur vorbereitet; kein automatischer LLM-Call.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_idea_source') THEN
    CREATE TYPE ma_idea_source AS ENUM ('manual','ai');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_idea_type') THEN
    CREATE TYPE ma_idea_type AS ENUM ('new','iteration');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ma_idea_status') THEN
    CREATE TYPE ma_idea_status AS ENUM ('draft','approved','in_production','shipped','archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ma_idea (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_group_id  UUID REFERENCES ma_product_group(id) ON DELETE SET NULL,
  title             VARCHAR(300) NOT NULL,
  body              TEXT,
  idea_type         ma_idea_type NOT NULL DEFAULT 'new',
  source            ma_idea_source NOT NULL DEFAULT 'manual',
  status            ma_idea_status NOT NULL DEFAULT 'draft',
  angle_id          UUID REFERENCES ma_angle(id) ON DELETE SET NULL,
  awareness         ma_awareness,
  offer_id          UUID REFERENCES ma_offer(id) ON DELETE SET NULL,
  based_on_ad_id    UUID REFERENCES ma_ad(id) ON DELETE SET NULL,
  recipe_id         UUID REFERENCES ma_creative_recipe(id) ON DELETE SET NULL,
  opportunity_type  VARCHAR(40),
  rationale         TEXT,
  ai_model          VARCHAR(60),
  ai_prompt         TEXT,
  ai_meta           JSONB,
  created_by_id     UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ma_idea_org ON ma_idea (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_idea_org_status ON ma_idea (org_id, status);
CREATE INDEX IF NOT EXISTS idx_ma_idea_org_group ON ma_idea (org_id, product_group_id);
CREATE INDEX IF NOT EXISTS idx_ma_idea_based_on_ad ON ma_idea (based_on_ad_id);
CREATE INDEX IF NOT EXISTS idx_ma_idea_recipe ON ma_idea (recipe_id);

CREATE TABLE IF NOT EXISTS ma_idea_component (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  idea_id      UUID NOT NULL REFERENCES ma_idea(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES ma_creative_component(id) ON DELETE CASCADE,
  role         VARCHAR(40),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_idea_component ON ma_idea_component (idea_id, component_id);
CREATE INDEX IF NOT EXISTS idx_ma_idea_component_org ON ma_idea_component (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_idea_component_idea ON ma_idea_component (idea_id);
CREATE INDEX IF NOT EXISTS idx_ma_idea_component_component ON ma_idea_component (component_id);

CREATE TABLE IF NOT EXISTS ma_task_link (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  idea_id       UUID REFERENCES ma_idea(id) ON DELETE CASCADE,
  recipe_id     UUID REFERENCES ma_creative_recipe(id) ON DELETE CASCADE,
  wm_task_id    UUID NOT NULL REFERENCES wm_tasks(id) ON DELETE CASCADE,
  title         VARCHAR(500),
  created_by_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ma_task_link_wm_task ON ma_task_link (wm_task_id);
CREATE INDEX IF NOT EXISTS idx_ma_task_link_org ON ma_task_link (org_id);
CREATE INDEX IF NOT EXISTS idx_ma_task_link_idea ON ma_task_link (idea_id);
CREATE INDEX IF NOT EXISTS idx_ma_task_link_recipe ON ma_task_link (recipe_id);
