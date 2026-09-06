import webpush from 'web-push'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportMember } from '@/lib/supportAccess'

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

/** Envoie une notification aux appareils de l'équipe, et à eux seuls.
 *
 *  Sert aux événements qui concernent WashBoard en tant qu'entreprise — une
 *  nouvelle inscription, par exemple — et non un laveur en particulier.
 *
 *  La liste des destinataires est `SUPPORT_ADMIN_EMAILS`, la même variable qui
 *  garde déjà l'accès support. Elle vit dans l'environnement et jamais dans le
 *  code : le dépôt est public. Variable absente = personne n'est notifié, ce
 *  qui est le bon comportement pour un déploiement mal configuré.
 *
 *  Ne lève jamais : une notification est un confort, elle ne doit pas faire
 *  échouer l'inscription qui l'a déclenchée. */
export async function notifierEquipe(payload: PushPayload): Promise<void> {
  const liste = process.env.SUPPORT_ADMIN_EMAILS
  if (!liste?.trim()) return
  if (!configurer()) return

  try {
    const supabase = createAdminClient()

    // L'adresse email vit dans `auth.users`, pas dans `washers` : il faut donc
    // passer par l'API d'administration pour retrouver qui est qui. Une seule
    // page suffit très largement au volume actuel, et le jour où elle ne
    // suffira plus, ce sera un problème agréable à avoir.
    const { data: comptes, error: errComptes } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (errComptes) {
      logger.error('push.equipe.users_read_failed', {}, errComptes)
      return
    }

    const idsAdmins = (comptes?.users ?? [])
      .filter(u => isSupportMember(u.email, liste))
      .map(u => u.id)

    if (!idsAdmins.length) {
      // Adresse configurée mais aucun compte correspondant : typiquement une
      // faute de frappe dans la variable. Silencieux, ce serait indétectable.
      logger.warn('push.equipe.aucun_compte_correspondant', {})
      return
    }

    // Un membre de l'équipe peut avoir plusieurs fiches laveur (compte de test
    // et compte réel) : on notifie les appareils rattachés à chacune.
    const { data: fiches, error: errFiches } = await supabase
      .from('washers').select('id').in('user_id', idsAdmins)
    if (errFiches) {
      logger.error('push.equipe.washers_read_failed', {}, errFiches)
      return
    }

    await Promise.all((fiches ?? []).map(f => notifierLaveur(f.id as string, payload)))
  } catch (e) {
    logger.error('push.equipe.failed', {}, e)
  }
}
