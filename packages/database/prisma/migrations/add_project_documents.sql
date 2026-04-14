CREATE TABLE IF NOT EXISTS "project_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "project_id" UUID NOT NULL REFERENCES "creator_projects"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_url" TEXT NOT NULL,
  "storage_key" TEXT,
  "file_size" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "project_documents_project_idx" ON "project_documents" ("project_id");
