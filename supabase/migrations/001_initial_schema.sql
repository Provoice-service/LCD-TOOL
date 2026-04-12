-- =============================================================================
-- LCD TOOL — Migration initiale
-- Tables : owners, properties, guests, reservations, messages,
--          message_templates, cleaning_tasks, providers, incidents,
--          invoices, expenses, prospects
-- =============================================================================


-- =============================================================================
-- FONCTION PARTAGÉE : mise à jour automatique de updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE : owners
-- =============================================================================

CREATE TABLE owners (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        text        NOT NULL,
  email            text        UNIQUE NOT NULL,
  phone            text,
  country          text,
  type             text        NOT NULL DEFAULT 'client',
  billing_day      int         NOT NULL DEFAULT 1,
  commission_rate  decimal     NOT NULL DEFAULT 20,
  contract_url     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : guests
-- =============================================================================

CREATE TABLE guests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text        NOT NULL,
  email       text,
  phone       text,
  language    text        NOT NULL DEFAULT 'fr',
  tag         text        NOT NULL DEFAULT 'normal',
  stay_count  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : properties
-- =============================================================================

CREATE TABLE properties (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  address             text,
  city                text,
  country             text,
  access_type         text        NOT NULL DEFAULT 'key_box',
  tuya_device_id      text,
  superhote_id        text,
  wifi_name           text,
  wifi_pass           text,
  house_rules         text,
  emergency_contacts  text,
  commission_rate     decimal,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_owner_id ON properties(owner_id);

CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : providers
-- (avant reservations et incidents qui l'utilisent comme FK nullable)
-- =============================================================================

CREATE TABLE providers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid        REFERENCES properties(id) ON DELETE SET NULL,
  name         text        NOT NULL,
  phone        text,
  category     text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_providers_property_id ON providers(property_id);


-- =============================================================================
-- TABLE : reservations
-- =============================================================================

CREATE TABLE reservations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         uuid        NOT NULL REFERENCES properties(id),
  guest_id            uuid        NOT NULL REFERENCES guests(id),
  platform            text        NOT NULL DEFAULT 'airbnb',
  check_in            timestamptz,
  check_out           timestamptz,
  total_amount        decimal     NOT NULL DEFAULT 0,
  status              text        NOT NULL DEFAULT 'confirmed',
  contract_signed     boolean     NOT NULL DEFAULT false,
  id_received         boolean     NOT NULL DEFAULT false,
  deposit_ok          boolean     NOT NULL DEFAULT false,
  access_code_sent    boolean     NOT NULL DEFAULT false,
  external_id         text        UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_property_id ON reservations(property_id);
CREATE INDEX idx_reservations_guest_id    ON reservations(guest_id);
CREATE INDEX idx_reservations_check_in    ON reservations(check_in);
CREATE INDEX idx_reservations_status      ON reservations(status);

CREATE TRIGGER set_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : messages
-- =============================================================================

CREATE TABLE messages (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id         uuid        REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id               uuid        REFERENCES guests(id) ON DELETE SET NULL,
  property_id            uuid        REFERENCES properties(id) ON DELETE SET NULL,
  channel                text        NOT NULL DEFAULT 'airbnb',
  direction              text        NOT NULL DEFAULT 'inbound',
  body                   text,
  language               text        NOT NULL DEFAULT 'fr',
  intent                 text,
  priority               text        NOT NULL DEFAULT 'normal',
  ai_suggestion          text,
  ai_used                boolean     NOT NULL DEFAULT false,
  ai_modified            boolean     NOT NULL DEFAULT false,
  status                 text        NOT NULL DEFAULT 'pending',
  assigned_to            uuid,
  response_time_minutes  int,
  external_id            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_reservation_id ON messages(reservation_id);
CREATE INDEX idx_messages_guest_id       ON messages(guest_id);
CREATE INDEX idx_messages_property_id    ON messages(property_id);
CREATE INDEX idx_messages_assigned_to    ON messages(assigned_to);
CREATE INDEX idx_messages_status         ON messages(status);
CREATE INDEX idx_messages_created_at     ON messages(created_at DESC);

CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : message_templates
-- =============================================================================

CREATE TABLE message_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  trigger        text,
  language       text        NOT NULL DEFAULT 'fr',
  body_template  text        NOT NULL,
  property_id    uuid        REFERENCES properties(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_templates_property_id ON message_templates(property_id);


-- =============================================================================
-- TABLE : cleaning_tasks
-- =============================================================================

CREATE TABLE cleaning_tasks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id   uuid        NOT NULL REFERENCES reservations(id),
  property_id      uuid        NOT NULL REFERENCES properties(id),
  scheduled_at     timestamptz,
  cleaner_contact  text,
  status           text        NOT NULL DEFAULT 'pending',
  photo_urls       text[]      NOT NULL DEFAULT '{}',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaning_tasks_reservation_id ON cleaning_tasks(reservation_id);
CREATE INDEX idx_cleaning_tasks_property_id    ON cleaning_tasks(property_id);
CREATE INDEX idx_cleaning_tasks_scheduled_at   ON cleaning_tasks(scheduled_at);
CREATE INDEX idx_cleaning_tasks_status         ON cleaning_tasks(status);

CREATE TRIGGER set_cleaning_tasks_updated_at
  BEFORE UPDATE ON cleaning_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : incidents
-- =============================================================================

CREATE TABLE incidents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      uuid        REFERENCES reservations(id) ON DELETE SET NULL,
  property_id         uuid        NOT NULL REFERENCES properties(id),
  category            text,
  description         text,
  status              text        NOT NULL DEFAULT 'open',
  provider_id         uuid        REFERENCES providers(id) ON DELETE SET NULL,
  cost                decimal     NOT NULL DEFAULT 0,
  billable_to_owner   boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_reservation_id ON incidents(reservation_id);
CREATE INDEX idx_incidents_property_id    ON incidents(property_id);
CREATE INDEX idx_incidents_provider_id    ON incidents(provider_id);
CREATE INDEX idx_incidents_status         ON incidents(status);

CREATE TRIGGER set_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : invoices
-- =============================================================================

CREATE TABLE invoices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL REFERENCES owners(id),
  period_start      date,
  period_end        date,
  gross_revenue     decimal     NOT NULL DEFAULT 0,
  commission_amount decimal     NOT NULL DEFAULT 0,
  expenses_amount   decimal     NOT NULL DEFAULT 0,
  net_to_owner      decimal     NOT NULL DEFAULT 0,
  pdf_url           text,
  status            text        NOT NULL DEFAULT 'draft',
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_owner_id     ON invoices(owner_id);
CREATE INDEX idx_invoices_period_start ON invoices(period_start);
CREATE INDEX idx_invoices_status       ON invoices(status);

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- TABLE : expenses
-- =============================================================================

CREATE TABLE expenses (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id          uuid        REFERENCES incidents(id) ON DELETE SET NULL,
  property_id          uuid        NOT NULL REFERENCES properties(id),
  owner_id             uuid        NOT NULL REFERENCES owners(id),
  category             text,
  description          text,
  amount               decimal     NOT NULL DEFAULT 0,
  receipt_url          text,
  approved_by_owner    boolean     NOT NULL DEFAULT false,
  billable             boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_incident_id  ON expenses(incident_id);
CREATE INDEX idx_expenses_property_id  ON expenses(property_id);
CREATE INDEX idx_expenses_owner_id     ON expenses(owner_id);


-- =============================================================================
-- TABLE : prospects
-- =============================================================================

CREATE TABLE prospects (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    text,
  contact_name    text,
  email           text,
  phone           text,
  nb_properties   int         NOT NULL DEFAULT 0,
  platforms       text,
  stage           text        NOT NULL DEFAULT 'lead',
  mrr_potential   decimal     NOT NULL DEFAULT 0,
  pain_points     text,
  next_action_at  date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospects_stage          ON prospects(stage);
CREATE INDEX idx_prospects_next_action_at ON prospects(next_action_at);

CREATE TRIGGER set_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- ROW LEVEL SECURITY — activation + policies
-- Les utilisateurs authentifiés peuvent effectuer toutes les opérations.
-- À affiner par table selon vos besoins métier.
-- =============================================================================

ALTER TABLE owners           ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects        ENABLE ROW LEVEL SECURITY;

-- owners
CREATE POLICY "authenticated_all" ON owners
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- properties
CREATE POLICY "authenticated_all" ON properties
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- guests
CREATE POLICY "authenticated_all" ON guests
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- reservations
CREATE POLICY "authenticated_all" ON reservations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- messages
CREATE POLICY "authenticated_all" ON messages
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- message_templates
CREATE POLICY "authenticated_all" ON message_templates
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- cleaning_tasks
CREATE POLICY "authenticated_all" ON cleaning_tasks
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- providers
CREATE POLICY "authenticated_all" ON providers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- incidents
CREATE POLICY "authenticated_all" ON incidents
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- invoices
CREATE POLICY "authenticated_all" ON invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- expenses
CREATE POLICY "authenticated_all" ON expenses
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- prospects
CREATE POLICY "authenticated_all" ON prospects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- =============================================================================
-- COMMENT EXÉCUTER CE FICHIER DANS SUPABASE
-- =============================================================================
--
-- OPTION A — SQL Editor (interface web, le plus simple) :
--   1. Ouvrir https://supabase.com/dashboard/project/yrkrxdwuwqcwoikuholq
--   2. Aller dans "SQL Editor" (menu gauche)
--   3. Cliquer "New query"
--   4. Coller le contenu de ce fichier
--   5. Cliquer "Run" (▶)
--
-- OPTION B — Supabase CLI (recommandé pour un workflow Git) :
--   1. Installer la CLI : npm install -g supabase
--   2. Se connecter      : supabase login
--   3. Lier le projet    : supabase link --project-ref yrkrxdwuwqcwoikuholq
--   4. Appliquer         : supabase db push
--      (ou supabase migration up pour n'appliquer que les nouvelles migrations)
--
-- OPTION C — psql (connexion directe) :
--   1. Récupérer la connection string dans :
--      Dashboard → Project Settings → Database → Connection string
--   2. psql "postgresql://postgres:[PASSWORD]@db.yrkrxdwuwqcwoikuholq.supabase.co:5432/postgres" \
--        -f supabase/migrations/001_initial_schema.sql
--
-- VÉRIFICATION après exécution :
--   - Table Editor → vous devez voir les 12 tables
--   - Authentication → Policies → chaque table doit avoir 1 policy "authenticated_all"
-- =============================================================================
