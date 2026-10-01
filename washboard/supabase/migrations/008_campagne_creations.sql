-- ════════════════════════════════════════════════════════════════════════════
-- Les créations d'une campagne : une ligne par vidéo (ou image) diffusée
-- ════════════════════════════════════════════════════════════════════════════
--
-- La migration 006 sait répondre à « est-ce que cette campagne me rapporte ? ».
-- Elle ne sait pas répondre à la question suivante, qui est celle que le laveur
-- se pose vraiment le lendemain : « LAQUELLE de mes trois vidéos marche ? ».
--
-- Sans cette table, un laveur qui diffuse quatre vidéos sous une même campagne
-- lit un seul chiffre moyen. Ce chiffre lui dit de couper la campagne entière
-- alors qu'une des quatre vidéos est peut-être rentable — et il coupe la bonne
-- avec les mauvaises. C'est le genre de moyenne qui coûte de l'argent.
--
-- Le mécanisme est celui de la campagne, d'un cran plus fin : chaque création
-- reçoit sa propre clé, portée par `utm_content` dans le lien. Le laveur colle
-- le lien de la vidéo 1 sous la vidéo 1. Rien à configurer chez Meta.

-- ── Prérequis : pouvoir référencer (campagne, laveur) d'un bloc ─────────────
-- Une création appartient à une campagne ET à un laveur. Déclarer les deux
-- colonnes séparément laisserait exister une création rattachée à la campagne
-- d'un autre — le genre de ligne qui ne se voit pas avant d'avoir fait fuiter
-- les chiffres d'un laveur chez son concurrent.
--
-- La clé étrangère composite ci-dessous rend ça impossible au niveau de la
-- base, pas au niveau du code. Elle exige cette unicité, redondante avec la
-- clé primaire, et c'est son seul rôle.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campagnes_id_washer_id_key' AND conrelid = 'campagnes'::regclass
  ) THEN
    ALTER TABLE campagnes ADD CONSTRAINT campagnes_id_washer_id_key UNIQUE (id, washer_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS campagne_creations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id uuid NOT NULL,
  washer_id   uuid NOT NULL,
  -- Ce que le laveur reconnaît : « Avant/après Clio », « Témoignage Marie ».
  -- Jamais un identifiant Meta : il ne l'a pas sous les yeux, et le lui
  -- demander ferait abandonner la saisie.
  nom         text NOT NULL CHECK (length(btrim(nom)) > 0),
  -- Le format sert à LIRE la liste, pas à calculer : « 3 vidéos, 1 image » se
  -- comprend d'un coup d'œil, là où trois noms doivent être déchiffrés.
  format      text NOT NULL DEFAULT 'video'
              CHECK (format IN ('video', 'image', 'carrousel', 'autre')),
  -- Clé portée par le lien (?utm_content=...).
  cle         text NOT NULL CHECK (cle ~ '^[a-z0-9-]{1,40}$'),
  -- Budget de CETTE création, si le laveur le connaît. Facultatif, et c'est
  -- volontaire : Meta répartit souvent le budget tout seul entre les
  -- publicités, et le laveur n'a alors aucun montant par vidéo à saisir.
  -- Mieux vaut un coût par client absent qu'un coût par client inventé.
  budget      numeric(10,2) CHECK (budget IS NULL OR budget >= 0),
  created_at  timestamptz DEFAULT now() NOT NULL,

  FOREIGN KEY (campagne_id, washer_id)
    REFERENCES campagnes(id, washer_id) ON DELETE CASCADE
);

-- Deux créations d'une même campagne ne peuvent pas partager une clé : leurs
-- visites et leurs réservations se mélangeraient, et le laveur comparerait des
-- vidéos à des chiffres qui ne sont pas les leurs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_creations_campagne_cle
  ON campagne_creations(campagne_id, cle);

CREATE INDEX IF NOT EXISTS idx_creations_washer
  ON campagne_creations(washer_id, created_at);

-- ── L'origine fine, des deux côtés de l'entonnoir ──────────────────────────
-- Même raisonnement que pour `utm_campaign` en 006 : la colonne existe aussi
-- sur `bookings` parce que les événements de visite ne portent aucun prix, sont
-- purgés à 13 mois, et parce que l'origine d'une réservation doit rester figée
-- même si la création est renommée ou supprimée ensuite.
ALTER TABLE booking_funnel_events ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE bookings              ADD COLUMN IF NOT EXISTS utm_content text;

-- Index partiels : la quasi-totalité des lignes n'a pas de création.
CREATE INDEX IF NOT EXISTS idx_funnel_events_creation
  ON booking_funnel_events(washer_id, utm_campaign, utm_content)
  WHERE utm_content IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_creation
  ON bookings(washer_id, utm_campaign, utm_content)
  WHERE utm_content IS NOT NULL;

-- ── Droits d'accès ─────────────────────────────────────────────────────────
-- Sans GRANT, la RLS ne s'applique jamais : la requête est refusée avant.
GRANT SELECT, INSERT, UPDATE, DELETE ON campagne_creations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON campagne_creations TO service_role;

ALTER TABLE campagne_creations ENABLE ROW LEVEL SECURITY;

-- `WITH CHECK` autant que `USING` : sans lui, on pourrait créer une création au
-- nom d'un autre laveur, ou déplacer la sienne chez lui.
DROP POLICY IF EXISTS "creations: le laveur gère les siennes" ON campagne_creations;
CREATE POLICY "creations: le laveur gère les siennes" ON campagne_creations
  FOR ALL
  USING      (washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid()))
  WITH CHECK (washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid()));

-- ── Retour en arrière ──────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS campagne_creations;
-- ALTER TABLE campagnes DROP CONSTRAINT IF EXISTS campagnes_id_washer_id_key;
-- ALTER TABLE booking_funnel_events DROP COLUMN IF EXISTS utm_content;
-- ALTER TABLE bookings              DROP COLUMN IF EXISTS utm_content;
