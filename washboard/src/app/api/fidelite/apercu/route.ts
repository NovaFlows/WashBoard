import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { carteVisible, cleFidelite, etatCarte, fideliteActive, numeroStable, partiesOffertes, phraseCarte, remiseFidelite } from '@/lib/fidelite'
import { lireCarte, reservationsDuClient } from '@/lib/fideliteServeur'

// Aperçu de la carte de fidélité au moment où le client a donné ses coordonnées, juste avant
// de confirmer (demande d'Alexandre, 2026-10-17 : le bandeau ne doit pas dépendre de
// l'appareil, mais des coordonnées). Rend les tampons et, si une récompense l'attend, la
// remise sur le prix affiché — l'enregistrement (`api/bookings`) la recalcule de toute façon.
//
// Ne crée rien. Limité par adresse IP : sans compte, n'importe qui peut taper un email, et
// on ne veut pas qu'on puisse sonder en masse qui est client de qui. La réponse ne contient
// ni nom ni coordonnée, seulement un nombre de tampons — et seulement quand le téléphone ET
// l'email tapés vont ensemble (`carteVisible`, 2026-10-19) : sinon, la même carte vierge
// qu'un numéro inconnu, pour ne rien laisser deviner.

const Corps = z.object({
  washerId: z.string().uuid(),
  email: z.string().trim().max(254).optional().default(''),
  telephone: z.string().trim().max(30).optional().default(''),
  /** Prestation (après promotion), options et déplacement, tels qu'affichés au client. */
  prestation: z.number().min(0).max(100_000),
  options: z.number().min(0).max(100_000).optional().default(0),
  deplacement: z.number().min(0).max(100_000).optional().default(0),
})

export async function POST(request: NextRequest) {
  const limite = rateLimit(`fidelite-apercu:${clientIp(request)}`, 30, 10 * 60_000)
  if (!limite.ok) return NextResponse.json({ active: false }, { status: 429 })

  const lu = Corps.safeParse(await request.json().catch(() => null))
  if (!lu.success) return NextResponse.json({ active: false }, { status: 400 })
  const { washerId, email, telephone, prestation, options, deplacement } = lu.data
  // Les deux, toujours : la carte suit le téléphone, l'email prouve qu'elle est la sienne.
  if (!numeroStable(telephone) || !email.includes('@')) return NextResponse.json({ active: false })
  const cle = cleFidelite(email, telephone)

  const admin = createAdminClient()
  const { data: laveur } = await admin.from('washers').select('fidelite').eq('id', washerId).maybeSingle()
  const reglages = fideliteActive(laveur?.fidelite)
  if (!reglages) return NextResponse.json({ active: false })

  const reservations = await reservationsDuClient(admin, washerId, cle)
  if (!reservations) return NextResponse.json({ active: false })
  const visible = carteVisible(reservations, email)
  const carte = visible ? await lireCarte(admin, washerId, cle) : null
  const etat = etatCarte(visible ? reservations : [], carte?.ajustement ?? 0, reglages.tampons, reglages.tampon_par_vehicule)

  const remise = etat.disponibles > 0 ? remiseFidelite(reglages, { prestation, options, deplacement }) : 0
  return NextResponse.json({
    active: true,
    progression: etat.progression,
    requis: etat.requis,
    disponibles: etat.disponibles,
    remise,
    offerte: etat.disponibles > 0 && reglages.recompense === 'offerte',
    offert: etat.disponibles > 0 && reglages.recompense === 'offerte' ? partiesOffertes(reglages) : null,
    phrase: phraseCarte(etat, reglages),
  })
}
