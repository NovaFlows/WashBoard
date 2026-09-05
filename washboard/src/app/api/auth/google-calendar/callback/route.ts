import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode } from '@/lib/google-calendar'
import { logger } from '@/lib/logger'
import { STATE_COOKIE } from '../route'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Retour de la connexion Google Agenda.
//
// Deux protections, absentes auparavant :
//
// 1. Le `state` est compare au jeton depose en cookie au depart. Sans cela,
//    n'importe qui pouvait declencher ce retour avec le code d'autorisation de
//    SON compte Google.
//
// 2. Le laveur est identifie par la SESSION, plus par le `state`. C'etait le
//    coeur de la faille : le state portait l'identifiant du laveur, donc
//    l'attaquant choisissait sur quel compte son jeton serait ecrit.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar`)
  }

  const attendu = request.cookies.get(STATE_COOKIE)?.value
  if (!attendu || attendu !== state) {
    // Pas d'exception : ce cas se produit aussi quand quelqu'un relance un
    // vieux lien. Mais il doit se voir dans les journaux, car c'est aussi la
    // signature d'une tentative.
    logger.warn('google_calendar.state_mismatch', { avecCookie: !!attendu })
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${BASE}/login`)

  // Le compte relie est celui de la personne connectee, point. Le contenu de
  // l'URL ne decide plus de rien.
  const { data: washer, error: washerError } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (washerError || !washer) {
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar`)
  }

  const refreshToken = await exchangeCode(code)
  if (!refreshToken) {
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar-no-token`)
  }

  const { error } = await supabase
    .from('washers')
    .update({ google_refresh_token: refreshToken })
    .eq('id', washer.id)
    .eq('user_id', user.id)

  if (error) {
    // Sans cette trace, un echec d'ecriture affichait « connecte » alors que
    // l'agenda ne l'etait pas.
    logger.error('google_calendar.token_save_failed', { washerId: washer.id }, error)
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar`)
  }

  const response = NextResponse.redirect(`${BASE}/dashboard/admin?tab=identite&success=google-calendar`)
  // Jeton consomme : il ne doit plus servir.
  response.cookies.delete(STATE_COOKIE)
  return response
}
