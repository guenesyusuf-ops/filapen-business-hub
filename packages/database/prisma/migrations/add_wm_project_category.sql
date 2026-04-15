-- Add category column to wm_projects for project categorization
ALTER TABLE wm_projects ADD COLUMN IF NOT EXISTS category VARCHAR(50);
