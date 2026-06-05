-- =============================================================================
-- Migration 016 — Guest Page publique voyageur
-- =============================================================================

-- ── Enrichir reservations ────────────────────────────────────────────────────
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_page_token         text UNIQUE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_page_viewed_at     timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_page_language      text DEFAULT 'fr';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_page_sent          boolean DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_url             text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS access_code_display_from timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS id_document_url          text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS id_document_uploaded_at  timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS extras_requested         jsonb DEFAULT '[]';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS num_guests               int;

-- ── Enrichir properties ──────────────────────────────────────────────────────
ALTER TABLE properties ADD COLUMN IF NOT EXISTS google_maps_url        text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS airbnb_review_url      text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS booking_review_url     text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS google_review_url      text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS access_code_delay_hours int DEFAULT 24;

-- ── Table : guest_messages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_messages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid        REFERENCES reservations(id) ON DELETE CASCADE,
  direction      text        NOT NULL CHECK (direction IN ('guest', 'host')),
  body           text        NOT NULL,
  read_at        timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_messages_reservation_id ON guest_messages(reservation_id);
CREATE INDEX IF NOT EXISTS idx_guest_messages_created_at     ON guest_messages(created_at);

-- ── Table : upsells ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS upsells (
  id          uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid     REFERENCES properties(id) ON DELETE CASCADE,
  name        text     NOT NULL,
  description text,
  price       decimal  DEFAULT 0,
  currency    text     DEFAULT 'EUR',
  icon        text     DEFAULT '✨',
  is_active   boolean  DEFAULT true,
  sort_order  int      DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsells_property_id ON upsells(property_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsells        ENABLE ROW LEVEL SECURITY;

-- guest_messages : accessible publiquement (API routes utilisent service_role)
DROP POLICY IF EXISTS "Public read guest_messages"   ON guest_messages;
DROP POLICY IF EXISTS "Public insert guest_messages" ON guest_messages;
CREATE POLICY "Public read guest_messages"   ON guest_messages FOR SELECT USING (true);
CREATE POLICY "Public insert guest_messages" ON guest_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Auth can manage upsells" ON upsells;
CREATE POLICY "Auth can manage upsells" ON upsells FOR ALL TO authenticated USING (true) WITH CHECK (true);
