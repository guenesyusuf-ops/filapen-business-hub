-- Screen-Share Module: Sessions + Participants
-- Sessions koennen privat (mit ausgewaehlten Usern), broadcast (alle eingeloggten),
-- oder public (mit token-basiertem Gast-Link) sein.

CREATE TABLE IF NOT EXISTS screen_share_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  host_user_id          UUID NOT NULL,
  livekit_room_id       VARCHAR(120) NOT NULL,
  session_name          VARCHAR(255),
  audio_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  voice_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  is_public             BOOLEAN NOT NULL DEFAULT FALSE,
  public_token          VARCHAR(40),
  public_password_hash  VARCHAR(120),
  public_expires_at     TIMESTAMPTZ,
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS screen_share_sessions_token_idx ON screen_share_sessions (public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS screen_share_sessions_org_status_idx ON screen_share_sessions (org_id, status);
CREATE INDEX IF NOT EXISTS screen_share_sessions_host_idx ON screen_share_sessions (host_user_id);

CREATE TABLE IF NOT EXISTS screen_share_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES screen_share_sessions(id) ON DELETE CASCADE,
  user_id      UUID,
  guest_name   VARCHAR(120),
  role         VARCHAR(20) NOT NULL DEFAULT 'viewer',
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at    TIMESTAMPTZ,
  left_at      TIMESTAMPTZ,
  status       VARCHAR(20) NOT NULL DEFAULT 'invited'
);
CREATE INDEX IF NOT EXISTS screen_share_participants_session_idx ON screen_share_participants (session_id);
CREATE INDEX IF NOT EXISTS screen_share_participants_user_idx ON screen_share_participants (user_id) WHERE user_id IS NOT NULL;
