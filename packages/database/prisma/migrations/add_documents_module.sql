-- ============================================================================
-- Documents Module — Folders, Files, Permissions, Versions, Activity, Favorites
-- ============================================================================

-- Folders (recursive tree via parent_id)
CREATE TABLE IF NOT EXISTS doc_folders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  parent_id    uuid REFERENCES doc_folders(id) ON DELETE CASCADE,
  name         varchar(255) NOT NULL,
  color        varchar(20),
  description  text,
  created_by   uuid NOT NULL,
  locked       boolean NOT NULL DEFAULT false,
  locked_by    uuid,
  tags         text[] NOT NULL DEFAULT '{}',
  trashed_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_folders_org ON doc_folders (org_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_parent ON doc_folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_folders_trashed ON doc_folders (org_id, trashed_at);

-- Files
CREATE TABLE IF NOT EXISTS doc_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  folder_id    uuid REFERENCES doc_folders(id) ON DELETE CASCADE,
  file_name    varchar(500) NOT NULL,
  file_url     text NOT NULL,
  storage_key  text,
  file_size    bigint,
  file_type    varchar(50),
  mime_type    varchar(100),
  dimensions   jsonb,
  created_by   uuid NOT NULL,
  status       varchar(20) NOT NULL DEFAULT 'draft',
  tags         text[] NOT NULL DEFAULT '{}',
  metadata     jsonb,
  trashed_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_files_folder ON doc_files (folder_id);
CREATE INDEX IF NOT EXISTS idx_doc_files_org ON doc_files (org_id);
CREATE INDEX IF NOT EXISTS idx_doc_files_trashed ON doc_files (org_id, trashed_at);
CREATE INDEX IF NOT EXISTS idx_doc_files_status ON doc_files (org_id, status);
CREATE INDEX IF NOT EXISTS idx_doc_files_tags ON doc_files USING gin (tags);

-- File versions
CREATE TABLE IF NOT EXISTS doc_file_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id       uuid NOT NULL REFERENCES doc_files(id) ON DELETE CASCADE,
  version_num   int NOT NULL DEFAULT 1,
  file_name     varchar(500) NOT NULL,
  file_url      text NOT NULL,
  storage_key   text,
  file_size     bigint,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_file ON doc_file_versions (file_id, version_num);

-- Folder permissions (admin-only assignment)
CREATE TABLE IF NOT EXISTS doc_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid NOT NULL REFERENCES doc_folders(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  can_read    boolean NOT NULL DEFAULT true,
  can_upload  boolean NOT NULL DEFAULT false,
  can_edit    boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_permission ON doc_permissions (folder_id, user_id);
CREATE INDEX IF NOT EXISTS idx_doc_permissions_user ON doc_permissions (user_id);

-- Activity log
CREATE TABLE IF NOT EXISTS doc_activities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  folder_id  uuid,
  file_id    uuid,
  user_id    uuid NOT NULL,
  user_name  varchar(255) NOT NULL,
  action     varchar(50) NOT NULL,
  details    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_activities_org ON doc_activities (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_activities_folder ON doc_activities (folder_id, created_at DESC);

-- Favorites
CREATE TABLE IF NOT EXISTS doc_favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  folder_id  uuid,
  file_id    uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_fav_folder ON doc_favorites (user_id, folder_id) WHERE folder_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_fav_file ON doc_favorites (user_id, file_id) WHERE file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_favorites_user ON doc_favorites (user_id);
