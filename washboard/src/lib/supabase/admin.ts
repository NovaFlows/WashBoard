import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase à privilèges élevés (service_role) — contourne les RLS.
 *
 * Réservé aux lectures/écritures serveur qui doivent voir au-delà de ce
 * qu'un visiteur anonyme ou un laveur connecté peuvent voir via RLS. Cas
 * type : calculer la disponibilité ou les frais de déplacement sur la page
 * de réservation publique, qui doit lire les RDV existants d'un laveur alors
 * que le visiteur, lui, n'a aucun droit de lecture sur `bookings` (seule la
 * création y est publique — voir schema.sql).
 *
 * Ne jamais renvoyer son résultat brut à un client : ce contournement de RLS
 * n'est légitime que pour des calculs dérivés (créneaux, frais), jamais pour
 * exposer des données de réservation d'un tiers.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      // Côté serveur, il n'y a ni stockage de session à alimenter ni jeton à
      // rafraîchir : chaque requête crée son client et le jette. Ces deux
      // réglages venaient des routes d'upload (logo, fond), qui recréaient
      // leur propre client admin — ils sont remontés ici pour que tous les
      // appels en bénéficient.
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}
