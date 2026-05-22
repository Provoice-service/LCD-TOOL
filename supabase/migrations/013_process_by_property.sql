-- =============================================================================
-- LCD TOOL — Migration 013 : Process personnalisés par logement
-- Tables  : process_steps, process_variables
-- Colonnes: process_library (7 nouvelles colonnes)
-- Données : 5 process templates avec étapes détaillées
-- =============================================================================


-- =============================================================================
-- COLONNES : process_library
-- =============================================================================

ALTER TABLE process_library
  ADD COLUMN IF NOT EXISTS is_template          boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS property_id          uuid        REFERENCES properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_process_id    uuid        REFERENCES process_library(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_type_applicable text[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS country_applicable   text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content              text,
  ADD COLUMN IF NOT EXISTS variables_used       text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_updated_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_process_library_property_id      ON process_library(property_id);
CREATE INDEX IF NOT EXISTS idx_process_library_parent_process_id ON process_library(parent_process_id);
CREATE INDEX IF NOT EXISTS idx_process_library_is_template       ON process_library(is_template);


-- =============================================================================
-- TABLE : process_steps
-- =============================================================================

CREATE TABLE IF NOT EXISTS process_steps (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id        uuid        NOT NULL REFERENCES process_library(id) ON DELETE CASCADE,
  step_number       int         NOT NULL,
  title             text        NOT NULL,
  instruction       text        NOT NULL,
  responsible       text        NOT NULL DEFAULT 'agent_service_client'
                                CHECK (responsible IN (
                                  'agent_service_client', 'equipe_menage',
                                  'gestionnaire', 'voyageur', 'automatique'
                                )),
  tool_needed       text,
  estimated_minutes int         NOT NULL DEFAULT 5,
  is_automated      boolean     NOT NULL DEFAULT false,
  automation_module text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_steps_process_id   ON process_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_process_steps_step_number  ON process_steps(process_id, step_number);

ALTER TABLE process_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_process_steps" ON process_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- TABLE : process_variables
-- =============================================================================

CREATE TABLE IF NOT EXISTS process_variables (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id     uuid    NOT NULL REFERENCES process_library(id) ON DELETE CASCADE,
  variable_name  text    NOT NULL,
  source_table   text    NOT NULL DEFAULT 'properties',
  source_column  text    NOT NULL,
  display_label  text    NOT NULL,
  is_required    boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_process_variables_process_id ON process_variables(process_id);

ALTER TABLE process_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_process_variables" ON process_variables
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- PROCESS TEMPLATES — Check-in autonome Tuya/SmartLife
-- =============================================================================

DO $$
DECLARE
  v_process_id uuid;
BEGIN

INSERT INTO process_library (
  number, category, process_name, description, priority, status,
  is_template, access_type_applicable, country_applicable,
  content, variables_used
) VALUES (
  200, 'Check-in', 'Check-in autonome Tuya / SmartLife',
  'Envoi du code d''accès temporaire généré via Tuya ou SmartLife, avec instructions complètes au voyageur.',
  'Haute', 'Documenté',
  true, ARRAY['tuya', 'smartlife'], ARRAY['FR', 'MA', 'BE', 'ES'],
  'Process standard pour les logements équipés d''une serrure connectée Tuya ou SmartLife. Le code est généré automatiquement pour la durée exacte du séjour.',
  ARRAY['access_code', 'access_instructions_full', 'concierge_phone', 'syndic_required', 'syndic_phone', 'check_in_time']
) RETURNING id INTO v_process_id;

INSERT INTO process_steps (process_id, step_number, title, instruction, responsible, tool_needed, estimated_minutes, is_automated, automation_module) VALUES
  (v_process_id, 1, 'Vérifier la checklist complète',
   'Contrôler que le contrat est signé, la pièce d''identité reçue, et la caution validée avant d''envoyer l''accès.',
   'agent_service_client', 'LCD Tool — module Checklist', 2, false, null),
  (v_process_id, 2, 'Générer le code Tuya temporaire',
   'Dans LCD Tool, module Tuya : générer un code valable du check_in au check_out. Vérifier que le device est en ligne.',
   'automatique', 'LCD Tool — module Tuya', 1, true, 'tuya_access'),
  (v_process_id, 3, 'Envoyer les instructions d''entrée',
   'Envoyer au voyageur : access_instructions_full + le code généré + concierge_phone. Personnaliser selon la langue du voyageur.',
   'agent_service_client', 'Superhote / WhatsApp / Email', 3, false, null),
  (v_process_id, 4, 'Marquer "accès envoyé" dans la checklist',
   'Cocher access_code_sent = true dans la réservation. La checklist doit être 100% complète.',
   'agent_service_client', 'LCD Tool', 1, false, null),
  (v_process_id, 5, 'Envoyer documents au syndic (Maroc uniquement)',
   'Si syndic_required = true : envoyer passeport + contrat au syndic_phone via WhatsApp. Marquer "syndic notifié".',
   'agent_service_client', 'WhatsApp', 5, false, null);

INSERT INTO process_variables (process_id, variable_name, source_column, display_label, is_required) VALUES
  (v_process_id, 'access_code',            'tuya_device_id',          'Device Tuya / Code accès', true),
  (v_process_id, 'access_instructions_full','access_instructions_full','Instructions d''entrée complètes', true),
  (v_process_id, 'concierge_phone',        'concierge_phone',         'Téléphone conciergerie', false),
  (v_process_id, 'check_in_time',          'check_in_time',           'Heure de check-in', true),
  (v_process_id, 'syndic_required',        'syndic_required',         'Syndic requis ?', false),
  (v_process_id, 'syndic_phone',           'syndic_phone',            'Téléphone syndic/gardien', false);

END $$;


-- =============================================================================
-- PROCESS TEMPLATES — Check-in autonome boîte à clé
-- =============================================================================

DO $$
DECLARE
  v_process_id uuid;
BEGIN

INSERT INTO process_library (
  number, category, process_name, description, priority, status,
  is_template, access_type_applicable, country_applicable,
  content, variables_used
) VALUES (
  201, 'Check-in', 'Check-in autonome boîte à clé',
  'Envoi du code et de l''emplacement de la boîte à clé, avec adresse précise et informations d''accès immeuble.',
  'Haute', 'Documenté',
  true, ARRAY['key_box'], ARRAY['FR', 'MA', 'BE', 'ES'],
  'Process pour les logements avec boîte à clé physique. Toutes les informations d''accès sont centralisées dans la fiche logement.',
  ARRAY['key_box_code', 'key_box_location', 'address', 'floor_info', 'concierge_phone', 'check_in_time']
) RETURNING id INTO v_process_id;

INSERT INTO process_steps (process_id, step_number, title, instruction, responsible, tool_needed, estimated_minutes, is_automated, automation_module) VALUES
  (v_process_id, 1, 'Vérifier la checklist complète',
   'Contrôler que le contrat est signé, la pièce d''identité reçue, et la caution validée avant d''envoyer l''accès.',
   'agent_service_client', 'LCD Tool — module Checklist', 2, false, null),
  (v_process_id, 2, 'Envoyer les instructions boîte à clé',
   'Envoyer au voyageur : adresse exacte (address), étage/immeuble (floor_info), emplacement de la boîte (key_box_location) et le code (key_box_code). Heure minimum : check_in_time.',
   'agent_service_client', 'Superhote / WhatsApp / Email', 3, false, null),
  (v_process_id, 3, 'Marquer "accès envoyé" dans la checklist',
   'Cocher access_code_sent = true dans la réservation.',
   'agent_service_client', 'LCD Tool', 1, false, null);

INSERT INTO process_variables (process_id, variable_name, source_column, display_label, is_required) VALUES
  (v_process_id, 'key_box_code',     'key_box_code',     'Code boîte à clé', true),
  (v_process_id, 'key_box_location', 'key_box_location', 'Emplacement boîte à clé', true),
  (v_process_id, 'address',          'address',          'Adresse du logement', true),
  (v_process_id, 'floor_info',       'floor_info',       'Étage & accès immeuble', false),
  (v_process_id, 'concierge_phone',  'concierge_phone',  'Téléphone conciergerie', false),
  (v_process_id, 'check_in_time',    'check_in_time',    'Heure de check-in', true);

END $$;


-- =============================================================================
-- PROCESS TEMPLATES — Urgence accès — code ne fonctionne pas
-- =============================================================================

DO $$
DECLARE
  v_process_id uuid;
BEGIN

INSERT INTO process_library (
  number, category, process_name, description, priority, status,
  is_template, access_type_applicable, country_applicable,
  content, variables_used
) VALUES (
  202, 'Check-in', 'Urgence accès — code ne fonctionne pas',
  'Le voyageur ne peut pas entrer : code refusé ou boîte à clé bloquée. Résolution rapide en moins de 5 minutes.',
  'Haute', 'Documenté',
  true, ARRAY['tuya', 'smartlife', 'key_box', 'nuki'], ARRAY['FR', 'MA', 'BE', 'ES'],
  'Process d''urgence pour tous types d''accès. Objectif : résoudre en 5 minutes maximum et rassurer le voyageur.',
  ARRAY['access_type', 'backup_phone', 'concierge_phone']
) RETURNING id INTO v_process_id;

INSERT INTO process_steps (process_id, step_number, title, instruction, responsible, tool_needed, estimated_minutes, is_automated, automation_module) VALUES
  (v_process_id, 1, 'Rassurer le voyageur immédiatement',
   'Répondre dans la minute : "Nous prenons en charge votre accès immédiatement, résolu dans 5 minutes max." Ne pas laisser le voyageur sans réponse.',
   'agent_service_client', 'Superhote / WhatsApp', 1, false, null),
  (v_process_id, 2, 'Régénérer un nouveau code (Tuya/SmartLife)',
   'Si access_type = tuya ou smartlife : aller dans LCD Tool > module Tuya > Régénérer code. Envoyer le nouveau code immédiatement.',
   'agent_service_client', 'LCD Tool — module Tuya', 2, false, null),
  (v_process_id, 3, 'Vérifier et renvoyer le code boîte à clé',
   'Si access_type = key_box : vérifier le code dans la fiche logement. Envoyer photos de la boîte si nécessaire.',
   'agent_service_client', 'WhatsApp', 2, false, null),
  (v_process_id, 4, 'Envoyer le nouveau code avec instructions',
   'Envoyer le nouveau code avec instructions précises et photo si possible. Confirmer que le voyageur est entré.',
   'agent_service_client', 'WhatsApp', 1, false, null),
  (v_process_id, 5, 'Escalader si non résolu',
   'Si non résolu après 5 min : contacter backup_phone + gestionnaire immédiatement. Ne jamais laisser un voyageur bloqué devant la porte.',
   'gestionnaire', 'Téléphone', 1, false, null);

INSERT INTO process_variables (process_id, variable_name, source_column, display_label, is_required) VALUES
  (v_process_id, 'access_type',     'access_type',     'Type d''accès', true),
  (v_process_id, 'backup_phone',    'backup_phone',    'Téléphone de secours', true),
  (v_process_id, 'concierge_phone', 'concierge_phone', 'Téléphone conciergerie', false);

END $$;


-- =============================================================================
-- PROCESS TEMPLATES — Ménage post check-out
-- =============================================================================

DO $$
DECLARE
  v_process_id uuid;
BEGIN

INSERT INTO process_library (
  number, category, process_name, description, priority, status,
  is_template, access_type_applicable, country_applicable,
  content, variables_used
) VALUES (
  203, 'Ménage & linge', 'Ménage post check-out',
  'Organisation du ménage après le départ d''un voyageur : notification J-1, exécution, validation photos.',
  'Haute', 'Documenté',
  true, ARRAY['tuya', 'smartlife', 'key_box', 'nuki'], ARRAY['FR', 'MA', 'BE', 'ES'],
  'Process ménage standard. La notification J-1 est automatisée. La validation photos est obligatoire avant toute nouvelle arrivée.',
  ARRAY['cleaning_provider_contact', 'cleaning_specific_instructions', 'cleaning_duration_hours', 'check_out_time']
) RETURNING id INTO v_process_id;

INSERT INTO process_steps (process_id, step_number, title, instruction, responsible, tool_needed, estimated_minutes, is_automated, automation_module) VALUES
  (v_process_id, 1, 'Notification automatique J-1 à l''équipe ménage',
   'LCD Tool envoie automatiquement un WhatsApp à cleaning_provider_contact la veille du check-out avec date, heure et adresse.',
   'automatique', 'LCD Tool — notifications automatiques', 1, true, 'cleaning_notifications'),
  (v_process_id, 2, 'Ménage selon les consignes spécifiques',
   'L''équipe ménage effectue le ménage selon cleaning_specific_instructions. Durée estimée : cleaning_duration_hours heures.',
   'equipe_menage', 'Consignes ménage LCD Tool', 0, false, null),
  (v_process_id, 3, 'Photos de validation pièce par pièce',
   'L''équipe ménage prend des photos de chaque pièce et les uploade dans LCD Tool (section Ménage de la réservation).',
   'equipe_menage', 'LCD Tool — upload photos', 5, false, null),
  (v_process_id, 4, 'Validation des photos par l''agent',
   'L''agent vérifie les photos dans LCD Tool. Si conforme : marquer ménage validé. Si problème : contacter l''équipe pour re-passage.',
   'agent_service_client', 'LCD Tool', 2, false, null);

INSERT INTO process_variables (process_id, variable_name, source_column, display_label, is_required) VALUES
  (v_process_id, 'cleaning_provider_contact',      'cleaning_provider_contact',      'Contact prestataire ménage', true),
  (v_process_id, 'cleaning_specific_instructions', 'cleaning_specific_instructions', 'Instructions ménage spécifiques', false),
  (v_process_id, 'cleaning_duration_hours',        'cleaning_duration_hours',        'Durée ménage (heures)', false),
  (v_process_id, 'check_out_time',                 'check_out_time',                 'Heure de check-out', true);

END $$;


-- =============================================================================
-- PROCESS TEMPLATES — Envoi documents syndic (Maroc)
-- =============================================================================

DO $$
DECLARE
  v_process_id uuid;
BEGIN

INSERT INTO process_library (
  number, category, process_name, description, priority, status,
  is_template, access_type_applicable, country_applicable,
  content, variables_used
) VALUES (
  204, 'Confirmation & préparation', 'Envoi documents syndic (Maroc)',
  'Transmission obligatoire des documents voyageur au syndic ou gardien d''immeuble, exigée par la réglementation marocaine.',
  'Haute', 'Documenté',
  true, ARRAY['tuya', 'smartlife', 'key_box', 'nuki'], ARRAY['MA'],
  'Obligation légale au Maroc : le syndic ou gardien doit recevoir le passeport et (selon les cas) le contrat de location avant le check-in.',
  ARRAY['syndic_phone', 'syndic_name', 'syndic_whatsapp_message', 'syndic_requires_contract']
) RETURNING id INTO v_process_id;

INSERT INTO process_steps (process_id, step_number, title, instruction, responsible, tool_needed, estimated_minutes, is_automated, automation_module) VALUES
  (v_process_id, 1, 'Vérifier documents disponibles',
   'S''assurer que le passeport est reçu et que le contrat Superhote est généré avant d''envoyer au syndic.',
   'agent_service_client', 'LCD Tool — Checklist', 1, false, null),
  (v_process_id, 2, 'Envoyer documents au syndic via WhatsApp',
   'Envoyer à syndic_phone : passeport (image) + contrat si syndic_requires_contract = true. Message : syndic_whatsapp_message. Si automatisé, LCD Tool gère l''envoi.',
   'agent_service_client', 'WhatsApp', 2, false, null),
  (v_process_id, 3, 'Marquer "syndic notifié" dans la réservation',
   'Cocher syndic_notified dans la réservation. Conserver la confirmation WhatsApp comme preuve.',
   'agent_service_client', 'LCD Tool', 1, false, null);

INSERT INTO process_variables (process_id, variable_name, source_column, display_label, is_required) VALUES
  (v_process_id, 'syndic_phone',              'syndic_phone',              'Numéro WhatsApp syndic', true),
  (v_process_id, 'syndic_name',               'syndic_name',               'Nom du syndic/gardien', false),
  (v_process_id, 'syndic_whatsapp_message',   'syndic_whatsapp_message',   'Message WhatsApp syndic', false),
  (v_process_id, 'syndic_requires_contract',  'syndic_requires_contract',  'Contrat requis par syndic', false);

END $$;
