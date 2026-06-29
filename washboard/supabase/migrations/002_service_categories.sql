-- WashBoard — Migration : catégories de prestations
-- À exécuter dans Supabase SQL Editor
--
-- Permet au laveur de créer ses propres catégories (Voiture, Canapé, Maison...)
-- chacune avec ses propres "types" (ex. SUV/Citadine, ou 2 places/Angle).
-- Les types sont stockés en JSONB : [{ "id": "<uuid|cle>", "name": "SUV / 4x4" }]
-- Une prestation appartient à une catégorie ; ses vehicle_types / overrides
-- référencent les IDs de types de cette catégorie.

-- 1. Table des catégories
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  types jsonb DEFAULT '[]'::jsonb,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_washer_id ON service_categories(washer_id);

-- 2. Lien prestation -> catégorie
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL;

-- 3. Droits d'accès (GRANT) — requis pour que les rôles API atteignent la table
--    (les policies RLS ci-dessous filtrent ensuite les lignes).
GRANT SELECT ON service_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_categories TO authenticated;
GRANT ALL ON service_categories TO service_role;

-- 4. RLS
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des catégories" ON service_categories;
CREATE POLICY "Lecture publique des catégories" ON service_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Laveur gère ses catégories" ON service_categories;
CREATE POLICY "Laveur gère ses catégories" ON service_categories
  FOR ALL USING (
    washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid())
  );

-- 5. Seed rétro-compatibilité : une catégorie "Voiture" UNIQUEMENT pour les
--    laveurs qui ont DÉJÀ des prestations (celles-ci référencent des types
--    véhicules historiques qu'il faut rattacher). Les IDs réutilisent les clés
--    existantes pour que vehicle_types / overrides restent valides.
--    -> Aucune catégorie n'est imposée à un laveur sans prestation ni aux
--       nouveaux inscrits : ils créent librement leurs propres catégories.
INSERT INTO service_categories (washer_id, name, types, display_order)
SELECT
  w.id,
  'Voiture',
  '[
    {"id": "citadine_2p", "name": "Citadine 2p"},
    {"id": "citadine",    "name": "Citadine"},
    {"id": "berline",     "name": "Berline"},
    {"id": "SUV",         "name": "SUV / 4x4"},
    {"id": "monospace",   "name": "Monospace"},
    {"id": "7places",     "name": "7 places"},
    {"id": "utilitaire",  "name": "Van / Utilitaire"}
  ]'::jsonb,
  0
FROM washers w
WHERE EXISTS (
  SELECT 1 FROM services s WHERE s.washer_id = w.id
)
AND NOT EXISTS (
  SELECT 1 FROM service_categories sc WHERE sc.washer_id = w.id
);

-- 6. Rattacher les prestations existantes à la catégorie "Voiture" du laveur
UPDATE services s
SET category_id = sc.id
FROM service_categories sc
WHERE sc.washer_id = s.washer_id
  AND sc.name = 'Voiture'
  AND s.category_id IS NULL;
