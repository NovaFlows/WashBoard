import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { cleClient } from '@/lib/clientProfile'
import { fideliteActive, phraseCarte, remiseFidelite } from '@/lib/fidelite'
import { etatDuClient, lireCarte } from '@/lib/fideliteServeur'

// Aperçu de la carte de fidélité au moment où le client a donné ses coordonnées, juste avant
// de confirmer (demande d'Alexandre, 2026-10-17 : le bandeau ne doit pas dépendre de
// l'appareil, mais des coordonnées). Rend les tampons et, si une récompense l'attend, la
// remise sur le prix affiché — l'enregistrement (`api/bookings`) la recalcule de toute façon.
//
// Ne crée rien. Limité par adresse IP : sans compte, n'importe qui peut taper un email, et
// on ne veut pas qu'on puisse sonder en masse qui est client de qui. La réponse ne contient
// ni nom ni coordonnée, seulement un nombre de tampons.

const Corps = z.object({
  washerId: z.string().uuid(),
  email: z.string().trim().max(254).optional().default(''),
  telephone: z.string().trim().max(30).optional().default(''),
  prix: z.number().min(0).max(100_000),
})

export async function POST(request: NextRequest) {
  const limite = rateLimit(`fidelite-apercu:${clientIp(request)}`, 30, 10 * 60_000)
  if (!limite.ok) return NextResponse.json({ active: false }, { status: 429 })

  const lu = Corps.safeParse(await request.json().catch(() => null))
  if (!lu.success) return NextResponse.json({ active: false }, { status: 400 })
  const { washerId, email, telephone, prix } = lu.data
  const cle = cleClient(email, telephone)
  if (!cle) return NextResponse.json({ active: false })

  const admin = createAdminClient()
  const { data: laveur } = await admin.from('washers').select('fidelite').eq('id', washerId).maybeSingle()
  const reglages = fideliteActive(laveur?.fidelite)
  if (!reglages) return NextResponse.json({ active: false })

  const carte = await lireCarte(admin, washerId, cle)
  const etat = await etatDuClient(admin, washerId, cle, reglages.tampons, carte?.ajustement ?? 0)
  if (!etat) return NextResponse.json({ active: false })

  const remise = etat.disponibles > 0 ? remiseFidelite(reglages, prix) : 0
  return NextResponse.json({
    active: true,
    progression: etat.progression,
    requis: etat.requis,
    disponibles: etat.disponibles,
    remise,
    offerte: etat.disponibles > 0 && reglages.recompense === 'offerte',
    phrase: phraseCarte(etat, reglages),
  })
}
