-- WashBoard — Schema V1
-- À exécuter dans Supabase SQL Editor

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
