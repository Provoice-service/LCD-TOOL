-- =============================================================================
-- Migration 018 — Wizard Onboarding Voyageur
-- =============================================================================

-- ── reservations ─────────────────────────────────────────────────────────────
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS onboarding_step         int   DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS arrival_time            text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nb_adults               int   DEFAULT 1;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS identity_documents      jsonb DEFAULT '[]';

-- ── guests ───────────────────────────────────────────────────────────────────
ALTER TABLE guests ADD COLUMN IF NOT EXISTS address           text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS city              text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS country_residence text;

-- ── upsells category ─────────────────────────────────────────────────────────
ALTER TABLE upsells ADD COLUMN IF NOT EXISTS category text DEFAULT 'Confort';
