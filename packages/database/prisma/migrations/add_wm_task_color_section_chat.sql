-- Feature 1: Task color coding
ALTER TABLE wm_tasks ADD COLUMN IF NOT EXISTS color VARCHAR(20);

-- Feature 2: Task sections within columns
ALTER TABLE wm_tasks ADD COLUMN IF NOT EXISTS section VARCHAR(100);

-- Feature 3: Project team chat
CREATE TABLE IF NOT EXISTS wm_project_chats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES wm_projects(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,
  user_name  VARCHAR(255) NOT NULL,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wm_project_chats_project_id ON wm_project_chats(project_id);
