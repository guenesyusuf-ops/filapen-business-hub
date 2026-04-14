CREATE TABLE IF NOT EXISTS "creator_notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "creator_id" UUID NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "creator_notifications_creator_read_idx" ON "creator_notifications" ("creator_id", "read");
