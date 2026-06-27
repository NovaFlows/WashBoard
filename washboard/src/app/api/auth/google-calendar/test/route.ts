import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

/**
 * Diagnostic : tente de créer puis supprimer un événement de test dans
 * Google Agenda avec le token stocké, et renvoie l'erreur exacte de Google.
 * À visiter dans le navigateur quand on est connecté à WashBoard :
 *   /api/auth/google-calendar/test
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Non connecté à WashBoard' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id, google_refresh_token').eq('user_id', user.id).single()

  if (!washer) return NextResponse.json({ ok: false, error: 'Profil laveur introuvable' }, { status: 404 })
  if (!washer.google_refresh_token)
    return NextResponse.json({ ok: false, error: 'Aucun token Google stocké — cliquez sur Connecter' }, { status: 400 })

  // Vérif présence des variables d'env OAuth
  const envCheck = {
    GOOGLE_CLIENT_ID:     !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI:  process.env.GOOGLE_REDIRECT_URI ?? '(non défini)',
  }

  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!,
    )
    client.setCredentials({ refresh_token: washer.google_refresh_token })
    const cal = google.calendar({ version: 'v3', auth: client })

    const start = new Date(Date.now() + 24 * 3600 * 1000)
    const end   = new Date(start.getTime() + 30 * 60 * 1000)

    const res = await cal.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: '✅ Test WashBoard (à ignorer)',
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
      },
    })

    const eventId = res.data.id
    // On supprime aussitôt le test
    if (eventId) {
      await cal.events.delete({ calendarId: 'primary', eventId }).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      message: 'Connexion Google Agenda fonctionnelle — un événement de test a été créé puis supprimé.',
      envCheck,
    })
  } catch (e: unknown) {
    const err = e as { message?: string; response?: { data?: unknown } }
    return NextResponse.json({
      ok: false,
      error: err.message ?? 'Erreur inconnue',
      googleResponse: err.response?.data ?? null,
      envCheck,
    }, { status: 500 })
  }
}
