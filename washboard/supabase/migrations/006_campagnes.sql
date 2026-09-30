-- ════════════════════════════════════════════════════════════════════════════
-- Suivi des campagnes publicitaires (Meta, Google Ads, TikTok Ads…)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Le laveur déclare sa campagne (nom, plateforme, budget, période) et colle le
-- lien généré dans sa publicité. WashBoard croise alors les visites et les
-- réservations arrivées par ce lien pour lui dire la seule chose qui
-- l'intéresse : est-ce que cette pub lui rapporte de l'argent.
--
-- Pourquoi `utm_campaign` est stocké SUR LA RÉSERVATION et pas seulement dans
-- les événements de visite :
--
--   1. Le chiffre d'affaires. Les événements de visite ne portent aucun prix ;
--      sans la colonne sur `bookings`, on saurait dire « 14 réservations »
--      mais jamais « 910 € » — c'est-à-dire justement le nombre qui permet de
--      juger une publicité.
--   2. La durée. `booking_funnel_events` est purgée à 13 mois (migration 003).
--      L'attribution d'une réservation, elle, doit survivre aussi longtemps
--      que la réservation.
--   3. La stabilité. L'origine est figée au moment de la réservation : elle ne
--      bouge plus, même si la campagne est renommée ou supprimée ensuite.
--
-- Le texte est libre plutôt qu'une clé étrangère vers `campagnes` pour cette
-- même raison : supprimer une campagne ne doit pas effacer l'origine des
-- réservations qu'elle a produites, ni les faire disparaître d'un bilan.

-- ── La campagne déclarée par le laveur ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS campagnes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id   uuid REFERENCES washers(id) ON DELETE CASCADE NOT NULL,
  nom         text NOT NULL,
  -- La plateforme ne change rien au calcul : elle sert à s'y retrouver quand
  -- on en a six, et à ne pas avoir à rouvrir la base le jour où le laveur
  -- lance du Google Ads.
  plateforme  text NOT NULL DEFAULT 'meta'
              CHECK (plateforme IN ('meta', 'google', 'tiktok', 'autre')),
  -- Budget DÉCLARÉ, en euros. WashBoard ne le vérifie auprès de personne :
  -- c'est le laveur qui le saisit, et les écrans doivent le dire.
  budget      numeric(10,2) NOT NULL CHECK (budget >= 0),
  -- Clé portée par le lien (?utm_campaign=...). Unique par laveur : deux
  -- campagnes qui partagent une clé mélangeraient leurs chiffres.
  cle         text NOT NULL,
  debut       date NOT NULL,
  -- `NULL` = campagne toujours en cours. Le laveur n'a pas toujours une date
  -- de fin en tête au moment où il la crée, et l'obliger à en inventer une
  -- fausserait tous ses bilans.
  fin         date,
  created_at  timestamptz DEFAULT now() NOT NULL,

  CHECK (fin IS NULL OR fin >= debut)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campagnes_washer_cle
  ON campagnes(washer_id, cle);

CREATE INDEX IF NOT EXISTS idx_campagnes_washer_debut
  ON campagnes(washer_id, debut DESC);

-- ── L'origine, des deux côtés de l'entonnoir ───────────────────────────────
ALTER TABLE booking_funnel_events ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE bookings              ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Index partiels : l'immense majorité des lignes n'a pas de campagne, et
-- indexer des NULL par millions ne sert personne.
CREATE INDEX IF NOT EXISTS idx_funnel_events_campagne
  ON booking_funnel_events(washer_id, utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_campagne
  ON bookings(washer_id, utm_campaign)
  WHERE utm_campaign IS NOT NULL;

-- ── Droits d'accès ─────────────────────────────────────────────────────────
-- Sans GRANT, la RLS ne s'applique jamais : la requête est refusée avant.
-- Oubli déjà constaté en production sur une autre table — on ne saute pas
-- cette étape.
GRANT SELECT, INSERT, UPDATE, DELETE ON campagnes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON campagnes TO service_role;

ALTER TABLE campagnes ENABLE ROW LEVEL SECURITY;

-- Un laveur ne voit et ne modifie que ses propres campagnes. `WITH CHECK` sur
-- l'insertion et la mise à jour, sinon on pourrait créer une campagne au nom
-- d'un autre, ou déplacer la sienne chez lui.
DROP POLICY IF EXISTS "campagnes: le laveur gère les siennes" ON campagnes;
CREATE POLICY "campagnes: le laveur gère les siennes" ON campagnes
  FOR ALL
  USING      (washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid()))
  WITH CHECK (washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid()));
