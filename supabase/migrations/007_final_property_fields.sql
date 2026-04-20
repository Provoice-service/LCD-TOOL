-- =============================================================================
-- LCD TOOL — Migration 007 : champs finaux logement + bibliothèque process
-- =============================================================================

-- ── Partie 1 : 24 nouvelles colonnes sur properties ──────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS lock_brand_model               text,
  ADD COLUMN IF NOT EXISTS lock_app_url                   text,
  ADD COLUMN IF NOT EXISTS concierge_phone                text,
  ADD COLUMN IF NOT EXISTS backup_phone                   text,
  ADD COLUMN IF NOT EXISTS local_police_number            text,
  ADD COLUMN IF NOT EXISTS dishwasher_available           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oven_microwave_info            text,
  ADD COLUMN IF NOT EXISTS tv_instructions                text,
  ADD COLUMN IF NOT EXISTS ac_instructions                text,
  ADD COLUMN IF NOT EXISTS bakery_nearby                  text,
  ADD COLUMN IF NOT EXISTS local_events                   text,
  ADD COLUMN IF NOT EXISTS digital_welcome_book_url       text,
  ADD COLUMN IF NOT EXISTS cleaning_provider_contact      text,
  ADD COLUMN IF NOT EXISTS cleaning_cost                  decimal,
  ADD COLUMN IF NOT EXISTS cleaning_duration_hours        decimal,
  ADD COLUMN IF NOT EXISTS linen_kit_standard             text,
  ADD COLUMN IF NOT EXISTS cleaning_specific_instructions text,
  ADD COLUMN IF NOT EXISTS direct_booking_url             text,
  ADD COLUMN IF NOT EXISTS price_low_season               decimal,
  ADD COLUMN IF NOT EXISTS price_high_season              decimal,
  ADD COLUMN IF NOT EXISTS deposit_amount                 decimal,
  ADD COLUMN IF NOT EXISTS parties_allowed                text,
  ADD COLUMN IF NOT EXISTS silence_hour                   text,
  ADD COLUMN IF NOT EXISTS specific_rules                 text;


-- ── Partie 2 : Table process_library ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS process_library (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  number               int,
  category             text        NOT NULL,
  process_name         text        NOT NULL,
  description          text,
  priority             text        NOT NULL DEFAULT 'Moyenne'
                                   CHECK (priority IN ('Haute', 'Moyenne', 'Basse')),
  status               text        NOT NULL DEFAULT 'À documenter'
                                   CHECK (status IN ('À documenter', 'En cours', 'Documenté', 'Automatisé')),
  documentation_method text,
  resource_url         text,
  notes                text,
  assigned_to          text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_library_category ON process_library(category);
CREATE INDEX IF NOT EXISTS idx_process_library_status   ON process_library(status);
CREATE INDEX IF NOT EXISTS idx_process_library_priority ON process_library(priority);

CREATE TRIGGER set_process_library_updated_at
  BEFORE UPDATE ON process_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE process_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_all ON process_library
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- ── Partie 3 : 160 process ────────────────────────────────────────────────────

INSERT INTO process_library (number, category, process_name, description, priority) VALUES

-- AVANT LA RÉSERVATION (10)
(1,  'Avant la réservation', 'Réponse à une demande de renseignement',     'Répondre aux questions d''un voyageur potentiel (prix, dispo, équipements)',             'Haute'),
(2,  'Avant la réservation', 'Gestion d''une demande de réservation',       'Accepter/refuser une demande selon les critères définis',                              'Haute'),
(3,  'Avant la réservation', 'Vérification du profil voyageur',             'Checker les avis, vérifications d''identité, red flags',                               'Haute'),
(4,  'Avant la réservation', 'Pré-approbation d''un voyageur',              'Envoyer une pré-approbation avec message personnalisé',                                 'Moyenne'),
(5,  'Avant la réservation', 'Gestion d''une demande de prix spécial',      'Négociation tarifaire, réduction long séjour, offre spéciale',                         'Moyenne'),
(6,  'Avant la réservation', 'Réponse à une demande de réservation groupe', 'Process spécifique pour les groupes (caution, règles)',                                'Moyenne'),
(7,  'Avant la réservation', 'Gestion d''une demande dernière minute',      'Réservation J-1 ou jour même : vérifier dispo ménage',                                 'Haute'),
(8,  'Avant la réservation', 'Gestion des demandes via plusieurs plateformes','Réponse cohérente Airbnb / Booking / direct / téléphone',                            'Haute'),
(9,  'Avant la réservation', 'Réponse aux questions fréquentes (FAQ)',      'Parking, animaux, heure d''arrivée, wifi, etc.',                                       'Haute'),
(10, 'Avant la réservation', 'Relance d''un voyageur qui n''a pas finalisé','Suivi d''une demande restée sans suite',                                               'Basse'),

-- CONFIRMATION & PRÉPARATION (12)
(11, 'Confirmation & préparation', 'Message de confirmation de réservation',     'Envoi du récapitulatif : dates, montant, conditions',                             'Haute'),
(12, 'Confirmation & préparation', 'Envoi du guide d''arrivée (J-7)',            'Itinéraire, transports, infos quartier',                                          'Haute'),
(13, 'Confirmation & préparation', 'Envoi des instructions de check-in (J-1)',   'Code porte, boîte à clés, adresse exacte, étage',                                'Haute'),
(14, 'Confirmation & préparation', 'Collecte des informations voyageur',         'Nom, prénom, heure d''arrivée, nombre de personnes',                             'Haute'),
(15, 'Confirmation & préparation', 'Gestion des demandes spéciales pré-séjour',  'Lit bébé, chaise haute, place de parking, transfert aéroport',                   'Moyenne'),
(16, 'Confirmation & préparation', 'Planification du ménage pré-arrivée',        'Déclencher la mission ménage, vérifier les dispos',                               'Haute'),
(17, 'Confirmation & préparation', 'Vérification du calendrier multi-plateformes','S''assurer qu''il n''y a pas de double réservation',                             'Haute'),
(18, 'Confirmation & préparation', 'Préparation du kit d''accueil',              'Café, thé, bouteille d''eau, petit mot personnalisé',                             'Moyenne'),
(19, 'Confirmation & préparation', 'Gestion de la taxe de séjour',               'Calcul et information au voyageur si nécessaire',                                 'Haute'),
(20, 'Confirmation & préparation', 'Envoi des règles du logement',               'Règlement intérieur, voisinage, bruit, poubelles',                                'Haute'),
(21, 'Confirmation & préparation', 'Configuration de la serrure connectée',      'Création du code temporaire pour le séjour',                                      'Haute'),
(22, 'Confirmation & préparation', 'Vérification des équipements avant arrivée', 'Wifi fonctionnel, TV, électroménager, chauffage/clim',                            'Haute'),

-- CHECK-IN (10)
(23, 'Check-in', 'Check-in autonome serrure connectée',              'Le voyageur entre seul avec un code',                                         'Haute'),
(24, 'Check-in', 'Check-in autonome boîte à clés',                  'Instructions pour récupérer la clé',                                          'Haute'),
(25, 'Check-in', 'Accueil physique du voyageur',                     'Remise des clés en main propre, visite du logement',                          'Moyenne'),
(26, 'Check-in', 'Check-in avec conciergerie partenaire',            'Délégation à un partenaire local',                                            'Moyenne'),
(27, 'Check-in', 'Gestion d''une arrivée tardive (après 22h)',       'Process spécifique nuit',                                                     'Haute'),
(28, 'Check-in', 'Gestion d''une arrivée anticipée',                 'Early check-in : logement prêt ou pas',                                       'Haute'),
(29, 'Check-in', 'Voyageur qui ne trouve pas le logement',           'Guidage en temps réel',                                                       'Haute'),
(30, 'Check-in', 'Code d''accès qui ne fonctionne pas',             'Résolution urgente, code de secours',                                         'Haute'),
(31, 'Check-in', 'Voyageur qui arrive avec plus de personnes que prévu','Gestion du dépassement de capacité',                                       'Haute'),
(32, 'Check-in', 'Première impression négative du voyageur',         'Gérer une mauvaise surprise à l''arrivée',                                    'Haute'),

-- PENDANT LE SÉJOUR (22)
(33, 'Pendant le séjour', 'Message de bienvenue / prise de température (J+1)','Vérifier que tout va bien dès le lendemain',                         'Haute'),
(34, 'Pendant le séjour', 'Gestion d''une demande de renseignement local',    'Restaurant, taxi, activité',                                         'Moyenne'),
(35, 'Pendant le séjour', 'Gestion d''un problème technique mineur',          'Ampoule, télécommande, etc.',                                        'Haute'),
(36, 'Pendant le séjour', 'Gestion d''une fuite d''eau',                      'Urgence plomberie : couper l''eau, appeler prestataire',              'Haute'),
(37, 'Pendant le séjour', 'Gestion d''une panne de chauffage/clim',           'Confort essentiel',                                                   'Haute'),
(38, 'Pendant le séjour', 'Gestion d''une panne d''électricité',              'Vérifier disjoncteur, appeler électricien',                          'Haute'),
(39, 'Pendant le séjour', 'Gestion d''une serrure bloquée',                   'Voyageur enfermé dehors ou dedans',                                  'Haute'),
(40, 'Pendant le séjour', 'Gestion de nuisances sonores (voisins)',           'Plainte de voisins contre voyageur',                                 'Haute'),
(41, 'Pendant le séjour', 'Voyageur bruyant — plainte des voisins',           'Intervention et avertissement',                                      'Haute'),
(42, 'Pendant le séjour', 'Gestion d''un dégât causé par le voyageur',        'Constat, photos, imputation caution',                                'Haute'),
(43, 'Pendant le séjour', 'Gestion d''une demande d''extension de séjour',    'Vérifier dispo, ajuster prix',                                       'Moyenne'),
(44, 'Pendant le séjour', 'Gestion d''une demande de départ anticipé',        'Remboursement partiel selon conditions',                              'Moyenne'),
(45, 'Pendant le séjour', 'Gestion d''un voyageur mécontent',                 'Désescalade, solution proposée',                                     'Haute'),
(46, 'Pendant le séjour', 'Gestion d''un problème de propreté signalé',       'Intervention ménage, geste commercial si nécessaire',                'Haute'),
(47, 'Pendant le séjour', 'Gestion d''un objet manquant signalé par le voyageur','Vérification, réponse diplomate',                                'Haute'),
(48, 'Pendant le séjour', 'Gestion d''insectes / nuisibles',                  'Intervention rapide, geste commercial',                              'Haute'),
(49, 'Pendant le séjour', 'Gestion d''un voyageur qui ne respecte pas les règles','Avertissement, signalement plateforme',                          'Haute'),
(50, 'Pendant le séjour', 'Problème d''eau chaude',                           'Dépannage ou remplacement chauffe-eau',                              'Haute'),
(51, 'Pendant le séjour', 'Panne d''internet / wifi',                         'Redémarrage box, technicien si besoin',                              'Haute'),
(52, 'Pendant le séjour', 'Voyageur malade ou blessé',                        'Orienter vers médecin ou urgences',                                  'Haute'),
(53, 'Pendant le séjour', 'Gestion d''un cambriolage ou vol',                 'Police, assurance, propriétaire',                                    'Haute'),
(54, 'Pendant le séjour', 'Gestion d''un sinistre (incendie, inondation)',    'Évacuation, pompiers, assurance',                                    'Haute'),

-- CHECK-OUT (10)
(55, 'Check-out', 'Envoi du rappel de check-out (J-1)',            'Rappeler heure départ et procédure',                                          'Haute'),
(56, 'Check-out', 'Check-out autonome',                            'Instructions pour laisser les clés',                                          'Haute'),
(57, 'Check-out', 'Check-out avec remise de clés en main propre',  'État des lieux de sortie',                                                    'Moyenne'),
(58, 'Check-out', 'Inspection post-départ',                        'Checklist état logement avec photos',                                         'Haute'),
(59, 'Check-out', 'Gestion d''un objet oublié par le voyageur',   'Contacter, retourner ou conserver',                                           'Moyenne'),
(60, 'Check-out', 'Constat de dégâts au check-out',               'Photos, évaluation, imputation caution',                                      'Haute'),
(61, 'Check-out', 'Check-out tardif non autorisé',                 'Pénalité, intervention si nécessaire',                                        'Haute'),
(62, 'Check-out', 'Demande de late check-out',                     'Vérifier dispo ménage, facturer si possible',                                 'Haute'),
(63, 'Check-out', 'Gestion du linge sale post-départ',             'Collecte, lavage, inventaire',                                                'Haute'),
(64, 'Check-out', 'Nettoyage express entre deux séjours',          'Back-to-back : organisation ménage rapide',                                   'Haute'),

-- APRÈS LE SÉJOUR (8)
(65, 'Après le séjour', 'Message de remerciement post-séjour',     'Message chaleureux J+1',                                                      'Haute'),
(66, 'Après le séjour', 'Demande d''avis / review',                'Solliciter un avis positif',                                                  'Haute'),
(67, 'Après le séjour', 'Rédaction de l''avis sur le voyageur',    'Avis honnête et professionnel',                                               'Haute'),
(68, 'Après le séjour', 'Gestion d''un avis négatif reçu',         'Réponse publique, analyse interne',                                           'Haute'),
(69, 'Après le séjour', 'Réclamation caution / dégâts',            'Processus de réclamation plateforme',                                         'Haute'),
(70, 'Après le séjour', 'Envoi du compte-rendu au propriétaire',   'Rapport du séjour, revenus, incidents',                                       'Haute'),
(71, 'Après le séjour', 'Analyse de la satisfaction voyageur',     'Indicateurs qualité',                                                         'Moyenne'),
(72, 'Après le séjour', 'Fidélisation du voyageur',                'Offre retour, code promo réservation directe',                                'Moyenne'),

-- MÉNAGE & LINGE (11)
(73, 'Ménage & linge', 'Checklist ménage standard (pièce par pièce)', 'Protocol nettoyage complet',                                              'Haute'),
(74, 'Ménage & linge', 'Ménage de fond / grand nettoyage',            'Nettoyage approfondi périodique',                                         'Moyenne'),
(75, 'Ménage & linge', 'Contrôle qualité post-ménage (checklist photo)','Vérification avant arrivée voyageur',                                   'Haute'),
(76, 'Ménage & linge', 'Gestion du stock de linge',                   'Suivi et réapprovisionnement',                                            'Haute'),
(77, 'Ménage & linge', 'Rotation et lavage du linge',                 'Organisation laverie / pressing',                                         'Haute'),
(78, 'Ménage & linge', 'Réapprovisionnement des consommables',        'Gel douche, PQ, café, etc.',                                              'Haute'),
(79, 'Ménage & linge', 'Gestion des prestataires ménage',             'Suivi qualité, paiement',                                                 'Haute'),
(80, 'Ménage & linge', 'Recrutement d''un nouveau prestataire ménage','Critères, test, onboarding',                                              'Moyenne'),
(81, 'Ménage & linge', 'Gestion d''un ménage mal fait',              'Retour prestataire, re-passage',                                           'Haute'),
(82, 'Ménage & linge', 'Gestion des produits d''entretien',          'Stock, commande, rangement',                                               'Haute'),
(83, 'Ménage & linge', 'Ménage back-to-back (même jour entrée/sortie)','Organisation timing serré',                                              'Haute'),

-- MAINTENANCE & TECHNIQUE (11)
(84, 'Maintenance & technique', 'Signalement et suivi d''une panne',        'Ticket, prestataire, résolution',                                    'Haute'),
(85, 'Maintenance & technique', 'Calendrier de maintenance préventive',     'Vérifications régulières planifiées',                                'Moyenne'),
(86, 'Maintenance & technique', 'Gestion d''une urgence plomberie',         'Coupure eau, plombier urgence',                                      'Haute'),
(87, 'Maintenance & technique', 'Gestion d''une urgence électrique',        'Disjoncteur, électricien urgence',                                   'Haute'),
(88, 'Maintenance & technique', 'Gestion d''une urgence serrurerie',        'Serrurier urgence, code de secours',                                 'Haute'),
(89, 'Maintenance & technique', 'Inventaire du mobilier et équipements',    'Fiche par logement à jour',                                          'Moyenne'),
(90, 'Maintenance & technique', 'Remplacement d''un équipement défectueux', 'Achat, installation, facture',                                       'Haute'),
(91, 'Maintenance & technique', 'Gestion des travaux dans le logement',     'Coordination avec propriétaire',                                     'Moyenne'),
(92, 'Maintenance & technique', 'Relevé des compteurs (eau, électricité, gaz)','Suivi consommation',                                             'Moyenne'),
(93, 'Maintenance & technique', 'Gestion de la domotique',                  'Serrures, thermostats, capteurs',                                    'Moyenne'),
(94, 'Maintenance & technique', 'Vérification saisonnière (hiver/été)',     'Chauffage, clim, jardin',                                            'Moyenne'),

-- GESTION DES ANNONCES (10)
(95,  'Gestion des annonces', 'Création d''une annonce (nouveau bien)',    'Photos, description, équipements',                                    'Haute'),
(96,  'Gestion des annonces', 'Shooting photo professionnel',              'Organisation, brief photographe',                                     'Haute'),
(97,  'Gestion des annonces', 'Optimisation du titre de l''annonce',       'SEO plateformes',                                                     'Haute'),
(98,  'Gestion des annonces', 'Optimisation de la description',            'Mots clés, avantages, USP',                                           'Haute'),
(99,  'Gestion des annonces', 'Gestion des photos (mise à jour)',          'Renouvellement saisonnier',                                           'Moyenne'),
(100, 'Gestion des annonces', 'Publication multi-plateformes',             'Airbnb, Booking, Abritel simultané',                                  'Haute'),
(101, 'Gestion des annonces', 'Gestion du channel manager / PMS',         'Synchronisation, blocages',                                           'Haute'),
(102, 'Gestion des annonces', 'Mise à jour saisonnière de l''annonce',    'Texte, photos, tarifs',                                               'Moyenne'),
(103, 'Gestion des annonces', 'Gestion des restrictions de séjour',       'Durée min, jours arrivée',                                            'Moyenne'),
(104, 'Gestion des annonces', 'Réponse aux questions de la plateforme',   'Support Airbnb/Booking',                                              'Moyenne'),

-- REVENUE MANAGEMENT (9)
(105, 'Revenue management', 'Définition de la stratégie tarifaire',     'Positionnement marché',                                                 'Haute'),
(106, 'Revenue management', 'Grille tarifaire saisonnière',             'Basse/haute/événements',                                                'Haute'),
(107, 'Revenue management', 'Gestion des promotions',                   'Early bird, last minute, long séjour',                                  'Moyenne'),
(108, 'Revenue management', 'Ajustement dynamique des prix',            'PriceLabs, Beyond, manuel',                                             'Haute'),
(109, 'Revenue management', 'Analyse du taux d''occupation',            'Objectifs, optimisation',                                               'Haute'),
(110, 'Revenue management', 'Veille concurrentielle',                   'Suivi des concurrents directs',                                         'Haute'),
(111, 'Revenue management', 'Gestion des frais de ménage',              'Tarification, affichage',                                               'Haute'),
(112, 'Revenue management', 'Gestion des suppléments',                  'Animaux, personnes sup, linge',                                         'Moyenne'),
(113, 'Revenue management', 'Optimisation du RevPAR',                   'Revenu par nuit disponible',                                            'Haute'),

-- RELATION PROPRIÉTAIRE (11)
(114, 'Relation propriétaire', 'Onboarding d''un nouveau propriétaire',        'Signature mandat, fiche logement',                               'Haute'),
(115, 'Relation propriétaire', 'Signature du mandat de gestion',               'Contrat, commissions, conditions',                               'Haute'),
(116, 'Relation propriétaire', 'Compte-rendu mensuel au propriétaire',         'Revenus, taux occupation, incidents',                            'Haute'),
(117, 'Relation propriétaire', 'Gestion d''une demande de blocage de dates',   'Coordination calendrier',                                        'Haute'),
(118, 'Relation propriétaire', 'Gestion d''une demande de travaux par le propriétaire','Planning, coordination',                                 'Moyenne'),
(119, 'Relation propriétaire', 'Gestion d''un propriétaire mécontent',         'Écoute, solutions, fidélisation',                                'Haute'),
(120, 'Relation propriétaire', 'Renégociation du mandat / commission',         'Argumentaire valeur ajoutée',                                    'Moyenne'),
(121, 'Relation propriétaire', 'Ajout d''un nouveau bien (propriétaire existant)','Onboarding rapide',                                          'Haute'),
(122, 'Relation propriétaire', 'Offboarding d''un propriétaire',               'Clôture propre, documents',                                      'Moyenne'),
(123, 'Relation propriétaire', 'Versement des revenus au propriétaire',        'Virement mensuel, facture',                                      'Haute'),
(124, 'Relation propriétaire', 'Gestion d''un sinistre — communication propriétaire','Information immédiate',                                   'Haute'),

-- ADMINISTRATIF & FINANCIER (10)
(125, 'Administratif & financier', 'Facturation mensuelle des propriétaires',   'PDF auto, envoi email',                                         'Haute'),
(126, 'Administratif & financier', 'Déclaration de la taxe de séjour',          'Mairie, fréquence, montants',                                   'Haute'),
(127, 'Administratif & financier', 'Suivi de trésorerie',                       'Entrées/sorties, prévisionnel',                                 'Haute'),
(128, 'Administratif & financier', 'Déclaration des revenus locatifs',          'Obligations fiscales France/Maroc',                             'Haute'),
(129, 'Administratif & financier', 'Gestion des contrats d''assurance',         'PNO, multirisque, responsabilité civile',                       'Moyenne'),
(130, 'Administratif & financier', 'Gestion d''un litige avec un voyageur',     'Médiation, plateforme, justice',                                'Haute'),
(131, 'Administratif & financier', 'Gestion d''un litige avec un propriétaire', 'Contrat, médiation',                                            'Haute'),
(132, 'Administratif & financier', 'Réclamation assurance (sinistre)',           'Dossier, délais, indemnisation',                                'Haute'),
(133, 'Administratif & financier', 'Gestion de la TVA / régime fiscal',         'Auto-entrepreneur, LMNP, SCI',                                  'Haute'),
(134, 'Administratif & financier', 'Archivage des documents',                   'Contrats, factures, états des lieux',                           'Moyenne'),

-- ÉQUIPE & ORGANISATION (8)
(135, 'Équipe & organisation', 'Recrutement d''un prestataire / salarié',   'Annonce, entretien, test',                                          'Haute'),
(136, 'Équipe & organisation', 'Onboarding d''un nouveau membre d''équipe', 'Formation, accès outils, SOP',                                      'Haute'),
(137, 'Équipe & organisation', 'Planning de l''équipe',                     'Shifts, congés, remplacements',                                     'Haute'),
(138, 'Équipe & organisation', 'Communication interne quotidienne',         'Brief matin, Slack, WhatsApp',                                      'Haute'),
(139, 'Équipe & organisation', 'Réunion d''équipe hebdomadaire',            'Points, problèmes, améliorations',                                  'Moyenne'),
(140, 'Équipe & organisation', 'Gestion d''un conflit en interne',          'Médiation, règlement',                                              'Moyenne'),
(141, 'Équipe & organisation', 'Suivi des performances individuelles',      'KPIs, feedback',                                                    'Moyenne'),
(142, 'Équipe & organisation', 'Formation continue de l''équipe',           'Nouvelles procédures, outils',                                      'Moyenne'),

-- CONFORMITÉ & RÉGLEMENTATION (8)
(143, 'Conformité & réglementation', 'Enregistrement mairie / numéro d''enregistrement','Obligation légale',                                    'Haute'),
(144, 'Conformité & réglementation', 'Respect de la limite des 120 jours (résidence principale)','Suivi compteur',                              'Haute'),
(145, 'Conformité & réglementation', 'Changement d''usage (résidence secondaire)',    'Autorisation mairie',                                     'Haute'),
(146, 'Conformité & réglementation', 'Règlement de copropriété',                       'Vérification autorisation LCD',                          'Moyenne'),
(147, 'Conformité & réglementation', 'Conformité sécurité incendie',                  'Détecteurs, extincteurs, consignes',                      'Haute'),
(148, 'Conformité & réglementation', 'Diagnostic immobilier obligatoire',              'DPE, amiante, électricité',                               'Haute'),
(149, 'Conformité & réglementation', 'RGPD — gestion des données voyageurs',          'Collecte, stockage, suppression',                         'Haute'),
(150, 'Conformité & réglementation', 'Affichage obligatoire dans le logement',        'Consignes incendie, règlement',                           'Moyenne'),

-- AUTOMATISATION & IA (10)
(151, 'Automatisation & IA', 'Cartographie de tous les outils utilisés',     'Superhote, PriceLabs, etc.',                                       'Haute'),
(152, 'Automatisation & IA', 'Automatisation de la messagerie voyageur',     'Templates, déclencheurs',                                          'Haute'),
(153, 'Automatisation & IA', 'Automatisation du pricing',                    'PriceLabs, règles dynamiques',                                     'Haute'),
(154, 'Automatisation & IA', 'Automatisation des missions ménage',           'Notifications automatiques',                                       'Haute'),
(155, 'Automatisation & IA', 'Automatisation des rapports propriétaire',     'PDF mensuel auto',                                                 'Haute'),
(156, 'Automatisation & IA', 'Centralisation via PMS / Channel Manager',    'Superhote, source unique',                                         'Haute'),
(157, 'Automatisation & IA', 'Création d''un assistant IA personnalisé',    'Base de connaissances',                                            'Haute'),
(158, 'Automatisation & IA', 'Automatisation de la comptabilité',           'Export, Pennylane, comptable',                                     'Moyenne'),
(159, 'Automatisation & IA', 'Automatisation des avis voyageurs',           'Relance automatique',                                              'Haute'),
(160, 'Automatisation & IA', 'Chatbot / réponse IA aux voyageurs',          'Réponse 24/7 sans intervention',                                   'Haute');
