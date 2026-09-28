-- Grille tarifaire 2026 : passage de 2 offres à 4.
--
--   avant : essentiel (49 €), pro (69 €)
--   après : decouverte (0 €), starter (19 €), pro (49 €), business (129 €)
--
-- À EXÉCUTER AU MOMENT DU DÉPLOIEMENT, pas après. Tant que cette migration n'a
-- pas tourné, les comptes portent encore « essentiel » : le code sait le lire
-- (PLAN_ALIASES dans src/lib/plan.ts le fait remonter sur Pro, au même tarif),
-- donc rien ne casse — mais un compte à plusieurs laveurs perdrait le
-- multi-laveurs, qui appartient désormais au Business.
--
-- Principe de la reprise : PERSONNE ne perd un acquis.
--   - « essentiel » (49 €) → « pro » (49 €) : même prix, plus de fonctions.
--   - un compte à plusieurs laveurs → « business » : c'est la seule offre qui
--     ouvre le multi-laveurs, et il s'en sert déjà.
--   - le tarif réellement facturé n'est pas touché ici : les abonnements
--     Stripe en cours gardent leur prix jusqu'à ce qu'on les change à la main,
--     et les paiements PayPal sont manuels de toute façon.

begin;

-- 1. Les comptes qui utilisent RÉELLEMENT plusieurs laveurs passent au
--    Business. À faire EN PREMIER : après l'étape 2, on ne saurait plus
--    distinguer un ancien Pro à 69 € d'un nouveau Pro à 49 €.
update washers
   set plan = 'business'
 where coalesce(team_size, 1) > 1
   and coalesce(plan, '') in ('essentiel', 'pro');

-- 2. Tout le reste de l'existant atterrit sur Pro : c'est ce que ces comptes
--    avaient (essentiel à 49 €, ou pro à 69 €), au même prix ou moins cher.
--    Les comptes sans plan renseigné en font partie : ils tournaient jusqu'ici
--    sur la valeur par défaut de la colonne, c'est-à-dire l'ancien Essentiel.
update washers
   set plan = 'pro'
 where plan is null
    or plan in ('essentiel', 'pro');

-- 3. Les nouveaux comptes démarrent sur l'offre gratuite. L'essai de 30 jours
--    reste posé explicitement à l'inscription (PLAN_ESSAI, route signup) :
--    cette valeur par défaut n'est qu'un filet.
alter table washers alter column plan set default 'decouverte';

-- 4. Verrou : une chaîne hors grille arrivant en base rendrait le compte
--    illisible côté code, qui retomberait alors sur l'offre gratuite — le
--    laveur perdrait tout sans que rien ne le signale.
alter table washers drop constraint if exists washers_plan_check;
alter table washers add  constraint washers_plan_check
  check (plan in ('decouverte', 'starter', 'pro', 'business'));

commit;

-- Vérification après exécution (aucune ligne attendue) :
--   select id, name, plan, team_size from washers
--    where plan not in ('decouverte', 'starter', 'pro', 'business');
--
-- Répartition obtenue :
--   select plan, count(*) from washers group by plan order by plan;
