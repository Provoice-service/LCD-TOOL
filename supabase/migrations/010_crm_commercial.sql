-- =============================================================================
-- LCD TOOL — Migration 010 : CRM Commercial (3 pipelines)
-- Tables  : crm_leads, crm_activities, crm_markets, crm_source_stats
-- =============================================================================


-- =============================================================================
-- TABLE : crm_leads
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_leads (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_type            text        NOT NULL
    CHECK (pipeline_type IN ('service_client','immobilier','expansion')),
  full_name                text,
  company_name             text,
  email                    text,
  phone                    text,
  city                     text,
  country                  text        NOT NULL DEFAULT 'MA',
  stage                    text        NOT NULL DEFAULT 'lead',
  priority                 text        NOT NULL DEFAULT 'normale'
    CHECK (priority IN ('haute','normale','basse')),
  nb_properties            int,
  current_tools            text,
  monthly_revenue_potential decimal(12,2),
  property_budget          decimal(12,2),
  property_type_interest   text,
  expansion_city           text,
  source                   text        NOT NULL DEFAULT 'other'
    CHECK (source IN (
      'meta_ads','google_ads','website_form','organic_social','linkedin',
      'referral','cold_outreach','event','phone_inbound','whatsapp_inbound',
      'email_inbound','partner','other'
    )),
  source_detail            text,
  referral_name            text,
  utm_campaign             text,
  utm_source               text,
  utm_medium               text,
  utm_content              text,
  lead_cost                decimal(10,2),
  notes                    text,
  next_action              text,
  next_action_date         date,
  lost_reason              text,
  assigned_to              uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_leads_pipeline  ON crm_leads(pipeline_type);
CREATE INDEX idx_crm_leads_stage     ON crm_leads(stage);
CREATE INDEX idx_crm_leads_source    ON crm_leads(source);
CREATE INDEX idx_crm_leads_next_date ON crm_leads(next_action_date);

CREATE TRIGGER crm_leads_updated_at
  BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_crm_leads" ON crm_leads FOR ALL USING (true);


-- =============================================================================
-- TABLE : crm_activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_activities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid        REFERENCES crm_leads(id) ON DELETE CASCADE,
  guest_id      uuid        REFERENCES guests(id) ON DELETE SET NULL,
  reservation_id uuid       REFERENCES reservations(id) ON DELETE SET NULL,
  activity_type text
    CHECK (activity_type IN (
      'call','email','whatsapp','sms','demo','meeting',
      'site_visit','offer_sent','contract_sent','note','stage_change','inbound'
    )),
  title         text,
  content       text,
  channel       text,
  description   text,
  outcome       text,
  next_step     text,
  metadata      jsonb,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_activities_lead  ON crm_activities(lead_id);
CREATE INDEX idx_crm_activities_guest ON crm_activities(guest_id);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_crm_activities" ON crm_activities FOR ALL USING (true);


-- =============================================================================
-- TABLE : crm_markets
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_markets (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  city                 text        NOT NULL,
  country              text        NOT NULL DEFAULT 'MA',
  status               text        NOT NULL DEFAULT 'identified'
    CHECK (status IN ('identified','prospecting','active','paused')),
  target_properties    int,
  current_properties   int         NOT NULL DEFAULT 0,
  local_partners       text,
  cleaning_providers   text,
  regulatory_notes     text,
  target_launch_date   date,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_crm_markets" ON crm_markets FOR ALL USING (true);


-- =============================================================================
-- TABLE : crm_source_stats
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_source_stats (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start     date        NOT NULL,
  period_end       date        NOT NULL,
  pipeline_type    text,
  source           text,
  source_detail    text,
  nb_leads         int         NOT NULL DEFAULT 0,
  nb_converted     int         NOT NULL DEFAULT 0,
  revenue_generated decimal(12,2) NOT NULL DEFAULT 0,
  lead_cost_total  decimal(12,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_source_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_crm_source_stats" ON crm_source_stats FOR ALL USING (true);


-- =============================================================================
-- DONNÉES INITIALES : marchés d'expansion
-- =============================================================================

INSERT INTO crm_markets (city, country, status, target_properties, current_properties, notes) VALUES
  ('Tanger',      'MA', 'active',      25, 14, 'Marché principal. Forte demande tourisme détroit.'),
  ('Paris IDF',   'FR', 'active',      20,  7, 'Ouverture 2024. Segment haut de gamme.'),
  ('Marrakech',   'MA', 'prospecting',  15,  0, 'Partenaire local en cours d''identification.'),
  ('Casablanca',  'MA', 'identified',   20,  0, 'Étude de marché à lancer Q3 2026.'),
  ('Agadir',      'MA', 'identified',   10,  0, 'Saisonnalité estivale forte. À évaluer.')
ON CONFLICT DO NOTHING;
