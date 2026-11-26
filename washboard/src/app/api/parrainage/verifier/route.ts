import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { normaliserCode } from '@/lib/parrainage'
import { trouverParrain } from '@/lib/parrainageServeur'

// Vérifie un code parrain pendant la saisie, sur la page d'inscription. Publique, donc limitée
// par connexion : le nom du parrain n'est rendu que pour un code exact (4 caractères tirés au
// hasard, impossibles à deviner à ce rythme), et ce nom est déjà public sur sa page de réservation.
const ESSAIS_MAX = 20
const FENETRE_MS = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  cleanupRateLimit()
  const ip = clientIp(request)
  if (!rateLimit(`parrainage-verifier:${ip}`, ESSAIS_MAX, FENETRE_MS).ok) {
    logger.warn('parrainage.verifier.rate_limited', { ip })
    return NextResponse.json({ error: 'Trop d’essais. Réessaie dans quelques minutes.' }, { status: 429 })
  }

  const code = normaliserCode(request.nextUrl.searchParams.get('code'))
  if (!code) return NextResponse.json({ valide: false })

  const parrain = await trouverParrain(createAdminClient(), code)
  if (parrain === 'erreur') return NextResponse.json({ error: 'Vérification impossible pour le moment.' }, { status: 503 })
  if (!parrain) return NextResponse.json({ valide: false })
  return NextResponse.json({ valide: true, code, parrain: parrain.name })
}
