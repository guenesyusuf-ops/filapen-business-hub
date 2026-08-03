-- Password-Management-Modul
-- Alle Secret-Felder werden AES-256-GCM verschluesselt in JSONB gespeichert
-- (dieselbe Struktur wie carrier_accounts.credentials).
-- Berechtigung: individuell pro User via password_access.
-- Audit-Trail komplett in password_audit_log.

CREATE TABLE password_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        varchar(80) NOT NULL,
  color       varchar(20) NOT NULL DEFAULT '#6366f1',
  icon        varchar(40),
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);
CREATE INDEX idx_pw_cat_org ON password_categories(org_id);

CREATE TABLE password_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id           uuid REFERENCES password_categories(id) ON DELETE SET NULL,
  title                 varchar(200) NOT NULL,
  url                   text,
  username              varchar(320),
  password_encrypted    jsonb NOT NULL,
  notes_encrypted       jsonb,
  totp_seed_encrypted   jsonb,
  favicon_url           text,
  password_strength     int,
  password_updated_at   timestamptz NOT NULL DEFAULT NOW(),
  rotation_reminder_at  timestamptz,
  last_used_at          timestamptz,
  created_by_id         uuid NOT NULL REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pw_entry_org ON password_entries(org_id);
CREATE INDEX idx_pw_entry_cat ON password_entries(category_id);
CREATE INDEX idx_pw_entry_title ON password_entries(org_id, title);

CREATE TABLE password_access (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid NOT NULL REFERENCES password_entries(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission    varchar(20) NOT NULL DEFAULT 'view',
  granted_at    timestamptz NOT NULL DEFAULT NOW(),
  granted_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(entry_id, user_id)
);
CREATE INDEX idx_pw_access_entry ON password_access(entry_id);
CREATE INDEX idx_pw_access_user ON password_access(user_id);

CREATE TABLE password_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_id    uuid REFERENCES password_entries(id) ON DELETE SET NULL,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      varchar(40) NOT NULL,
  ip          varchar(45),
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pw_audit_org_time ON password_audit_log(org_id, created_at DESC);
CREATE INDEX idx_pw_audit_entry ON password_audit_log(entry_id);
CREATE INDEX idx_pw_audit_user ON password_audit_log(user_id);

CREATE TABLE password_attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id            uuid NOT NULL REFERENCES password_entries(id) ON DELETE CASCADE,
  name                varchar(255) NOT NULL,
  storage_key         text NOT NULL,
  size_bytes          bigint NOT NULL,
  content_type        varchar(120) NOT NULL,
  uploaded_by_id      uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pw_attach_entry ON password_attachments(entry_id);
