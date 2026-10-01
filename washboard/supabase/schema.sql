-- WashBoard — Schema V1
-- À exécuter dans Supabase SQL Editor
--
-- ⚠ CE FICHIER N'EST PAS LE SCHÉMA EN PRODUCTION. C'est l'état du premier jour,
-- gardé pour repartir de zéro. La base vivante a beaucoup dérivé depuis : la
-- table `washers` porte aujourd'hui une soixantaine de colonnes (facturation,
-- abonnement Stripe, apparence, relances…) et d'autres tables existent qui ne
-- figurent pas ici. Ne JAMAIS conclure qu'une colonne ou un trigger n'existe
-- pas parce qu'il est absent de ce fichier — le 2026-09-25, en avoir déduit que
-- `washers.updated_at` n'était pas maintenu a produit un diagnostic faux sur un
-- client. Pour connaître la vraie structure : Supabase Studio, ou un
-- `select * ... limit 1` sur la table.
--
-- Les évolutions appliquées après coup sont notées en fin de fichier.

-- Table des laveurs
CREATE TABLE washers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  phone text,
  logo_url text,
  zone_config jsonb DEFAULT '{}',
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des prestations
CREATE TABLE services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  duration_minutes int NOT NULL,
  vehicle_types text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Table des disponibilités
CREATE TABLE availabilities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL
);

-- Table des réservations
CREATE TABLE bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES services(id) NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  address text NOT NULL,
  lat numeric,
  lng numeric,
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'done')),
  created_at timestamptz DEFAULT now()
);

-- Index pour les queries fréquentes
CREATE INDEX idx_services_washer_id ON services(washer_id);
CREATE INDEX idx_availabilities_washer_id ON availabilities(washer_id);
CREATE INDEX idx_bookings_washer_id ON bookings(washer_id);
CREATE INDEX idx_bookings_scheduled_at ON bookings(scheduled_at);
CREATE INDEX idx_washers_slug ON washers(slug);

-- RLS : activer sur toutes les tables
ALTER TABLE washers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policies washers
CREATE POLICY "Laveur voit son propre profil" ON washers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Laveur modifie son propre profil" ON washers
  FOR UPDATE USING (auth.uid() = user_id);

-- Lecture publique du profil laveur (pour la page de réservation)
CREATE POLICY "Lecture publique par slug" ON washers
  FOR SELECT USING (true);

-- Policies services
CREATE POLICY "Lecture publique des services" ON services
  FOR SELECT USING (true);

CREATE POLICY "Laveur gère ses services" ON services
  FOR ALL USING (
    washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid())
  );

-- Policies availabilities
CREATE POLICY "Lecture publique des disponibilités" ON availabilities
  FOR SELECT USING (true);

CREATE POLICY "Laveur gère ses disponibilités" ON availabilities
  FOR ALL USING (
    washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid())
  );

-- Policies bookings
CREATE POLICY "Création publique de réservation" ON bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Laveur voit ses réservations" ON bookings
  FOR SELECT USING (
    washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid())
  );

CREATE POLICY "Laveur modifie ses réservations" ON bookings
  FOR UPDATE USING (
    washer_id IN (SELECT id FROM washers WHERE user_id = auth.uid())
  );

-- Données de test (Kooki Clean)
INSERT INTO washers (name, slug, phone) VALUES ('Kooki Clean', 'kookiclean', '0600000000');

INSERT INTO services (washer_id, name, price, duration_minutes, vehicle_types)
SELECT id, 'Lavage extérieur', 30, 45, ARRAY['citadine', 'berline', 'SUV']
FROM washers WHERE slug = 'kookiclean';

INSERT INTO services (washer_id, name, price, duration_minutes, vehicle_types)
SELECT id, 'Lavage complet', 60, 90, ARRAY['citadine', 'berline', 'SUV']
FROM washers WHERE slug = 'kookiclean';

INSERT INTO availabilities (washer_id, day_of_week, start_time, end_time)
SELECT id, d, '08:00', '18:00'
FROM washers, generate_series(1, 5) AS d
WHERE slug = 'kookiclean';

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉVOLUTIONS APPLIQUÉES APRÈS LA V1
-- Seule cette section est à jour. Le reste du fichier est l'état du premier
-- jour (voir l'avertissement en tête).
-- ═══════════════════════════════════════════════════════════════════════════

-- 2026-09-25 — Savoir quand un laveur a modifié SON compte
--
-- Le problème : `washers.updated_at` est réécrit à chaque UPDATE de la ligne, y
-- compris par le cron des relances d'essai (`trial_reminder_sent_at`), par le
-- webhook Stripe (`subscription_status`, `plan`…) et par la purge des comptes.
-- Une fiche « modifiée hier » ne devait donc rien au laveur, et la colonne ne
-- pouvait pas servir au suivi client. Elle reste utile pour le débogage : elle
-- date la dernière écriture, quelle qu'en soit l'origine.
--
-- La solution : une colonne écrite UNIQUEMENT par les routes que le laveur
-- utilise lui-même (PATCH /api/washer, envoi du logo, choix du fond). Aucun
-- trigger dessus, sinon le cron la ferait bouger comme `updated_at`.
--
-- NULL = jamais modifié depuis la mise en place (ou avant le 2026-09-25) ;
-- on ne réécrit pas l'histoire avec une date inventée.
ALTER TABLE washers ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz;

COMMENT ON COLUMN washers.profile_updated_at IS
  'Dernière modification faite PAR LE LAVEUR dans ses réglages. Posée par le code applicatif, jamais par un trigger ni par le cron. NULL = aucune depuis 2026-09-25.';
COMMENT ON COLUMN washers.updated_at IS
  'Dernière écriture sur la ligne, TOUTES origines confondues (cron, webhook Stripe, purge). Ne pas lire comme une action du laveur : voir profile_updated_at.';

-- 2026-09-25 — Dater l'ajout d'un créneau hebdomadaire
--
-- `availabilities` n'avait aucune date : impossible de dire si un laveur avait
-- touché à ses horaires. En deux temps VOLONTAIREMENT : un ADD COLUMN avec
-- DEFAULT aurait horodaté toutes les lignes existantes à l'instant de la
-- migration, faisant passer des créneaux vieux de trois semaines pour des
-- ajouts du jour. Les anciennes lignes restent donc NULL = « date inconnue ».
ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE availabilities ALTER COLUMN created_at SET DEFAULT now();

COMMENT ON COLUMN availabilities.created_at IS
  'Ajout du créneau. NULL = créneau antérieur au 2026-09-25, date inconnue. La suppression d''un créneau ne laisse aucune trace (pas de table d''audit).';

-- Pas de GRANT à ajouter ici : ce sont des colonnes sur des tables existantes,
-- les droits sont accordés au niveau de la table et couvrent les nouvelles
-- colonnes. Un GRANT explicite reste obligatoire pour toute NOUVELLE table.
