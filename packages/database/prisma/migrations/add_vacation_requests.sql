-- Urlaubs-Antraege: Mitarbeiter beantragen Urlaub, Owner genehmigt/lehnt ab.
-- Genehmigte werden im Kalender aller Nutzer markiert.
CREATE TABLE IF NOT EXISTS vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  reviewed_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_vr_status CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT chk_vr_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_vr_org ON vacation_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_vr_user ON vacation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vr_status ON vacation_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_vr_range ON vacation_requests(org_id, status, start_date, end_date);
