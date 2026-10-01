// « Clients › À relancer » — proposition de Yanis (canevas partagé le 2026-09-28), reprise
// après discussion avec Alexandre : une liste des clients qui ne sont pas revenus, avec le VRAI
// statut de leur relance automatique — pas un calcul refait à part, qui finirait par diverger
// du cron le jour où l'un des deux change (RÈGLE D'OR de `messagesAutomatiques.ts` : reproduire
// ce que le cron `send-followups` fait vraiment, appliquée ici à un deuxième écran).
//
// Ce fichier ne calcule donc presque rien de neuf : il choisit, pour le dernier rendez-vous
// honoré de chaque client, la phrase à afficher — et applique le réglage qu'aucun cron ne
// connaissait avant le 2026-09-28, « ne plus contacter » (table `clients`).
//
// Un client REVENU (rendez-vous à venir, confirmé ou en attente) ne fait pas partie de cette
// liste : ce n'est plus lui qu'il faut relancer. Même règle que `decisionPlusRecents`
// (`lib/relances.ts`), reformulée ici parce que ce module n'a pas accès aux autres réservations
// du client, seulement à la plus récente déjà réduite par `RdvMessage`.

import { cleClient } from './clientProfile'
import {
  jourRelatif, momentRelance, nomAffiche, relanceActive,
  type RdvMessage, type ReglagesMessages,
} from './messagesAutomatiques'

/** Cet écran ne connaît que le réglage de relance — pas celui des avis Google, qui n'a rien à y
 *  faire. `ReglagesMessages` complet resterait un moyen de le confondre avec l'écran qui, lui,
 *  règle les deux. */
export type ReglagesRelance = Pick<ReglagesMessages, 'followup_enabled' | 'followup_delay_days' | 'followup_message'>

const JOUR = 86_400_000

export type LigneARelancer = {
  /** Identifie le client — voir `cleClient` : email, ou téléphone à défaut. */
  cle: string
  nom: string
  /** Prestation et date, comme une ligne du fichier clients. */
  detail: string
  /** Jours depuis le dernier rendez-vous honoré. */
  jours: number
  /** Ce qui s'affiche à droite : « À appeler », « Relance dès lundi », « Relancé il y a 12 j »,
   *  « Ne veut plus », ou un simple compte de jours si la relance automatique est éteinte. */
  statut: string
  /** Une relance est due MAINTENANT et va réellement partir au prochain passage du cron. */
  urgent: boolean
  nePlusContacter: boolean
}

/** Le dernier rendez-vous CONFIRMÉ OU TERMINÉ, déjà passé, de chaque client — un rendez-vous à
 *  venir (même confirmé) veut dire que le client est déjà revenu, il sort donc de la liste. */
function dernierRdvPasseParClient(rdvs: RdvMessage[], maintenant: number): Map<string, RdvMessage> {
  const parClient = new Map<string, RdvMessage>()
  for (const b of rdvs) {
    if (b.status === 'cancelled' || !b.client_email?.trim()) continue
    const courant = parClient.get(b.client_email)
    if (!courant || new Date(b.scheduled_at).getTime() > new Date(courant.scheduled_at).getTime()) {
      parClient.set(b.client_email, b)
    }
  }
  for (const [cle, b] of [...parClient]) {
    const passe = (b.status === 'confirmed' || b.status === 'done')
      && new Date(b.scheduled_at).getTime() <= maintenant
    if (!passe) parClient.delete(cle)
  }
  return parClient
}

export function clientsARelancer(
  rdvs: RdvMessage[],
  reglagesMessages: ReglagesRelance,
  reglagesClients: { cle: string; nePlusContacter: boolean }[],
  maintenant: number,
): LigneARelancer[] {
  // `relanceActive` ne lit que les deux champs de relance (voir son implémentation) : le cast
  // évite d'inventer de faux réglages d'avis Google pour satisfaire un type plus large que ce
  // dont cet écran a besoin.
  const active = relanceActive(reglagesMessages as ReglagesMessages)
  const parReglageClient = new Map(reglagesClients.map(r => [r.cle, r.nePlusContacter]))

  const lignes: { ligne: LigneARelancer; tri: number }[] = []
  for (const dernier of dernierRdvPasseParClient(rdvs, maintenant).values()) {
    const quand = new Date(dernier.scheduled_at).getTime()
    const jours = Math.floor((maintenant - quand) / JOUR)
    const cle = cleClient(dernier.client_email, dernier.client_phone)
    const nePlusContacter = parReglageClient.get(cle) ?? false

    // Trois façons dont une ligne peut finir : le client a demandé qu'on le laisse tranquille
    // (prime sur tout, y compris une relance déjà partie) ; sa relance est déjà partie (le
    // cron ne la renverra pas, `followup_sent_at` en fait foi) ; ou elle est encore à venir.
    let statut: string
    let urgent = false
    let tri: number
    if (nePlusContacter) {
      statut = 'Ne veut plus'
      tri = Number.MAX_SAFE_INTEGER - jours
    } else if (dernier.followup_sent_at) {
      const j = Math.floor((maintenant - new Date(dernier.followup_sent_at).getTime()) / JOUR)
      statut = j <= 0 ? 'Relancé aujourd’hui' : `Relancé il y a ${j} j`
      tri = Number.MAX_SAFE_INTEGER - jours
    } else if (active) {
      const instant = quand + reglagesMessages.followup_delay_days * JOUR
      urgent = instant <= maintenant
      statut = urgent ? 'À appeler' : `Relance ${momentRelance(instant, maintenant)}`
      // Due maintenant : les plus anciens d'abord (le plus urgent des urgents). Programmée :
      // la plus proche d'abord. Un vrai instant (millisecondes) reste toujours plus petit que
      // le compteur du panier du dessus — les deux échelles ne se chevauchent jamais.
      tri = urgent ? -(1_000_000_000 + jours) : instant
    } else {
      // La relance automatique n'est pas réglée : rien ne partira, on ne promet qu'un compte.
      statut = `${jours} j sans revenir`
      tri = Number.MAX_SAFE_INTEGER - jours
    }

    lignes.push({
      ligne: {
        cle,
        nom: nomAffiche(dernier),
        detail: `${dernier.services?.name ?? 'Prestation'} · ${jourRelatif(quand, maintenant)}`,
        jours,
        statut,
        urgent,
        nePlusContacter,
      },
      tri,
    })
  }

  return lignes.sort((a, b) => a.tri - b.tri).map(l => l.ligne)
}
