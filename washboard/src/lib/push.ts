import webpush from 'web-push'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

// Notifications push (Web Push).
//
// Gratuit : les messages transitent par les services de Google, Apple et
// Mozilla, sans intermédiaire payant — contrairement aux SMS.
//
// ⚠️ Sur iPhone, une notification n'arrive QUE si le laveur a ajouté
// WashBoard à son écran d'accueil au préalable. Depuis Safari en navigation
// normale, Apple les interdit. L'interface doit donc guider dans cet ordre :
// installer, puis autoriser.

export type PushPayload = {
  title: string
  body: string
  /** Page ouverte au clic sur la notification. */
  url?: string
  /** Regroupe les notifications de même nature au lieu de les empiler. */
  tag?: string
  /** Réservation concernée : permet de la confirmer ou de la refuser
   *  directement depuis les boutons de la notification.
   *
   *  ⚠️ Ces boutons n'apparaissent que sur Android. iOS les ignore — WebKit
   *  n'affiche que son propre « Afficher » et ne gère pas les actions
   *  personnalisées. Sur iPhone, la notification reste donc simplement
   *  cliquable, ce qui ouvre la fiche du rendez-vous. */
  bookingId?: string
}

function configurer(): boolean {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privee   = process.env.VAPID_PRIVATE_KEY
  if (!publique || !privee) return false
  webpush.setVapidDetails('mailto:contact@washboard.fr', publique, privee)
  return true
}

/** Envoie une notification à tous les appareils d'un laveur.
 *
 *  Ne lève jamais : une notification est un confort, elle ne doit pas faire
 *  échouer la réservation qui l'a déclenchée. Le laveur reçoit de toute façon
 *  un email, qui reste le canal fiable. */
export async function notifierLaveur(washerId: string, payload: PushPayload): Promise<void> {
  if (!configurer()) return

  const supabase = createAdminClient()
  const { data: abonnements, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('washer_id', washerId)

  if (error) {
    logger.error('push.read_subscriptions_failed', { washerId }, error)
    return
  }
  if (!abonnements?.length) return

  const corps = JSON.stringify(payload)

  // Endpoints devenus invalides : le laveur a désinstallé l'app ou changé de
  // téléphone. Sans purge, la table accumulerait des adresses mortes qu'on
  // réessaierait indéfiniment.
  const aSupprimer: string[] = []

  await Promise.all(abonnements.map(async a => {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        corps,
      )
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) aSupprimer.push(a.id)
      else logger.error('push.send_failed', { washerId, statusCode: code }, e)
    }
  }))

  if (aSupprimer.length) {
    const { error: purgeError } = await supabase
      .from('push_subscriptions').delete().in('id', aSupprimer)
    if (purgeError) logger.error('push.purge_failed', { washerId }, purgeError)
  }
}
