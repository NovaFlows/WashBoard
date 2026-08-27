-- WashBoard — Migration : entonnoir de la page de réservation publique
-- À exécuter dans Supabase SQL Editor
--
-- Objectif : savoir à quelle étape du formulaire de réservation (book/[slug])
-- les visiteurs décrochent, pour le laveur. Mesure d'audience anonyme :
-- pas de nom/email/téléphone, session_id généré côté client et limité à
-- l'onglet du navigateur (sessionStorage, pas un cookie persistant) — reste
-- dans le cadre de l'exemption CNIL « mesure d'audience », donc pas besoin
-- de bandeau cookies pour cette table.
--
-- Écriture : uniquement via la route POST /api/analytics/funnel, avec le
-- client service-role (l'anon n'a aucun droit sur cette table : les visiteurs
-- ne parlent jamais directement à Supabase).
-- Lecture : le laveur, pour ses propres événements, via RLS.

CREATE TABLE IF NOT EXISTS booking_funnel_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id     uuid REFERENCES washers(id) ON DELETE CASCADE NOT NULL,
  session_id    uuid NOT NULL,
  step          text NOT NULL CHECK (step IN ('prestation', 'options', 'creneau', 'coordonnees', 'confirmation')),
  referrer_host text,
  device        text CHECK (device IN ('mobile', 'tablet', 'desktop')),
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_funnel_events_washer_id_created_at
  ON booking_funnel_events(washer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_booking_funnel_events_washer_id_session_id
  ON booking_funnel_events(washer_id, session_id);

-- Droits d'accès (GRANT) — requis pour que les rôles API atteignent la table
-- (les policies RLS ci-dessous filtrent ensuite les lignes). Voir le TODO du
-- 2026-08-26 : un GRANT SELECT manquant pour service_role a déjà causé un bug
-- silencieux en prod sur une autre table — on ne saute pas cette étape.
GRANT INSERT ON booking_funnel_events TO service_role;
GRANT SELECT ON booking_funnel_events TO service_role;
GRANT SELECT ON booking_funnel_events TO authenticated;
-- Pas de GRANT à anon : les visiteurs publics ne touchent jamais Supabase
-- directement pour cette table, uniquement via la route API (service-role).

ALTER TABLE booking_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Laveur lit ses propres evenements d'entonnoir" ON booking_funnel_events;
CREATE POLICY "Laveur lit ses propres evenements d'entonnoir" ON booking_funnel_events
  FOR SELECT USING (
    washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid())
  );

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated/anon : RLS activée
-- sans policy = accès refusé par défaut pour ces rôles. Seul service_role
-- (qui contourne RLS) peut écrire, et seulement via la route API dédiée.

-- Purge automatique : ces événements n'ont de valeur que récente (analyse de
-- l'entonnoir des dernières semaines), pas d'intérêt à les garder indéfiniment
-- ni de raison RGPD de le faire. À rattacher au même mécanisme que la purge
-- RGPD existante (voir /api/cron/purge-accounts) plutôt qu'un cron séparé —
-- suggestion : supprimer les lignes de plus de 13 mois (recommandation CNIL
-- pour les données de mesure d'audience), TODO à part si on veut l'automatiser.
