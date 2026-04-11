-- Migration: Project & Invitations feature
-- Extends creator_projects with campaign metadata and adds project_invitations table

-- Extend creator_projects
ALTER TABLE "creator_projects"
  ADD COLUMN IF NOT EXISTS "campaign_type" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "action" TEXT,
  ADD COLUMN IF NOT EXISTS "start_date" DATE,
  ADD COLUMN IF NOT EXISTS "product_id" UUID REFERENCES "products"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "needed_creators" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "budget" NUMERIC(12, 2);

-- New project_invitations table
CREATE TABLE IF NOT EXISTS "project_invitations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" UUID NOT NULL REFERENCES "creator_projects"("id") ON DELETE CASCADE,
  "creator_id" UUID NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "invited_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "responded_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "message" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_invitations_project_creator_unique"
  ON "project_invitations" ("project_id", "creator_id");
CREATE INDEX IF NOT EXISTS "project_invitations_org_status_idx"
  ON "project_invitations" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "project_invitations_creator_status_idx"
  ON "project_invitations" ("creator_id", "status");
