import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar'

// Départ de la connexion Google Agenda.
//
// Le paramètre `state` valait auparavant l'identifiant du laveur : une valeur
// stable, devinable, et jamais recomparée au retour. Quelqu'un pouvait donc
// faire autoriser SON compte Google en passant l'identifiant d'un laveur, et
// voir son propre jeton écrit sur le compte de la victime — recevant ensuite
// tous les rendez-vous de celle-ci dans son agenda, avec le nom, le téléphone
// et l'adresse de ses clients. Signalé par un audit externe le 2026-09-05.
//
// Le `state` est désormais un jeton aléatoire, déposé en cookie inaccessible au
// JavaScript, et vérifié au retour.

export const STATE_COOKIE = 'wb_gcal_state'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))

  const state = randomBytes(32).toString('hex')
  const response = NextResponse.redirect(getGoogleAuthUrl(state))

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // 'strict' casserait le retour depuis Google
    path: '/',
    // Le temps d'accorder l'autorisation, pas davantage : un jeton qui traîne
    // est un jeton réutilisable.
    maxAge: 10 * 60,
  })

  return response
}
