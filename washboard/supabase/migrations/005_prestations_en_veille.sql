-- Mise en veille d'une prestation.
--
-- Pourquoi : le plafond de catalogue de l'offre Découverte (3 prestations) ne
-- bloquait que la CRÉATION. Un laveur qui arrivait sur cette offre avec 4
-- prestations les gardait toutes les quatre visibles — le plafond ne servait
-- donc à rien pour un compte existant, c'est-à-dire pour tout le monde.
--
-- Plutôt que d'en effacer une (ce qui casserait les réservations qui la
-- référencent, leurs factures et l'historique du client), le laveur CHOISIT
-- celles qu'il garde en ligne. Les autres passent en veille : invisibles pour
-- ses clients, intactes en base, réactivables le jour où il change d'offre.
--
-- À EXÉCUTER AVANT de déployer le code : les pages lisent cette colonne, et
-- une requête qui la demande sur une table qui ne l'a pas échoue.

alter table services
  add column if not exists en_veille boolean not null default false;

-- Le catalogue public ne lit que les prestations actives, à chaque visite de
-- chaque page de réservation : c'est la lecture la plus fréquente du produit.
create index if not exists services_washer_actives
  on services (washer_id) where en_veille = false;

-- Vérification après exécution (aucune ligne en veille au départ, c'est normal) :
--   select en_veille, count(*) from services group by en_veille;
