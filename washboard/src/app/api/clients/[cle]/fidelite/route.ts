import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/apiError'
import { fideliteActive, phraseCarte } from '@/lib/fidelite'
import { assurerCarte, etatDuClient, lireCarte } from '@/lib/fideliteServeur'

// La carte de fidélité d'un client, vue et ajustée par SON laveur depuis la fiche client
// (lib/fidelite.ts). Le laveur est identifié par sa session ; les lectures et l'écriture
// passent ensuite par le service_role, toujours filtrées sur son `washer_id`.

/** Même règle que `api/clients/[cle]` : un email en minuscules, ou `tel:` + des chiffres. */
function cleValide(cle: string): boolean {
  return /^[^\s]+@[^\s]+\.[^\s]+$/.test(cle) || /^tel:\d{6,}$/.test(cle)
}

async function contexte(params: Promise<{ cle: string }>) {
  const cle = decodeURIComponent((await params).cle)
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !cleValide(cle)) return null
  const { data: washer } = await supabase.from('washers').select('id, fidelite').eq('user_id', user.id).maybeSingle()
  return washer ? { cle, washerId: washer.id as string, reglages: fideliteActive(washer.fidelite) } : null
}

async function reponse(washerId: string, cle: string, requis: number, phrase: (e: NonNullable<Awaited<ReturnType<typeof etatDuClient>>>) => string) {
  const admin = createAdminClient()
  const carte = await lireCarte(admin, washerId, cle)
  const etat = await etatDuClient(admin, washerId, cle, requis, carte?.ajustement ?? 0)
  if (!etat) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, ...etat, jeton: carte?.jeton ?? null, phrase: phrase(etat) })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const c = await contexte(params)
  if (!c) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!c.reglages) return NextResponse.json({ active: false })
  const reglages = c.reglages
  return reponse(c.washerId, c.cle, reglages.tampons, e => phraseCarte(e, reglages))
}

/** Ajoute (`delta: 1`) ou retire (`delta: -1`) un tampon à la main. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const c = await contexte(params)
  if (!c) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!c.reglages) return NextResponse.json({ error: 'Activez d’abord la carte de fidélité dans Prestations et prix.' }, { status: 400 })
  const reglages = c.reglages
  const corps = await request.json().catch(() => null)
  const delta = corps?.delta
  if (delta !== 1 && delta !== -1) return NextResponse.json({ error: 'Valeur invalide' }, { status: 400 })

  const admin = createAdminClient()
  const carte = await assurerCarte(admin, c.washerId, c.cle)
  if (!carte) return NextResponse.json({ error: 'La carte n’a pas pu être créée. Réessayez.' }, { status: 503 })
  const { error } = await admin.from('fidelite_cartes')
    .update({ ajustement: carte.ajustement + delta })
    .eq('washer_id', c.washerId).eq('cle', c.cle)
  if (error) return errorResponse('fidelite.ajuster', error, { washerId: c.washerId })
  logger.info('fidelite.ajustee', { washerId: c.washerId, delta })
  return reponse(c.washerId, c.cle, reglages.tampons, e => phraseCarte(e, reglages))
}
