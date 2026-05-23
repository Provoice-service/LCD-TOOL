-- =============================================================================
-- Migration 015 — Annuaire intervenants · Propriétaires · Dépenses · Facturation
-- =============================================================================

-- ── Enrichir providers ────────────────────────────────────────────────────────

ALTER TABLE providers ADD COLUMN IF NOT EXISTS first_name          text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_name           text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS email               text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS whatsapp            text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS address             text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS city                text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS country             text DEFAULT 'MA';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS specialties         text[];
ALTER TABLE providers ADD COLUMN IF NOT EXISTS intervention_zone   text[];
ALTER TABLE providers ADD COLUMN IF NOT EXISTS hourly_rate         decimal;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS fixed_rate          decimal;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS currency            text DEFAULT 'MAD';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS availability        text DEFAULT 'disponible'
  CHECK (availability IN ('disponible', 'indisponible', 'sur_rdv'));
ALTER TABLE providers ADD COLUMN IF NOT EXISTS response_time       text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS rating              decimal DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS intervention_count  int DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_preferred        boolean DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_active           boolean DEFAULT true;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS languages           text[] DEFAULT '{fr}';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS iban                text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS siret               text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_intervention_at timestamptz;

-- Lien many-to-many providers <-> properties
CREATE TABLE IF NOT EXISTS provider_properties (
  provider_id  uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, property_id)
);

-- ── Enrichir owners ───────────────────────────────────────────────────────────

ALTER TABLE owners ADD COLUMN IF NOT EXISTS first_name             text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS last_name              text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS address                text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS city                   text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS iban                   text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS payment_method         text DEFAULT 'virement'
  CHECK (payment_method IN ('virement', 'cash', 'cheque', 'autre'));
ALTER TABLE owners ADD COLUMN IF NOT EXISTS notes                  text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS is_active              boolean DEFAULT true;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS onboarding_date        date;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS contract_signed_at     date;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS preferred_language     text DEFAULT 'fr';
ALTER TABLE owners ADD COLUMN IF NOT EXISTS notification_email     boolean DEFAULT true;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS notification_whatsapp  boolean DEFAULT true;

-- ── Enrichir expenses ─────────────────────────────────────────────────────────

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title                text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date         date DEFAULT CURRENT_DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency             text DEFAULT 'MAD';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_urls         text[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS provider_id          uuid REFERENCES providers(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS incident_id_ref      uuid REFERENCES incidents(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_line_id      uuid;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_status       text DEFAULT 'non_facture'
  CHECK (invoice_status IN ('non_facture', 'en_attente', 'facture'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_approved       boolean DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS owner_approved_at    timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by              text DEFAULT 'gestionnaire'
  CHECK (paid_by IN ('gestionnaire', 'proprietaire', 'plateforme'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes                text;

-- ── Table : invoice_lines ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_lines (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid        REFERENCES invoices(id) ON DELETE CASCADE,
  owner_id    uuid        REFERENCES owners(id),
  property_id uuid        REFERENCES properties(id),
  expense_id  uuid        REFERENCES expenses(id) ON DELETE SET NULL,
  incident_id uuid        REFERENCES incidents(id) ON DELETE SET NULL,
  label       text        NOT NULL,
  description text,
  amount      decimal     NOT NULL DEFAULT 0,
  currency    text        DEFAULT 'EUR',
  quantity    int         DEFAULT 1,
  line_type   text        DEFAULT 'depense'
    CHECK (line_type IN ('commission', 'depense', 'penalite', 'remboursement', 'autre')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id  ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_owner_id    ON invoice_lines(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_expense_id  ON invoice_lines(expense_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE invoice_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can manage invoice_lines" ON invoice_lines;
CREATE POLICY "Auth can manage invoice_lines"
  ON invoice_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth can manage provider_properties" ON provider_properties;
CREATE POLICY "Auth can manage provider_properties"
  ON provider_properties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Storage bucket receipts ───────────────────────────────────────────────────
-- À exécuter séparément si le bucket n'existe pas déjà :
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
-- ON CONFLICT (id) DO NOTHING;
