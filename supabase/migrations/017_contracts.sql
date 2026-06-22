-- =============================================================================
-- Migration 017 — Contrats de location
-- =============================================================================

-- ── Table : contract_templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  country    text        DEFAULT 'MA',
  content_fr text        NOT NULL,
  content_en text,
  is_active  boolean     DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth can manage contract_templates" ON contract_templates;
CREATE POLICY "Auth can manage contract_templates"
  ON contract_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Colonnes reservations ─────────────────────────────────────────────────────
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_template_id    uuid REFERENCES contract_templates(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_generated_at   timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_signed_at      timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_signed_ip      text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_pdf_url        text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contract_signature_image text;

-- ── INSERT : Contrat Alma Keys Maroc ─────────────────────────────────────────
INSERT INTO contract_templates (name, country, content_fr, content_en) VALUES (
'Contrat Location Courte Durée — Alma Keys Maroc',
'MA',
'1. OBJET DU CONTRAT
Le Bailleur met à disposition du Locataire un logement meublé à usage d''habitation temporaire pour la durée indiquée dans la réservation. La présente location ne constitue pas la résidence principale du Locataire.

2. CONDITIONS DE LOCATION
La réservation est conclue pour la période indiquée lors de la réservation et ne peut être prolongée qu''avec l''accord écrit du Bailleur. Le Locataire s''engage à quitter les lieux à l''heure prévue et à restituer les clés et équipements mis à disposition.

3. CAUTION (AIRBNB NON CONCERNÉ)
Pour les réservations hors Airbnb, une préautorisation bancaire pourra être réalisée afin de garantir les obligations du Locataire. La caution pourra couvrir les dommages, pertes, pénalités, frais de ménage exceptionnels et toute somme due au Bailleur.

4. OCCUPANTS ET IDENTIFICATION DES VOYAGEURS
Seules les personnes déclarées lors de la réservation sont autorisées à séjourner dans le logement. Tous les voyageurs doivent fournir une pièce d''identité valide avant ou lors de leur arrivée.

5. RESPECT DE LA LÉGISLATION MAROCAINE
Conformément à l''article 490 du Code pénal marocain et aux réglementations applicables, les couples dont au moins une personne est de nationalité marocaine doivent être en mesure de présenter un certificat de mariage valide lorsqu''il est requis. Aucun remboursement ne sera dû en cas de refus d''accès résultant du non-respect de cette obligation.

6. UTILISATION DU LOGEMENT
Le logement est destiné exclusivement à un usage d''habitation temporaire. Le Locataire s''engage à respecter le voisinage et le règlement intérieur.

7. FÊTES, RASSEMBLEMENTS ET VISITEURS
Les fêtes, rassemblements bruyants et visiteurs non autorisés sont interdits. Toute violation pourra entraîner une pénalité de 3 000 MAD et la résiliation immédiate du séjour sans remboursement.

8. TABAC, DROGUES ET ANIMAUX
Il est interdit de fumer à l''intérieur du logement, de consommer des substances illicites ou d''introduire des animaux sans autorisation préalable. Pénalité : 2 500 MAD.

9. CLIMATISATION ET CONSOMMATION D''ÉNERGIE
Le Locataire s''engage à utiliser la climatisation de manière raisonnable. Toute surconsommation ou dégradation résultant d''un usage abusif pourra être facturée.

10. DÉGRADATIONS ET RESPONSABILITÉ
Le Locataire est responsable des dommages causés par lui-même ou ses invités. Les réparations seront facturées au coût réel.

11. EFFETS PERSONNELS
Le Bailleur décline toute responsabilité en cas de perte, vol ou détérioration des biens personnels.

12. INTERNET
Toute utilisation illégale de l''accès Internet engage la seule responsabilité du Locataire.

13. FORCE MAJEURE ET SERVICES EXTÉRIEURS
Le Bailleur ne pourra être tenu responsable des coupures ou dysfonctionnements indépendants de sa volonté (eau, électricité, internet, ascenseur, services publics ou fournisseurs).

14. DESCRIPTION DU LOGEMENT
Les photographies et descriptifs sont fournis à titre indicatif. Les différences mineures ne pourront justifier un remboursement.

15. CHECK-OUT TARDIF
Tout retard sera facturé 100 MAD par tranche de 30 minutes entamée.

16. RÉSILIATION IMMÉDIATE
Le Bailleur pourra mettre fin immédiatement au séjour sans remboursement en cas de violation du présent contrat.

17. RESPONSABILITÉ PERSONNELLE DES OCCUPANTS
Le Bailleur, le Gestionnaire de propriété, leurs représentants, employés ou prestataires ne pourront être tenus responsables des blessures, accidents, overdoses, intoxications, agressions, violences, bagarres, vols, suicides, tentatives de suicide, décès, actes criminels, infractions à la loi ou de tout autre dommage corporel, matériel ou immatériel résultant directement ou indirectement des actes, comportements, négligences ou omissions des occupants ou de leurs visiteurs. Chaque occupant demeure seul responsable civilement, pénalement et financièrement de ses actes ainsi que des conséquences qui en découlent.

18. VIDÉOSURVEILLANCE DES PARTIES COMMUNES
Certaines parties communes peuvent être placées sous vidéosurveillance. L''intérieur du logement n''est jamais filmé.

19. OBJETS OUBLIÉS
Les objets oubliés pourront être conservés pendant 30 jours. Leur réexpédition éventuelle sera réalisée aux frais du Locataire.

20. ACCÈS AU LOGEMENT EN CAS D''URGENCE
Le Bailleur pourra accéder au logement sans préavis en cas d''urgence, de risque pour les personnes ou les biens ou de suspicion d''activité illégale.

21. PREUVE ÉLECTRONIQUE ET COMMUNICATIONS
Les échanges par e-mail, WhatsApp, SMS, Airbnb ou Booking pourront être produits comme preuve en cas de litige.

22. DROIT APPLICABLE
Le présent contrat est soumis au droit marocain. Les juridictions marocaines sont seules compétentes.

23. LANGUE DU CONTRAT
En cas de divergence d''interprétation, la version française prévaudra.',

'1. PURPOSE OF THE AGREEMENT
The Lessor makes available to the Tenant a furnished accommodation for temporary residential use for the duration specified in the reservation. This rental shall not constitute the Tenant primary residence.

2. RENTAL CONDITIONS
The reservation is concluded for the booked period and may only be extended with the written consent of the Lessor. The Tenant agrees to vacate the premises on time and return all keys and equipment.

3. SECURITY DEPOSIT (AIRBNB NOT CONCERNED)
For reservations made outside Airbnb, a credit card pre-authorization may be placed to secure the Tenant obligations. The deposit may cover damages, losses, penalties, exceptional cleaning costs and any amount owed to the Lessor.

4. OCCUPANTS AND GUEST IDENTIFICATION
Only guests declared at the time of booking are authorized to stay in the accommodation. All guests must provide valid identification before or upon arrival.

5. COMPLIANCE WITH MOROCCAN LAW
In accordance with Article 490 of the Moroccan Penal Code and applicable regulations, couples where at least one person is Moroccan must be able to provide a valid marriage certificate when required. No refund shall be due if access is denied due to non-compliance.

6. USE OF THE PROPERTY
The accommodation is intended exclusively for temporary residential use. The Tenant agrees to respect neighbors and comply with house rules.

7. PARTIES, GATHERINGS AND VISITORS
Parties, noisy gatherings and unauthorized visitors are prohibited. Any violation may result in a MAD 3,000 penalty and immediate termination of the stay without refund.

8. SMOKING, DRUGS AND PETS
Smoking indoors, consuming illegal substances or bringing pets without prior approval is prohibited. Penalty: MAD 2,500.

9. AIR CONDITIONING AND ENERGY CONSUMPTION
The Tenant agrees to use air conditioning responsibly. Any excessive consumption or damage resulting from misuse may be charged.

10. DAMAGES AND LIABILITY
The Tenant is responsible for damages caused by themselves or their guests. Repairs will be charged at actual cost.

11. PERSONAL BELONGINGS
The Lessor shall not be liable for loss, theft or damage to personal belongings.

12. INTERNET
Any unlawful use of the Internet connection shall be the sole responsibility of the Tenant.

13. FORCE MAJEURE AND EXTERNAL SERVICES
The Lessor shall not be held liable for interruptions beyond its control (water, electricity, internet, elevators, public services or utility providers).

14. PROPERTY DESCRIPTION
Photographs and descriptions are provided for informational purposes only. Minor differences shall not justify a refund.

15. LATE CHECK-OUT
Any delay shall be charged MAD 100 per commenced 30-minute period.

16. IMMEDIATE TERMINATION
The Lessor may immediately terminate the stay without refund in case of breach of this agreement.

17. PERSONAL RESPONSIBILITY OF OCCUPANTS
The Lessor, Property Manager, their representatives, employees or service providers shall not be held liable for any injuries, accidents, overdoses, intoxications, assaults, violence, fights, thefts, suicides, suicide attempts, deaths, criminal acts, violations of law, or any other bodily, material or non-material damages resulting directly or indirectly from the actions, conduct, negligence or omissions of occupants or their visitors. Each occupant shall remain solely civilly, criminally and financially responsible for their own actions and the consequences arising therefrom.

18. CCTV IN COMMON AREAS
Certain common areas may be monitored by CCTV. The interior of the accommodation is never recorded.

19. FORGOTTEN ITEMS
Forgotten items may be kept for 30 days. Any reshipment shall be at the Tenant expense.

20. EMERGENCY ACCESS TO THE PROPERTY
The Lessor may access the accommodation without notice in case of emergency, risk to persons or property, or suspected illegal activity.

21. ELECTRONIC EVIDENCE AND COMMUNICATIONS
Communications via email, WhatsApp, SMS, Airbnb or Booking may be produced as evidence in case of dispute.

22. GOVERNING LAW
This agreement shall be governed by Moroccan law. Moroccan courts shall have exclusive jurisdiction.

23. LANGUAGE OF THE AGREEMENT
In case of discrepancy, the French version shall prevail.'
) ON CONFLICT DO NOTHING;
