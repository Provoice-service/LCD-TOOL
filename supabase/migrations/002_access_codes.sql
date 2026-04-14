-- =============================================================================
-- LCD TOOL — Migration 002 : codes d'accès
-- Ajoute : reservations.access_code, reservations.access_type_override
--          table access_logs
-- =============================================================================


-- ── Nouvelles colonnes sur reservations ──────────────────────────────────────

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS access_code           text,
  ADD COLUMN IF NOT EXISTS access_type_override  text;


-- ── Table : access_logs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS access_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id   uuid        NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  property_id      uuid        NOT NULL REFERENCES properties(id)   ON DELETE CASCADE,
  lock_type        text        NOT NULL,           -- tuya | smartlife | nuki | key_box
  code_generated   text,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_reservation_id ON access_logs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_property_id    ON access_logs(property_id);

-- RLS
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_all ON access_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
