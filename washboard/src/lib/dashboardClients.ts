// Résumé du widget Clients de l'accueil — calcul pur, à partir d'une lecture
// ALLÉGÉE des réservations (email + date de création seulement, aucune
// jointure). L'accueil ne doit plus rapatrier de lignes complètes juste pour
// compter : voir la leçon du 18/09 sur `dashboard/page.tsx`.
//
// « Client » reprend la définition de `listeClients.ts` : identifié par son
// email, sans distinction majuscule/espaces.

export type LigneClientLite = { client_email: string | null; created_at: string }

export type ResumeClientsDashboard = {
  total: number
  nouveauxCeMois: number
}

const cle = (email: string) => email.trim().toLowerCase()

/**
 * @param debutMois Borne basse (incluse) du mois en cours, format `YYYY-MM-DD`
 *   — même convention que `comptaPeriod.getPeriodRange('mois', …).start`, pour
 *   que « ce mois-ci » ne raconte pas une histoire différente d'un widget à
 *   l'autre du tableau de bord.
 */
export function resumeClients(lignes: LigneClientLite[], debutMois: string): ResumeClientsDashboard {
  // Un client peut réserver plusieurs fois : on ne retient que sa PREMIÈRE
  // réservation, seule pertinente pour dire s'il est « nouveau ce mois-ci ».
  const premiereReservation = new Map<string, string>()
  for (const l of lignes) {
    const email = l.client_email?.trim()
    if (!email) continue
    const k = cle(email)
    const existante = premiereReservation.get(k)
    if (!existante || l.created_at < existante) premiereReservation.set(k, l.created_at)
  }

  let nouveaux = 0
  for (const premiere of premiereReservation.values()) {
    if (premiere >= debutMois) nouveaux++
  }

  return { total: premiereReservation.size, nouveauxCeMois: nouveaux }
}
