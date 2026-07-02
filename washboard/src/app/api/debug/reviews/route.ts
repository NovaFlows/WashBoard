import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Endpoint de diagnostic : vérifie pourquoi les emails/SMS d'avis ne partent pas.
// Accessible uniquement par le laveur connecté.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers')
    .select('id, name, review_enabled, google_review_url, review_delay_hours, plan')
    .eq('user_id', user.id)
    .single()

  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const nowIso = new Date().toISOString()

  // 10 derniers RDV terminés
  const { data: recentDone } = await admin
    .from('bookings')
    .select('id, client_name, client_email, status, review_request_at, review_request_sent_at, created_at')
    .eq('washer_id', washer.id)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(10)

  // RDV en attente d'envoi (dûs mais pas encore traités)
  const { data: pending } = await admin
    .from('bookings')
    .select('id, client_name, review_request_at')
    .eq('washer_id', washer.id)
    .lte('review_request_at', nowIso)
    .is('review_request_sent_at', null)
    .not('review_request_at', 'is', null)

  const diagWasher = {
    review_enabled: washer.review_enabled,
    google_review_url: washer.google_review_url ?? '❌ non renseigné',
    review_delay_hours: washer.review_delay_hours,
    plan: washer.plan,
  }

  const diagBookings = (recentDone ?? []).map(b => {
    let etat = ''
    if (!b.review_request_at)        etat = '❌ review_request_at non défini (avis désactivé au moment du "terminé" ?)'
    else if (b.review_request_sent_at) etat = `✅ envoyé le ${b.review_request_sent_at}`
    else if (b.review_request_at > nowIso) etat = `⏳ programmé pour ${b.review_request_at}`
    else                               etat = '⚠️ dû mais pas encore envoyé (cron pas encore passé ?)'

    return {
      id: b.id,
      client: b.client_name,
      email: b.client_email ?? '❌ pas d\'email',
      etat,
    }
  })

  return NextResponse.json({
    reglages_laveur: diagWasher,
    rdv_termines_recents: diagBookings,
    en_attente_envoi: (pending ?? []).length,
    heure_serveur: nowIso,
  }, { status: 200 })
}
