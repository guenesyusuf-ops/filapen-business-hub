-- Add menu permissions and temporary password support for team invitations

-- Users: menu permissions + force password change flag
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS menu_permissions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Team invites: menu permissions + temporary password hash
ALTER TABLE team_invites
  ADD COLUMN IF NOT EXISTS menu_permissions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS temp_password_hash text;
