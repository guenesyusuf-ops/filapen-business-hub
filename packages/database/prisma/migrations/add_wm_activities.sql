-- WmActivity: Aktivitaets-Feed fuer Tasks
CREATE TABLE IF NOT EXISTS wm_activities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES wm_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  user_id    UUID NOT NULL,
  user_name  VARCHAR(255) NOT NULL,
  action     VARCHAR(100) NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wm_activities_task_id ON wm_activities(task_id);
CREATE INDEX IF NOT EXISTS idx_wm_activities_project_id ON wm_activities(project_id);
