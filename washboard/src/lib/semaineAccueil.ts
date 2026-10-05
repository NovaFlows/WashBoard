// « Cette semaine » et « Demain », colonne de droite de l'accueil bureau
// (maquette `Main.dc.html`, écran 1 — voir AccueilV2.tsx). Sept points, un
// par jour de la semaine en cours, qui disent d'un coup d'œil où sont les
// rendez-vous — repère discret, jamais une deuxième vedette (un seul héros
// par écran reste le prochain rendez-vous).
//
// Passe du 2026-10-06 (Alexandre a tranché) : la passe précédente avait
// signalé plutôt qu'inventé, faute d'une vue de la semaine entière côté
// serveur (`AccueilV2` ne recevait que les trois prochains rendez-vous,
// plafonnés). Cette fonction porte maintenant le calcul, nourrie par la
// VRAIE semaine lue par `dashboard/page.tsx` (une seule requête de plus,
// voir son commentaire) — jamais par une liste tronquée.
//
// Fonction pure, sans accès réseau : elle ne fait que ranger ce qu'on lui
// donne. C'est elle qui porte les tests, pas AccueilV2.tsx (qui ne fait que
// dessiner un point par état).

import { ajouterJours, jourParisDe, plageDe } from './chiffresPeriode'

/** Les quatre états qu'un point peut distinguer :
 *  - `vide`     : rien de prévu, et le jour est ouvert — un jour calme.
 *  - `confirme` : au moins un rendez-vous confirmé ou déjà terminé ce jour-là
 *                 (un rendez-vous annulé ne compte jamais).
 *  - `attente`  : au moins une demande en attente ce jour-là — prioritaire
 *                 sur `confirme` si le jour a les deux : c'est ce qui reste à
 *                 régler qui mérite l'œil.
 *  - `ferme`    : aucune plage d'horaires récurrente ce jour de la semaine
 *                 (voir `joursOuverts` ci-dessous) — distinct d'un jour vide
 *                 par un simple manque de demande. */
export type EtatJourSemaine = 'vide' | 'confirme' | 'attente' | 'ferme'

export type JourSemaine = {
  /** `AAAA-MM-JJ`, à l'heure de Paris. */
  jour: string
  /** Lettre affichée au-dessus du point : L M M J V S D. */
  lettre: string
  /** Aujourd'hui, mis en avant indépendamment de l'état — c'est la seule
   *  distinction que porte la couleur d'accent, jamais l'activité du jour. */
  aujourdhui: boolean
  etat: EtatJourSemaine
}

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

export type RdvPourSemaine = {
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
}

/**
 * @param rendezVous   Les rendez-vous de la semaine en cours (lundi 00 h 00 →
 *                      dimanche 23 h 59, Paris) — tous statuts, un rendez-vous
 *                      `cancelled` est ignoré ici, inutile de le filtrer avant
 *                      l'appel.
 * @param dateDuJour    Aujourd'hui, `AAAA-MM-JJ` à l'heure de Paris — déjà
 *                      calculé par la page serveur (`FUSEAU`), jamais redérivé
 *                      ici avec le fuseau de la machine qui exécute ce code.
 * @param joursOuverts  Jours de la semaine pour lesquels au moins une plage
 *                      d'horaires récurrente existe, même convention que la
 *                      colonne `availabilities.day_of_week` (0 = dimanche … 6
 *                      = samedi — voir `lib/horaires.ts`). `null` quand cette
 *                      information n'a pas été lue : aucun jour n'est alors
 *                      marqué fermé plutôt que de deviner une fermeture qui
 *                      n'est peut-être pas réelle.
 */
export function semaineAccueil(
  rendezVous: readonly RdvPourSemaine[],
  dateDuJour: string,
  joursOuverts: ReadonlySet<number> | null,
): JourSemaine[] {
  const { debut } = plageDe({ type: 'semaine', ref: dateDuJour })

  const parJour = new Map<string, { attente: boolean; confirme: boolean }>()
  for (const b of rendezVous) {
    if (b.status === 'cancelled') continue
    const jour = jourParisDe(b.scheduled_at)
    if (!jour) continue
    const entree = parJour.get(jour) ?? { attente: false, confirme: false }
    if (b.status === 'pending') entree.attente = true
    else entree.confirme = true
    parJour.set(jour, entree)
  }

  return Array.from({ length: 7 }, (_, i) => {
    const jour = ajouterJours(debut, i)
    const activite = parJour.get(jour)
    // Convention `availabilities.day_of_week` : 0 = dimanche. `i` va de 0
    // (lundi) à 6 (dimanche) ; lundi vaut donc 1, et dimanche (i = 6) revient
    // à 0 plutôt qu'à 7.
    const jourSemaineDb = (i + 1) % 7
    const ferme = joursOuverts !== null && !joursOuverts.has(jourSemaineDb)

    let etat: EtatJourSemaine
    if (activite?.attente) etat = 'attente'
    else if (activite?.confirme) etat = 'confirme'
    else if (ferme) etat = 'ferme'
    else etat = 'vide'

    return { jour, lettre: LETTRES[i], aujourdhui: jour === dateDuJour, etat }
  })
}
