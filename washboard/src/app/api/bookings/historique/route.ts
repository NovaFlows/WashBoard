import { NextRequest, NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Pagination de l'historique de l'accueil : « Charger plus ».
//
// L'accueil ne charge plus, au premier affichage, que les 5 rendez-vous
// passés les plus récents (voir `dashboard/page.tsx`, HISTORIQUE_AFFICHE) —
// avant, il rapatriait tout l'historique du laveur à chaque ouverture. Cette
// route sert les lots suivants, à la demande, plutôt que tout d'un coup.

const COLONNES = '*, services(name, price, duration_minutes, service_categories(name))'

/** Bornes d'un lot. Volontairement resserrées : cette route sert un clic
 *  « Charger plus » à la fois, pas un export en masse. */
const LOT_MIN = 1
const LOT_MAX = 20
const LOT_DEFAUT = 10

function entierBorne(valeur: string | null, defaut: number, min: number, max: number): number {
  const n = Number(valeur)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return defaut
  return Math.min(max, Math.max(min, n))
}

export async function GET(req: NextRequest) {
  const r = await requireWasher()
  if (!r.ok) return r.response
  const { supabase, washerId } = r.ctx

  const decalage = entierBorne(req.nextUrl.searchParams.get('decalage'), 0, 0, 100_000)
  const limite   = entierBorne(req.nextUrl.searchParams.get('limite'), LOT_DEFAUT, LOT_MIN, LOT_MAX)

  const { data, error } = await supabase
    .from('bookings')
    .select(COLONNES)
    .eq('washer_id', washerId)
    .in('status', ['done', 'cancelled'])
    .order('scheduled_at', { ascending: false })
    .order('id')
    .range(decalage, decalage + limite - 1)

  if (error) {
    logger.error('bookings.historique.get.db', { washerId, decalage, limite }, error)
    return errorResponse('bookings.historique.get.db', error)
  }

  const lignes = data ?? []
  // Un lot plus court que demandé signale la fin de l'historique : le client
  // s'en sert pour savoir s'il faut encore proposer « Charger plus ».
  return NextResponse.json({ data: lignes, hasMore: lignes.length === limite })
}
