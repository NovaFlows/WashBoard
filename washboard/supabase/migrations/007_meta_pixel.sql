-- ════════════════════════════════════════════════════════════════════════════
-- Pixel Meta sur la page de réservation du laveur
-- ════════════════════════════════════════════════════════════════════════════
--
-- Le laveur colle l'identifiant de son Pixel dans ses réglages. WashBoard le
-- charge alors sur SA page de réservation, et lui seule — jamais sur la page
-- d'un autre laveur, jamais sur le tableau de bord.
--
-- ── Pourquoi une seule colonne, et rien d'autre ────────────────────────────
--
-- Le CONSENTEMENT n'est pas stocké ici. Il appartient au visiteur, pas au
-- laveur : il vit dans le navigateur de la personne qui visite, et nulle part
-- ailleurs. L'écrire en base supposerait de savoir QUI visite — c'est-à-dire
-- exactement la donnée personnelle qu'on cherche à ne pas collecter tant que
-- personne n'a rien accepté.
--
-- ── Ce que cette colonne déclenche ─────────────────────────────────────────
--
-- Renseignée, elle fait apparaître un bandeau de consentement sur la page du
-- laveur. Vide, il ne se passe rien : ni bandeau, ni script tiers, ni cookie.
-- C'est voulu — un bandeau coûte des réservations, et personne ne doit le
-- subir sans raison.

-- Identifiant de Pixel Meta : 15 ou 16 chiffres. Le format est vérifié ici ET
-- à la saisie : la base garde la dernière main, l'écran sait expliquer.
--
-- NULL (le défaut) = pas de Pixel. Distinct d'une chaîne vide, qui signifierait
-- « un Pixel dont l'identifiant est vide » — et ferait charger un script mort.
ALTER TABLE washers
  ADD COLUMN IF NOT EXISTS meta_pixel_id text
  CHECK (meta_pixel_id IS NULL OR meta_pixel_id ~ '^[0-9]{15,16}$');

COMMENT ON COLUMN washers.meta_pixel_id IS
  'Pixel Meta du laveur, chargé sur sa page de réservation APRÈS consentement du visiteur. NULL = aucun Pixel, donc aucun bandeau.';

-- ════════════════════════════════════════════════════════════════════════════
-- Retour arrière
-- ════════════════════════════════════════════════════════════════════════════
--
--   ALTER TABLE washers DROP COLUMN IF EXISTS meta_pixel_id;
--
-- Sans perte : la colonne ne contient qu'un identifiant public, que le laveur
-- retrouve dans son gestionnaire de publicités.
