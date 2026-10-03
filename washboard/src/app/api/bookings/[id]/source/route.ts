import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SourceDecouverteSchema } from '@/lib/sourceDecouverte'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

// Route publique : le client répond à « Comment avez-vous connu [le laveur] ? »
// sur l'écran de confirmation, sans compte ni session. L'id de la réservation
// (un UUID imprévisible) sert de jeton d'accès — même modèle de confiance que
// le PDF de confirmation (voir api/bookings/[id]/pdf) : qui connaît l'id peut
// agir sur CETTE réservation, et uniquement sur ce seul champ.
//
// Plafond anti-abus par IP plutôt que par réservation : une seule route, pas
// de quota métier ici, juste éviter qu'un script énumère des ids au hasard.
const LIMIT = 20
const WINDOW_MS = 10 * 60 * 1000

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  cleanupRateLimit()
  const ip = clientIp(req)
  const rl = rateLimit(`booking-source:${ip}`, LIMIT, WINDOW_MS)
  if (!rl.ok) {
    logger.warn('bookings.source.rate_limited', { ip })
    return NextResponse.json(
      { error: 'Trop de requêtes en peu de temps. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = SourceDecouverteSchema.safeParse(body?.source)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Valeur invalide' }, { status: 400 })
  }

  // RLS interdit `bookings` à la clé anonyme → service-role, ciblé sur l'id exact.
  const admin = createAdminClient()

  const { data: booking, error: errRead } = await admin
    .from('bookings')
    .select('id, source_decouverte')
    .eq('id', id)
    .maybeSingle()

  if (errRead) {
    logger.error('bookings.source.read_failed', { bookingId: id }, errRead)
    return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  }
  if (!booking) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  // Déjà répondu : on ne réécrit pas. L'écran de confirmation peut être
  // rouvert (le client y revient, le lien est partagé par erreur) — la
  // première réponse reste la bonne, pas la dernière reçue.
  if (booking.source_decouverte) {
    return NextResponse.json({ ok: true, already: true })
  }

  const { error: errWrite } = await admin
    .from('bookings')
    .update({ source_decouverte: parsed.data })
    .eq('id', id)

  if (errWrite) {
    logger.error('bookings.source.write_failed', { bookingId: id }, errWrite)
    return NextResponse.json({ error: 'Échec de l’enregistrement' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
