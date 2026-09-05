import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Réception des événements d'entonnoir de la page de réservation publique.
// Anonyme par construction : aucune donnée qui identifie la personne (voir la
// migration 003). Non bloquant pour l'utilisateur si ça échoue : le formulaire
// de réservation continue de fonctionner même si le tracking casse.

// La limite porte sur la SESSION, pas sur l'adresse IP.
//
// Pourquoi : les opérateurs mobiles partagent une même adresse publique entre
// des milliers d'abonnés (CGNAT), et les navigateurs intégrés de TikTok ou
// Instagram passent eux aussi par des infrastructures mutualisées. Un plafond
// par IP revenait donc à plafonner tout un opérateur.
//
// Constaté en production le 2026-09-04 : une vidéo TikTok virale a amené un
// pic de visiteurs, les 60 événements autorisés ont été consommés en quelques
// secondes, et tout le reste a été rejeté en silence. L'effet était pervers :
// les événements « prestation » partent dès l'ouverture de la page et
// mangeaient le quota, tandis que les « confirmation », émis plusieurs minutes
// plus tard, tombaient dans une fenêtre déjà saturée. Le laveur a vu
// « 2 réservations » pour 7 ou 8 réelles, et un taux de conversion effondré.
//
// Une session ne peut franchir que 5 étapes ; 30 laisse la place aux
// allers-retours entre étapes sans jamais brider un parcours normal.
const SESSION_LIMIT = 30
const SESSION_WINDOW_MS = 30 * 60 * 1000

// Garde-fou d'abus conservé sur l'IP, mais assez haut pour ne jamais toucher
// un opérateur mobile : il ne vise qu'un envoi automatisé massif.
const IP_LIMIT = 5_000
const IP_WINDOW_MS = 10 * 60 * 1000

const FunnelEventSchema = z.object({
  washer_id:     z.string().uuid(),
  session_id:    z.string().uuid(),
  step:          z.enum(['prestation', 'options', 'creneau', 'coordonnees', 'confirmation']),
  referrer_host: z.string().max(255).optional(),
  device:        z.enum(['mobile', 'tablet', 'desktop']).optional(),
})

export async function POST(req: Request) {
  cleanupRateLimit()
  const ip = clientIp(req)
  if (!rateLimit(`funnel-ip:${ip}`, IP_LIMIT, IP_WINDOW_MS).ok) {
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

  // Le plafond par session est appliqué APRÈS validation : il faut d'abord
  // connaître la session, et un corps invalide ne doit pas consommer le quota
  // d'un visiteur légitime.
  if (!rateLimit(`funnel-sid:${parsed.data.session_id}`, SESSION_LIMIT, SESSION_WINDOW_MS).ok) {
    return new Response(null, { status: 204 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('booking_funnel_events').insert(parsed.data)

  // On log sans jamais faire échouer la requête côté client : un raté de
  // tracking ne doit pas se voir sur la page de réservation.
  if (error) logger.warn('analytics.funnel.insert_failed', { washerId: parsed.data.washer_id, step: parsed.data.step }, error)

  return new Response(null, { status: 204 })
}
