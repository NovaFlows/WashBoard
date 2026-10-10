import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { quotaReservations } from '@/lib/plan'
import { estVerrouillee, seuilsVerrouillage } from '@/lib/reservationsVerrouillees'
import { DECALAGE_MAX_JOURS, DELAI_RELANCE_DEFAUT_JOURS, nouvelleEcheance } from '@/lib/messagesAutomatiques'

// Décaler ou annuler UN message programmé (demande d'avis ou relance), depuis la liste
// « Programmé » de Messages automatiques (Alexandre, 2026-10-10 : « on doit pouvoir cliquer sur
// un client et soit décaler l'envoi soit ne pas envoyer »).
//
// - Avis : sa date est déjà en base (`review_request_at`, lue par le cron send-reviews).
//   Décaler la repousse ; annuler l'efface — le cron ne lit que les lignes qui en ont une.
// - Relance : sa date n'existe nulle part (dernier rendez-vous + délai, recalculé chaque jour).
//   Décaler pose `relance_reportee_au`, que le cron respecte ; annuler pose `followup_sent_at`
//   (le cron ne la reprend plus) ET `relance_annulee_le` (pour que l'écran et les Chiffres ne la
//   comptent pas comme envoyée).
//
// Annuler ne touche qu'à CE message. Pour ne plus jamais écrire à quelqu'un, il y a le réglage
// « ne plus contacter » de la fiche client.

type Corps = { type?: unknown; action?: unknown; jours?: unknown }

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const corps = await req.json().catch(() => ({})) as Corps
  const type = corps.type === 'avis' || corps.type === 'relance' ? corps.type : null
  const action = corps.action === 'decaler' || corps.action === 'annuler' ? corps.action : null
  const jours = Number(corps.jours)
  if (!type || !action) return NextResponse.json({ error: 'Demande invalide' }, { status: 400 })
  if (action === 'decaler' && !(Number.isInteger(jours) && jours >= 1 && jours <= DECALAGE_MAX_JOURS)) {
    return NextResponse.json({ error: 'Décalage invalide' }, { status: 400 })
  }

  // `bookings` par l'admin (`authenticated` n'y a plus droit) : le filtre `washer_id` est la
  // seule barrière entre laveurs.
  const admin = createAdminClient()
  const { data: rdv, error } = await admin
    .from('bookings')
    .select('id, status, scheduled_at, created_at, saisie_par_laveur, review_request_at, review_request_sent_at, followup_sent_at, relance_reportee_au')
    .eq('id', id)
    .eq('washer_id', washerId)
    .maybeSingle()
  if (error) {
    logger.error('bookings.message.read_failed', { bookingId: id }, error)
    return NextResponse.json({ error: 'Impossible de lire ce rendez-vous. Réessayez dans un instant.' }, { status: 503 })
  }
  if (!rdv) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  const { data: laveur, error: errLaveur } = await admin
    .from('washers')
    .select('id, plan, grandfathered, created_at, subscription_status, trial_ends_at, subscription_ends_at, slug, followup_delay_days')
    .eq('id', washerId)
    .single()
  if (errLaveur || !laveur) {
    logger.error('bookings.message.washer_read_failed', { bookingId: id }, errLaveur)
    return NextResponse.json({ error: 'Impossible de lire votre profil. Réessayez dans un instant.' }, { status: 503 })
  }
  // Même garde-fou que les autres routes d'un rendez-vous : rien ne s'écrit sur une réservation
  // au-delà du quota.
  const seuils = await seuilsVerrouillage(admin, laveur, quotaReservations(laveur))
  if (estVerrouillee(rdv, seuils)) {
    return NextResponse.json({ error: 'Cette réservation dépasse le quota de votre offre.' }, { status: 403 })
  }

  const maintenant = Date.now()
  let ecriture: Record<string, string | null>

  if (type === 'avis') {
    if (!rdv.review_request_at || rdv.review_request_sent_at) {
      return NextResponse.json({ error: 'Cette demande d’avis n’est plus programmée.' }, { status: 409 })
    }
    ecriture = action === 'annuler'
      ? { review_request_at: null }
      : { review_request_at: new Date(nouvelleEcheance(Date.parse(rdv.review_request_at), maintenant, jours)).toISOString() }
  } else {
    if (rdv.followup_sent_at || rdv.status === 'cancelled') {
      return NextResponse.json({ error: 'Cette relance n’est plus programmée.' }, { status: 409 })
    }
    if (action === 'annuler') {
      const iso = new Date(maintenant).toISOString()
      ecriture = { followup_sent_at: iso, relance_annulee_le: iso }
    } else {
      const delai = laveur.followup_delay_days ?? DELAI_RELANCE_DEFAUT_JOURS
      const prevu = Math.max(
        Date.parse(rdv.scheduled_at) + delai * 86_400_000,
        rdv.relance_reportee_au ? Date.parse(rdv.relance_reportee_au) : 0,
      )
      ecriture = { relance_reportee_au: new Date(nouvelleEcheance(prevu, maintenant, jours)).toISOString() }
    }
  }

  const { error: errEcriture } = await admin
    .from('bookings')
    .update(ecriture)
    .eq('id', id)
    .eq('washer_id', washerId)
  if (errEcriture) {
    logger.error('bookings.message.write_failed', { bookingId: id, type, action }, errEcriture)
    return NextResponse.json({ error: 'L’enregistrement a échoué. Réessayez dans un instant.' }, { status: 500 })
  }
  return NextResponse.json({ champs: ecriture })
}
