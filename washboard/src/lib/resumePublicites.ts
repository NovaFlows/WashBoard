import { estEnCours, budgetAVerifier, type Campagne } from '@/lib/campagne'

// Le résumé affiché sous « Publicités » dans la section Automatismes.
//
// Volontairement calculé à partir des SEULES campagnes déclarées : pas des
// visites, pas des réservations. Afficher le retour (« × 3,1 ») sur cette ligne
// obligerait l'écran Clients à charger deux agrégations complètes à chaque
// ouverture, pour un chiffre qu'on vient de toute façon regarder en entrant
// dans l'écran. Une ligne de liste ne justifie pas ça.
//
// Ce qu'elle dit en revanche, et qui ne coûte rien : qu'un budget demande à
// être actualisé. C'est le seul cas où cette ligne doit attirer l'œil, parce
// que c'est le seul où ne rien faire dégrade les chiffres.

export type ResumePublicites = { texte: string; ton?: 'ambre' }

export function resumePublicites(
  campagnes: readonly Pick<Campagne, 'debut' | 'fin' | 'budget_maj_le'>[],
  aujourdHui: string,
  maintenant: number = Date.now(),
): ResumePublicites {
  if (campagnes.length === 0) {
    return { texte: 'Savoir ce que vos publicités vous rapportent' }
  }

  // L'avertissement passe devant le décompte : entre « 3 campagnes » et « un
  // budget à actualiser », c'est le second qui demande une action.
  const aVerifier = campagnes.filter(c => budgetAVerifier(c, aujourdHui, maintenant)).length
  if (aVerifier > 0) {
    return {
      texte: aVerifier === 1
        ? 'Un budget à actualiser'
        : `${aVerifier} budgets à actualiser`,
      ton: 'ambre',
    }
  }

  const enCours = campagnes.filter(c => estEnCours(c, aujourdHui)).length
  const total = `${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''}`
  return {
    texte: enCours === 0
      ? `${total} · aucune en cours`
      : `${total} · ${enCours} en cours`,
  }
}
