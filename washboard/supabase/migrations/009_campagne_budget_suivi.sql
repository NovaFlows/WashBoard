-- ════════════════════════════════════════════════════════════════════════════
-- Savoir DEPUIS QUAND le budget déclaré n'a pas bougé
-- ════════════════════════════════════════════════════════════════════════════
--
-- Le budget d'une campagne est saisi à la main : WashBoard ne le récupère pas
-- auprès de Meta. Sur une campagne de deux semaines, ça ne pose pas de
-- problème. Sur une campagne sans date de fin — le cas le plus courant chez les
-- laveurs, qui laissent tourner une publicité des mois — le chiffre vieillit.
--
-- Et un budget qui vieillit ne rend pas l'écran « un peu moins précis » : il le
-- rend FAUX dans le sens le plus dangereux. Les réservations, elles, continuent
-- d'arriver et de s'additionner. Le retour affiché monte donc tout seul, mois
-- après mois, pendant que la dépense réelle reste figée à sa valeur du premier
-- jour. Le laveur lit « × 8 » sur une campagne qui lui en rapporte peut-être 2,
-- et il remet de l'argent dessus.
--
-- Cette colonne ne corrige pas le budget — personne ne peut le faire à la place
-- du laveur. Elle permet seulement à l'écran de dire « ce montant date de 47
-- jours », ce qui suffit à ne plus se faire piéger.

ALTER TABLE campagnes ADD COLUMN IF NOT EXISTS budget_maj_le timestamptz;

-- Les campagnes existantes prennent leur date de création : c'est bien à ce
-- moment-là que leur budget a été saisi pour la dernière fois.
UPDATE campagnes SET budget_maj_le = created_at WHERE budget_maj_le IS NULL;

-- ── Retour en arrière ──────────────────────────────────────────────────────
-- ALTER TABLE campagnes DROP COLUMN IF EXISTS budget_maj_le;
