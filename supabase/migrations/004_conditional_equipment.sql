-- =============================================================================
-- LCD TOOL — Migration 004 : équipements conditionnels
-- Ajoute colonnes canapé lit sur properties + table property_conditional_info
-- =============================================================================

-- ── Colonnes canapé lit sur properties ───────────────────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS sofa_bed_exists      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sofa_bed_instructions text,
  ADD COLUMN IF NOT EXISTS sofa_bed_min_guests   int     NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sofa_bed_capacity     int     NOT NULL DEFAULT 2;


-- ── Table : property_conditional_info ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS property_conditional_info (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  equipment_name   text        NOT NULL,
  instructions     text,
  condition_type   text        NOT NULL DEFAULT 'always', -- always | min_guests | on_request
  condition_value  int,                                   -- utilisé si condition_type = 'min_guests'
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conditional_info_property_id
  ON property_conditional_info(property_id);

-- RLS
ALTER TABLE property_conditional_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_all ON property_conditional_info
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
