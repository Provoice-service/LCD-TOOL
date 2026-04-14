-- =============================================================================
-- LCD TOOL — Migration 003 : fiche logement complète
-- Ajoute 23 colonnes à la table properties
-- =============================================================================

ALTER TABLE properties
  -- Arrivée / départ
  ADD COLUMN IF NOT EXISTS check_in_time               text,
  ADD COLUMN IF NOT EXISTS check_out_time              text,
  ADD COLUMN IF NOT EXISTS max_guests                  int,

  -- Accès serrures
  ADD COLUMN IF NOT EXISTS nuki_smartlock_id           text,
  ADD COLUMN IF NOT EXISTS key_box_code                text,
  ADD COLUMN IF NOT EXISTS key_box_location            text,
  ADD COLUMN IF NOT EXISTS access_instructions_full    text,

  -- Équipements & intérieur
  ADD COLUMN IF NOT EXISTS appliances_info             text,
  ADD COLUMN IF NOT EXISTS heating_info                text,
  ADD COLUMN IF NOT EXISTS cleaning_products_location  text,

  -- Immeuble & stationnement
  ADD COLUMN IF NOT EXISTS parking_info                text,
  ADD COLUMN IF NOT EXISTS elevator_info               text,
  ADD COLUMN IF NOT EXISTS floor_info                  text,
  ADD COLUMN IF NOT EXISTS trash_info                  text,

  -- Règles
  ADD COLUMN IF NOT EXISTS noise_rules                 text,
  ADD COLUMN IF NOT EXISTS smoking_rules               text,
  ADD COLUMN IF NOT EXISTS pet_rules                   text,

  -- Quartier
  ADD COLUMN IF NOT EXISTS nearby_info                 text,

  -- Urgences & contacts
  ADD COLUMN IF NOT EXISTS emergency_procedure         text,
  ADD COLUMN IF NOT EXISTS owner_contact               text,
  ADD COLUMN IF NOT EXISTS inventory_notes             text,

  -- FAQ personnalisée
  ADD COLUMN IF NOT EXISTS custom_faq                  jsonb NOT NULL DEFAULT '[]'::jsonb;
