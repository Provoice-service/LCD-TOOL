-- =============================================================================
-- Migration 014 — Module SAV complet + Indemnisations & Cautions
-- =============================================================================

-- ── Colonnes supplémentaires sur incidents ────────────────────────────────────

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS title               text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS priority            text DEFAULT 'normale'
  CHECK (priority IN ('urgente', 'haute', 'normale', 'basse'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS sav_type            text
  CHECK (sav_type IN ('plomberie', 'electricite', 'serrure', 'menage', 'electromenager',
                      'climatisation', 'chauffage', 'internet', 'nuisance', 'degradation', 'autre'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_provider   text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS provider_phone      text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS taken_in_charge     boolean DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS taken_in_charge_at  timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at         timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_satisfactory boolean;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_comment  text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS estimated_cost      decimal DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS actual_cost         decimal DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS photos              text[] DEFAULT '{}';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS last_reminder_at    timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reminder_count      int DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reported_by         text DEFAULT 'voyageur'
  CHECK (reported_by IN ('voyageur', 'equipe', 'gestionnaire', 'proprietaire'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS guest_notified      boolean DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS owner_notified      boolean DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS progress            int DEFAULT 0
  CHECK (progress >= 0 AND progress <= 100);

-- Indemnisations & Cautions
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_type  text
  CHECK (indemnisation_type IN ('aircover', 'caution_airbnb', 'caution_booking', 'caution_directe', 'assurance', 'aucune'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_status text DEFAULT 'non_demandee'
  CHECK (indemnisation_status IN ('non_demandee', 'a_declarer', 'en_cours', 'acceptee', 'refusee', 'partiellement_acceptee'));
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_amount_claimed   decimal DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_amount_received  decimal DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_deadline         date;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_reference        text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS indemnisation_notes            text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS caution_amount                 decimal DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS caution_actioned               boolean DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS caution_actioned_at            timestamptz;

-- ── Table : incident_comments ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author      text        NOT NULL,
  content     text        NOT NULL,
  type        text        DEFAULT 'comment'
    CHECK (type IN ('comment', 'action', 'reminder', 'resolution', 'escalation')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident_id ON incident_comments(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_created_at  ON incident_comments(created_at);

-- ── Table : sav_reminders ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sav_reminders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   uuid        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  reminder_type text        CHECK (reminder_type IN ('provider', 'owner', 'team', 'guest')),
  scheduled_at  timestamptz NOT NULL,
  sent_at       timestamptz,
  message       text,
  status        text        DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sav_reminders_incident_id  ON sav_reminders(incident_id);
CREATE INDEX IF NOT EXISTS idx_sav_reminders_scheduled_at ON sav_reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sav_reminders_status       ON sav_reminders(status);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE incident_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sav_reminders     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage incident_comments" ON incident_comments;
CREATE POLICY "Authenticated users can manage incident_comments"
  ON incident_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage sav_reminders" ON sav_reminders;
CREATE POLICY "Authenticated users can manage sav_reminders"
  ON sav_reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
