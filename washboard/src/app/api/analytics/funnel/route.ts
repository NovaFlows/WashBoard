import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, cleanupRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Réception des événements d'entonnoir de la page de réservation publique.
// Anonyme par construction : aucune donnée qui identifie la personne (voir la
// migration 003). Non bloquant pour l'utilisateur si ça échoue : le formulaire
// de réservation continue de fonctionner même si le tracking casse.

const IP_LIMIT = 60          // événements max par IP (large : ~1 événement/étape/visite)
const IP_WINDOW_MS = 10 * 60 * 1000  // sur 10 minutes

const FunnelEventSchema = z.object({
  washer_id:     z.string().uuid(),
  session_id:    z.string().uuid(),
  step:          z.enum(['prestation', 'options', 'creneau', 'coordonnees', 'confirmation']),
  referrer_host: z.string().max(255).optional(),
  device:        z.enum(['mobile', 'tablet', 'desktop']).optional(),
})

export async function POST(req: Request) {
  cleanupRateLimit()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const rl = rateLimit(`funnel:${ip}`, IP_LIMIT, IP_WINDOW_MS)
  if (!rl.ok) {
    // Silencieux côté client : ce n'est que du tracking, pas une action utilisateur.
    return new Response(null, { status: 204 })
  }

  let parsed
  try {
    parsed = FunnelEventSchema.safeParse(await req.json())
  } catch {
    return new Response(null, { status: 204 })
  }
  if (!parsed.success) return new Response(null, { status: 204 })

  const admin = createAdminClient()
  const { error } = await admin.from('booking_funnel_events').insert(parsed.data)

  // On log sans jamais faire échouer la requête côté client : un raté de
  // tracking ne doit pas se voir sur la page de réservation.
  if (error) logger.warn('analytics.funnel.insert_failed', { washerId: parsed.data.washer_id, step: parsed.data.step }, error)

  return new Response(null, { status: 204 })
}
