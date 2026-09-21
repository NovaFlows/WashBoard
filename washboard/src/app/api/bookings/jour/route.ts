import { NextRequest, NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import { minuitParisUTC } from '@/lib/dateUtils'

// Un jour arbitraire pour le widget « Aujourd'hui » de l'accueil, qui se
// navigue désormais au jour précédent ou suivant.
//
// Volontairement une route à part plutôt que de faire naviguer le widget dans
// les données déjà en mémoire : `aVenir` ne couvre que le futur, et
// l'historique n'est chargé que par 5 (voir `bookings/historique`). Un jour
// arbitraire — hier, ou dans trois semaines — doit rester juste quel que soit
// ce qui a déjà été chargé ailleurs sur la page.

const COLONNES = 'id, client_name, scheduled_at, status, services(name)'

export async function GET(req: NextRequest) {
  const r = await requireWasher()
  if (!r.ok) return r.response
  const { supabase, washerId } = r.ctx

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }

  // Bornes du jour à l'heure de PARIS, pas celle du serveur (Vercel tourne en
  // UTC) : sans ça, les rendez-vous de fin de soirée ou de tout début de
  // matinée se retrouveraient rangés sur le mauvais jour selon la saison.
  const debutUtc = minuitParisUTC(date)
  // Le lendemain à minuit Paris, PAS +24h : un jour peut faire 23h ou 25h au
  // moment du changement d'heure (vérifié dans dateUtils.test.ts). On
  // incrémente la CHAÎNE de date, ancrée à midi UTC pour rester à distance de
  // tout changement d'heure, puis on la fait repasser par `minuitParisUTC` —
  // jamais en ajoutant 24h à un instant déjà converti, qui déraille d'un jour
  // au passage à l'heure d'été (Paris étant en avance sur UTC).
  const demain = new Date(`${date}T12:00:00Z`)
  demain.setUTCDate(demain.getUTCDate() + 1)
  const finUtc = minuitParisUTC(demain.toISOString().slice(0, 10))

  // En dehors d'aujourd'hui, un rendez-vous déjà clôturé redevient
  // pertinent : on regarde ce qui s'est passé ce jour-là, pas seulement ce
  // qu'il reste à faire. Seuls les annulés restent écartés.
  const { data, error } = await supabase
    .from('bookings')
    .select(COLONNES)
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', debutUtc.toISOString())
    .lt('scheduled_at', finUtc.toISOString())
    .order('scheduled_at')

  if (error) {
    logger.error('bookings.jour.get.db', { washerId, date }, error)
    return errorResponse('bookings.jour.get.db', error)
  }

  return NextResponse.json({ data: data ?? [], date })
}
