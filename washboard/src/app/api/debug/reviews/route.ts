import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { hasFeature, quotaReservations } from '@/lib/plan'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { seuilsVerrouillage, masquerVerrouillees } from '@/lib/reservationsVerrouillees'

// Endpoint de diagnostic : vérifie pourquoi les emails/SMS d'avis ne partent pas.
// Accessible uniquement par le laveur connecté — et, comme tout ce qui lit des
// réservations pour un laveur, les réservations verrouillées (au-delà du quota)
// n'y laissent voir ni nom, ni email, ni téléphone.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers')
    .select('id, name, review_enabled, google_review_url, review_delay_hours, review_channel, plan, grandfathered, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id)
    .single()

  if (errWasher) logger.error('debug.reviews.washer.read_failed', {}, errWasher)

  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const nowIso = new Date().toISOString()

  // 10 derniers RDV terminés
  const { data: recentDone, error: errRecentDone } = await admin
    .from('bookings')
    .select('id, client_name, client_email, client_phone, status, review_request_at, review_request_sent_at, created_at, saisie_par_laveur, facture_numero')
    .eq('washer_id', washer.id)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(10)
  if (errRecentDone) logger.error('debug.reviews.recentDone.read_failed', {}, errRecentDone)

  // Même règle que partout : au-delà du quota, nom, email et téléphone ne sortent pas.
  const seuils = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  const visibles = masquerVerrouillees(recentDone ?? [], seuils)

  // RDV en attente d'envoi (dûs mais pas encore traités)
  // Page par page : l'API coupe à 1 000 lignes sans erreur (voir `toutesLesLignes`).
  const { data: pending, error: errPending } = await toutesLesLignes((debut, fin) => admin
    .from('bookings')
    .select('id, client_name, review_request_at')
    .eq('washer_id', washer.id)
    .lte('review_request_at', nowIso)
    .is('review_request_sent_at', null)
    .not('review_request_at', 'is', null)
    .order('review_request_at')
    .order('id')
    .range(debut, fin))
  if (errPending) logger.error('debug.reviews.pending.read_failed', {}, errPending)

  const diagWasher = {
    review_enabled: washer.review_enabled,
    google_review_url: washer.google_review_url ?? '❌ non renseigné',
    review_delay_hours: washer.review_delay_hours,
    review_channel: washer.review_channel ?? 'email (défaut)',
    plan: washer.plan,
    grandfathered: washer.grandfathered,
    sms_autorise: hasFeature(washer, 'avis_sms') ? '✅' : '❌ plan insuffisant',
  }

  const diagBookings = visibles.map(b => {
    let etat = ''
    if (!b.review_request_at)        etat = '❌ review_request_at non défini (avis désactivé au moment du "terminé" ?)'
    else if (b.review_request_sent_at) etat = `✅ envoyé le ${b.review_request_sent_at}`
    else if (b.review_request_at > nowIso) etat = `⏳ programmé pour ${b.review_request_at}`
    else                               etat = '⚠️ dû mais pas encore envoyé (cron pas encore passé ?)'

    if (b.verrouillee) {
      return { id: b.id, client: '🔒 verrouillée (au-delà du quota)', email: '🔒', phone: '🔒', etat }
    }
    return {
      id: b.id,
      client: b.client_name,
      email: b.client_email ?? '❌ pas d\'email',
      phone: b.client_phone ?? '❌ pas de téléphone',
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
