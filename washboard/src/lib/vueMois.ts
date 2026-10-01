import { buildGrid } from '@/lib/calendarLayout'

// Calculs purs de la vue « mois » de l'agenda v2 (MoisV2.tsx, refonte 2026,
// passe 7). Rien ici ne connaît React : la plage de mois à dérouler, les
// semaines de chaque mois, et ce qu'on dessine sous un numéro de jour.

export type MoisRef = { annee: number; mois: number }

/** Clé stable d'un mois (« 2026-09 ») : sert d'identifiant de bloc et de cible
 *  de défilement. */
export function cleMois(annee: number, mois: number): string {
  return `${annee}-${String(mois + 1).padStart(2, '0')}`
}

/** Les mois à dérouler, dans l'ordre : `avant` mois avant celui de `reference`,
 *  celui-ci, puis `apres` mois après. `inclure` étend la plage si besoin — un
 *  jour affiché en dehors de la fenêtre (lien de notification vers un vieux
 *  rendez-vous, par exemple) doit rester atteignable : sans ça, la vue mois
 *  s'ouvrirait sur un mois qui n'existe pas dans la liste. */
export function plageDeMois(reference: Date, avant: number, apres: number, inclure?: Date): MoisRef[] {
  const rang = (d: Date) => d.getFullYear() * 12 + d.getMonth()
  const centre = rang(reference)
  let debut = centre - Math.max(0, avant)
  let fin = centre + Math.max(0, apres)
  if (inclure) {
    debut = Math.min(debut, rang(inclure))
    fin = Math.max(fin, rang(inclure))
  }
  return Array.from({ length: fin - debut + 1 }, (_, k) => {
    const m = debut + k
    return { annee: Math.floor(m / 12), mois: m % 12 }
  })
}

/** Les semaines d'un mois, lundi en premier, `null` pour les cases avant le 1er
 *  et après le dernier jour. Contrairement à `buildGrid` (toujours 6 semaines,
 *  pour que la grille de la v1 garde une hauteur fixe), on retire les semaines
 *  entièrement vides à la fin : dans une liste continue, une ligne vide entre
 *  deux mois serait du blanc perdu. */
export function semainesDuMois(annee: number, mois: number): (Date | null)[][] {
  const cases = buildGrid(annee, mois)
  const semaines: (Date | null)[][] = []
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7))
  while (semaines.length > 0 && semaines[semaines.length - 1].every(c => c === null)) semaines.pop()
  return semaines
}

/** Colonne (0 = lundi … 6 = dimanche) du premier jour du mois. */
export function colonnePremierJour(annee: number, mois: number): number {
  return (new Date(annee, mois, 1).getDay() + 6) % 7
}

/** Nombre de rendez-vous NON annulés par jour, à partir de l'index par jour que
 *  l'agenda tient déjà (`byDate`, clés `dayKey`). Un rendez-vous annulé
 *  n'occupe plus de temps : il ne doit pas faire croire à une journée chargée. */
export function compterActifsParJour<T extends { status: string }>(parJour: Map<string, T[]>): Map<string, number> {
  const compte = new Map<string, number>()
  parJour.forEach((liste, cle) => {
    const n = liste.filter(b => b.status !== 'cancelled').length
    if (n > 0) compte.set(cle, n)
  })
  return compte
}

/** Petits points sous un numéro de jour : un par rendez-vous jusqu'à `max`,
 *  puis un « + » qui dit « il y en a d'autres » sans mentir sur le nombre.
 *  Un chiffre exact ne tiendrait pas dans une case de 55 px à côté des points ;
 *  le détail est dans la liste du jour, un tap plus loin. */
export function pointsRendezVous(nombre: number, max = 3): { points: number; plus: boolean } {
  const n = Math.max(0, Math.floor(nombre))
  return { points: Math.min(n, max), plus: n > max }
}
