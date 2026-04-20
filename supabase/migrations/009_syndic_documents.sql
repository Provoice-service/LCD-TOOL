-- =============================================================================
-- LCD TOOL — Migration 009 : Syndic & Documents obligatoires Maroc
-- Colonnes: properties (6 colonnes syndic)
-- Tables  : property_documents, syndic_notifications
-- Storage : bucket 'property-documents'
-- =============================================================================


-- =============================================================================
-- COLONNES : properties (module syndic)
-- =============================================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS syndic_required           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS syndic_name               text,
  ADD COLUMN IF NOT EXISTS syndic_phone              text,
  ADD COLUMN IF NOT EXISTS syndic_requires_contract  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS syndic_whatsapp_message   text,
  ADD COLUMN IF NOT EXISTS syndic_send_timing        text NOT NULL DEFAULT 'on_checklist_complete'
    CHECK (syndic_send_timing IN ('on_checklist_complete', 'manual_only', '24h_before_checkin'));


-- =============================================================================
-- TABLE : property_documents
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid       NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  property_id   uuid        REFERENCES properties(id) ON DELETE SET NULL,
  guest_id      uuid        REFERENCES guests(id) ON DELETE SET NULL,
  document_type text        NOT NULL
    CHECK (document_type IN ('passport', 'cni', 'contract', 'other')),
  file_url      text,
  file_name     text,
  received_via  text
    CHECK (received_via IN ('whatsapp', 'airbnb_message', 'email', 'manual_upload')),
  received_at   timestamptz NOT NULL DEFAULT now(),
  verified      boolean     NOT NULL DEFAULT false,
  verified_at   timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_documents_reservation ON property_documents(reservation_id);
CREATE INDEX idx_property_documents_property    ON property_documents(property_id);

ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_property_documents" ON property_documents FOR ALL USING (true);


-- =============================================================================
-- TABLE : syndic_notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS syndic_notifications (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      uuid        NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  property_id         uuid        REFERENCES properties(id) ON DELETE SET NULL,
  syndic_phone        text        NOT NULL,
  syndic_name         text,
  documents_sent      text[]      NOT NULL DEFAULT '{}',
  message_sent        text,
  status              text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at             timestamptz,
  whatsapp_message_id text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_notifications_reservation ON syndic_notifications(reservation_id);

ALTER TABLE syndic_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_syndic_notifications" ON syndic_notifications FOR ALL USING (true);


-- =============================================================================
-- SUPABASE STORAGE : bucket 'property-documents'
-- =============================================================================

-- Créer le bucket via SQL (nécessite l'extension storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-documents',
  'property-documents',
  false,  -- privé : accès uniquement via signed URLs ou service role
  10485760,  -- 10 MB max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Politique storage : lecture pour utilisateurs authentifiés
CREATE POLICY "storage_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'property-documents');

-- Politique storage : upload pour utilisateurs authentifiés
CREATE POLICY "storage_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'property-documents');

-- Politique storage : suppression pour utilisateurs authentifiés
CREATE POLICY "storage_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'property-documents');

-- Politique storage : accès service_role pour le webhook (upload automatique)
CREATE POLICY "storage_service_role_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'property-documents');
