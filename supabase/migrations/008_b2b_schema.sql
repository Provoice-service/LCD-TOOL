-- =============================================================================
-- LCD TOOL — Migration 008 : Schéma B2B + Maroc + Qualité IA
-- Tables  : client_settings, agent_quality_scores, response_examples
-- Colonnes: properties (6), owners (7)
-- Process : 161-175
-- =============================================================================


-- =============================================================================
-- TABLE : client_settings  (paramètres par client B2B)
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_settings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  uuid        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  autonomy_level            text        NOT NULL DEFAULT 'validate_before_send'
                                          CHECK (autonomy_level IN ('full_auto','validate_before_send','human_only')),
  communication_tone        text        NOT NULL DEFAULT 'friendly'
                                          CHECK (communication_tone IN ('formal','friendly','luxury')),
  brand_name                text,
  brand_voice_description   text,
  escalation_contact        text,
  escalation_phone          text,
  escalation_hours          text,
  max_commercial_gesture    decimal(10,2),
  allow_early_checkin_auto  boolean     NOT NULL DEFAULT false,
  allow_late_checkout_auto  boolean     NOT NULL DEFAULT false,
  currency                  text        NOT NULL DEFAULT 'EUR',
  country_specific_rules    text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

CREATE TRIGGER client_settings_updated_at
  BEFORE UPDATE ON client_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_client_settings" ON client_settings FOR ALL USING (true);


-- =============================================================================
-- TABLE : agent_quality_scores
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_quality_scores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  agent_id    uuid,
  score       int         NOT NULL CHECK (score BETWEEN 1 AND 5),
  reviewer_id uuid,
  feedback    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_quality_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_agent_quality_scores" ON agent_quality_scores FOR ALL USING (true);


-- =============================================================================
-- TABLE : response_examples  (base de connaissances IA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS response_examples (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid        REFERENCES properties(id) ON DELETE SET NULL,
  situation_type  text        NOT NULL,   -- ex: 'access_issue', 'wifi', 'early_checkin', 'noise_complaint'
  bad_response    text,
  good_response   text        NOT NULL,
  explanation     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE response_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_response_examples" ON response_examples FOR ALL USING (true);

CREATE INDEX idx_response_examples_situation ON response_examples(situation_type);
CREATE INDEX idx_response_examples_property  ON response_examples(property_id);


-- =============================================================================
-- COLONNES : properties  (langue, devise, règles culturelles)
-- =============================================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS currency             text    NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS language_primary     text    NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS language_secondary   text,
  ADD COLUMN IF NOT EXISTS ramadan_rules        text,
  ADD COLUMN IF NOT EXISTS alcohol_allowed      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prayer_times_nearby  text;


-- =============================================================================
-- COLONNES : owners  (B2B autonomy + marque + escalade)
-- =============================================================================

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS autonomy_level      text    NOT NULL DEFAULT 'validate'
                                                 CHECK (autonomy_level IN ('full_auto','validate','human_only')),
  ADD COLUMN IF NOT EXISTS communication_tone  text    NOT NULL DEFAULT 'friendly'
                                                 CHECK (communication_tone IN ('formal','friendly','luxury')),
  ADD COLUMN IF NOT EXISTS brand_name          text,
  ADD COLUMN IF NOT EXISTS escalation_phone    text,
  ADD COLUMN IF NOT EXISTS escalation_hours    text,
  ADD COLUMN IF NOT EXISTS currency            text    NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS country             text    NOT NULL DEFAULT 'FR';


-- =============================================================================
-- PROCESS LIBRARY — 161 à 175
-- =============================================================================

INSERT INTO process_library
  (id, category, priority, title, description, is_automated, automation_method, automation_url,
   documentation_percent, automation_percent, status, assigned_to, notes)
VALUES

-- ── SPÉCIFIQUE B2B SERVICE CLIENT ─────────────────────────────────────────
(161, 'Service Client B2B', 'Haute',
 'Formation agent sur nouveau logement client',
 'Maîtriser la fiche logement en moins d'1h avant première prise en charge : lecture fiche, quiz accès, simulation réponse IA.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

(162, 'Service Client B2B', 'Haute',
 'Contrôle qualité des réponses agents',
 'Relecture aléatoire de 10 % des réponses, scoring 1-5, feedback individuel, mise à jour base de connaissances IA.',
 false, NULL, NULL, 30, 0, 'todo', NULL, NULL),

(163, 'Service Client B2B', 'Haute',
 'Gestion d'un pic d'activité saisonnier',
 'Renforcement équipe temporaire, priorisation des tickets, activation mode full_auto sur logements simples.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

(164, 'Service Client B2B', 'Haute',
 'Offboarding d'un client B2B',
 'Transfert données voyageurs, révocation accès API, export historique, clôture facturation, archivage.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

(165, 'Service Client B2B', 'Haute',
 'Rapport hebdomadaire automatique',
 'Récapitulatif lundi matin : réservations entrantes, incidents ouverts, taux de réponse IA, KPIs satisfaction.',
 true, 'Cron + SQL + email', NULL, 40, 60, 'todo', NULL, NULL),

-- ── SPÉCIFIQUE MAROC ──────────────────────────────────────────────────────
(166, 'Spécifique Maroc', 'Haute',
 'Vérification CIN / passeport voyageur (obligation légale Maroc)',
 'Collecte obligatoire d'une copie pièce d'identité avant check-in. Envoi par WhatsApp ou email. Archivage 1 an.',
 false, NULL, NULL, 30, 0, 'todo', NULL, 'Obligation légale hôtelière Maroc (décret 2-12-622)'),

(167, 'Spécifique Maroc', 'Haute',
 'Gestion taxe de séjour Maroc',
 'Calcul par nuitée et par voyageur selon commune, collecte en espèces ou virement, déclaration trimestrielle.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

(168, 'Spécifique Maroc', 'Haute',
 'Adaptation règles Ramadan',
 'Horaires check-in/out ajustés, info iftar local, pas de musique après 22h, respect équipements cuisine halal.',
 false, NULL, NULL, 40, 0, 'todo', NULL, NULL),

(169, 'Spécifique Maroc', 'Haute',
 'Gestion voyageur international (visa, douane)',
 'Réponses FAQ : pas de visa pour UE/France, fiche d'hébergement disponible sur demande, aide taxi aéroport.',
 false, NULL, NULL, 50, 0, 'todo', NULL, NULL),

(170, 'Spécifique Maroc', 'Moyenne',
 'Communication en darija',
 'Réponses de base en dialecte marocain pour voyageurs locaux : bonjour, bienvenue, questions clés.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

-- ── QUALITÉ & AMÉLIORATION CONTINUE ──────────────────────────────────────
(171, 'Qualité & Amélioration', 'Haute',
 'Analyse mensuelle des incidents récurrents',
 'Identifier les patterns (même type d'incident, même logement), proposer corrections préventives, mettre à jour FAQ.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

(172, 'Qualité & Amélioration', 'Haute',
 'Mise à jour base de connaissances IA',
 'Ajouter nouveaux cas gérés, corriger mauvaises réponses, enrichir response_examples, re-tester le prompt.',
 false, NULL, NULL, 30, 0, 'todo', NULL, NULL),

(173, 'Qualité & Amélioration', 'Haute',
 'Bilan mensuel performance équipe',
 'KPIs : taux réponse IA utilisée, temps moyen réponse, score qualité moyen, NPS voyageurs, incidents résolus.',
 false, NULL, NULL, 30, 0, 'todo', NULL, NULL),

(174, 'Qualité & Amélioration', 'Moyenne',
 'Veille concurrentielle service client LCD',
 'Analyse trimestrielle : Albert SAV, Hostaway, Lodgify — fonctionnalités IA, pricing, benchmark.',
 false, NULL, NULL, 20, 0, 'todo', NULL, NULL),

(175, 'Qualité & Amélioration', 'Haute',
 'Test et amélioration des prompts IA',
 'A/B test de 2 variantes de prompt sur 50 messages réels, mesure taux d'utilisation et score qualité, déploiement du meilleur.',
 false, NULL, NULL, 40, 20, 'todo', NULL, NULL);
