-- Add firstContact column to creators table
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "first_contact" VARCHAR(50);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "creator_id" UUID NOT NULL,
  "sender_role" VARCHAR(20) NOT NULL,
  "sender_name" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "read_by_admin" BOOLEAN NOT NULL DEFAULT false,
  "read_by_creator" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- Add foreign key to creators
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_creator_id_fkey"
  FOREIGN KEY ("creator_id")
  REFERENCES "creators"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "chat_messages_creator_id_idx" ON "chat_messages"("creator_id");
CREATE INDEX IF NOT EXISTS "chat_messages_org_id_creator_id_idx" ON "chat_messages"("org_id", "creator_id");
