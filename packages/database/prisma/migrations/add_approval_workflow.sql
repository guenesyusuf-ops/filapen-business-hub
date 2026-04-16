-- Custom project categories (admin-defined, replaces hardcoded list)
CREATE TABLE IF NOT EXISTS wm_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  name       varchar(100) NOT NULL,
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wm_category ON wm_categories (org_id, name);
CREATE INDEX IF NOT EXISTS idx_wm_categories_org ON wm_categories (org_id, position);

-- Seed default categories for the dev org
INSERT INTO wm_categories (org_id, name, position) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Marketing', 0),
  ('00000000-0000-0000-0000-000000000001', 'Produkt', 1),
  ('00000000-0000-0000-0000-000000000001', 'Intern', 2),
  ('00000000-0000-0000-0000-000000000001', 'Vertrieb', 3),
  ('00000000-0000-0000-0000-000000000001', 'Sonstige', 4),
  ('00000000-0000-0000-0000-000000000001', 'Abnahmen', 5)
ON CONFLICT (org_id, name) DO NOTHING;

-- Approval workflow: project type + task approval fields
ALTER TABLE wm_projects
  ADD COLUMN IF NOT EXISTS project_type varchar(20) NOT NULL DEFAULT 'kanban';

ALTER TABLE wm_tasks
  ADD COLUMN IF NOT EXISTS approval_status varchar(20),
  ADD COLUMN IF NOT EXISTS approval_version int NOT NULL DEFAULT 1;

-- Sequential approval steps per task
CREATE TABLE IF NOT EXISTS wm_approval_steps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES wm_tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  position   int NOT NULL DEFAULT 0,
  status     varchar(20) NOT NULL DEFAULT 'pending',
  comment    text,
  deadline   timestamptz,
  decided_at timestamptz,
  version    int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_steps_task ON wm_approval_steps (task_id, position);
CREATE INDEX IF NOT EXISTS idx_approval_steps_user ON wm_approval_steps (user_id, status);
