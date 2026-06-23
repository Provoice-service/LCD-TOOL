-- Table dédiée aux documents d'identité collectés lors de l'onboarding
CREATE TABLE IF NOT EXISTS guest_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id   uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  property_id      uuid REFERENCES properties(id) ON DELETE SET NULL,
  guest_full_name  text,
  adult_index      int  NOT NULL DEFAULT 0,
  document_type    text,
  photo_url        text,
  extraction_status text DEFAULT 'pending',
  extracted_data   jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX ON guest_documents(reservation_id);
CREATE INDEX ON guest_documents(property_id);

ALTER TABLE guest_documents ENABLE ROW LEVEL SECURITY;

-- Le service role a tous les droits (contourne le RLS)
CREATE POLICY "service_role_all_guest_documents"
  ON guest_documents FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Les utilisateurs authentifiés peuvent lire
CREATE POLICY "auth_read_guest_documents"
  ON guest_documents FOR SELECT
  TO authenticated
  USING (true);
