import { FUSEAU } from '@/lib/dateUtils'

/** Rappel du soir : « pensez à marquer vos rendez-vous du jour Terminé ».
 *
 *  Tant qu'un rendez-vous n'est pas « Terminé », sa facture n'est pas émise et
 *  sa comptabilité n'est pas à jour. Or le laveur passe sa journée chez ses
 *  clients, pas dans l'application. Seuls les jours où il avait des
 *  rendez-vous comptent — confirmés OU restés « en attente » : certains laveurs
 *  (Kookii Clean) vont chez le client sans avoir confirmé dans l'app.
 *
 *  Pur : aucun accès réseau, testable sans base. */

/** Décalage de Paris par rapport à UTC, en minutes, à un instant donné
 *  (60 en hiver, 120 en été). */
function decalageParis(instant: Date): number {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU, timeZoneName: 'shortOffset' })
    .formatToParts(instant)
    .find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(nom)
  if (!m) return 0
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0)
  return m[1] === '-' ? -minutes : minutes
}

/** La journée calendaire de Paris qui contient `maintenant`, en instants UTC :
 *  de minuit (inclus) au minuit suivant (exclu). */
export function journeeParis(maintenant: Date): { jour: string; debut: string; fin: string } {
  const jour = maintenant.toLocaleDateString('en-CA', { timeZone: FUSEAU })
  const minuitUtc = new Date(`${jour}T00:00:00Z`)
  const lendemainUtc = new Date(minuitUtc.getTime() + 86_400_000)
  const debut = new Date(minuitUtc.getTime() - decalageParis(minuitUtc) * 60_000)
  const fin = new Date(lendemainUtc.getTime() - decalageParis(lendemainUtc) * 60_000)
  return { jour, debut: debut.toISOString(), fin: fin.toISOString() }
}

/** Nombre de rendez-vous encore à terminer, par laveur. Un rendez-vous annulé
 *  ou déjà terminé ne réclame rien. */
export function rendezVousNonTermines(reservations: { washer_id: string; status: string }[]): Map<string, number> {
  const parLaveur = new Map<string, number>()
  for (const r of reservations) {
    if (r.status !== 'pending' && r.status !== 'confirmed') continue
    parLaveur.set(r.washer_id, (parLaveur.get(r.washer_id) ?? 0) + 1)
  }
  return parLaveur
}

export function messageRappel(nombre: number, jour: string) {
  return {
    // L'emoji donne un repère visuel : sur iPhone la notification est un bloc
    // sombre avec l'icône de l'app, rien d'autre ne se règle. Texte court : au
    // repos, iOS coupe le corps après une ou deux lignes.
    title: '🧽 Vos rendez-vous du jour',
    body: `${nombre} rendez-vous à marquer « Terminé » pour vos factures.`,
    url: '/dashboard/calendrier',
    // Un seul rappel par jour et par appareil, même si la tâche était relancée.
    tag: `rappel-terminer-${jour}`,
  }
}
