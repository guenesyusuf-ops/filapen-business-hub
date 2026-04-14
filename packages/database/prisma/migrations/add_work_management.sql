-- =============================================================================
-- Work Management System - Migration
-- Creates all tables for Kanban-style project/task management
-- =============================================================================

-- Projects / Boards
CREATE TABLE wm_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  color       VARCHAR(20),
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wm_projects_org_id ON wm_projects (org_id);

-- Kanban Columns
CREATE TABLE wm_columns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES wm_projects(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20),
  position   INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_wm_columns_project_id ON wm_columns (project_id);

-- Tasks
CREATE TABLE wm_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  project_id        UUID NOT NULL REFERENCES wm_projects(id) ON DELETE CASCADE,
  column_id         UUID NOT NULL REFERENCES wm_columns(id) ON DELETE CASCADE,
  parent_task_id    UUID REFERENCES wm_tasks(id) ON DELETE CASCADE,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  assignee_id       UUID,
  created_by_id     UUID NOT NULL,
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date          DATE,
  position          INT NOT NULL DEFAULT 0,
  completed         BOOLEAN NOT NULL DEFAULT false,
  completed_at      TIMESTAMPTZ,
  estimated_minutes INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wm_tasks_project_id ON wm_tasks (project_id);
CREATE INDEX idx_wm_tasks_column_id ON wm_tasks (column_id);
CREATE INDEX idx_wm_tasks_assignee_id ON wm_tasks (assignee_id);

-- Comments
CREATE TABLE wm_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES wm_tasks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  user_name  VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wm_comments_task_id ON wm_comments (task_id);

-- Attachments
CREATE TABLE wm_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES wm_tasks(id) ON DELETE CASCADE,
  file_name   VARCHAR(255) NOT NULL,
  file_url    TEXT NOT NULL,
  storage_key TEXT,
  file_size   INT,
  file_type   VARCHAR(50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Labels
CREATE TABLE wm_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES wm_projects(id) ON DELETE CASCADE,
  name       VARCHAR(50) NOT NULL,
  color      VARCHAR(20) NOT NULL
);

-- Task-Label join table
CREATE TABLE wm_task_labels (
  task_id  UUID NOT NULL REFERENCES wm_tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES wm_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Project Members
CREATE TABLE wm_project_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES wm_projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  user_name  VARCHAR(255) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'member',
  UNIQUE (project_id, user_id)
);
