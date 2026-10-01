import type { SetupItem } from '@/lib/setupProgress'

/** Ce que le laveur a choisi de ne plus voir dans la carte de configuration.
 *
 *  Le besoin (Alexandre, 2026-09-27) : « si il clique dessus mais qu'il a pas fait, par exemple
 *  relance client et Google avis, les liens disparaissent — ça veut juste dire qu'il ne veut
 *  pas le faire ». Autrement dit, ouvrir un réglage facultatif et ne pas le remplir vaut
 *  réponse : « pas pour moi ».
 *
 *  Trois règles tiennent l'ensemble :
 *
 *  1. le POURCENTAGE ne bouge pas. Masquer n'est pas faire : la barre reste à 80 %, et c'est
 *     honnête — sa page n'a pas gagné ce que ces réglages apportent ;
 *  2. seuls les réglages de CONFORT se masquent. Sans prestations, sans horaires, sans
 *     adresse, la page ne peut pas prendre de rendez-vous : cacher ça rendrait le compte muet
 *     sans que rien ne le dise ;
 *  3. rien ne disparaît pour de bon. Une ligne annonce combien de réglages sont masqués, et
 *     la toucher les fait revenir — sinon le laveur ne saurait plus pourquoi il n'est pas
 *     à 100 %.
 */

export const CLE_MASQUES = 'wb-config-masques'
export const CLE_CARTE_CACHEE = 'wb-config-cachee'

/** Un réglage indispensable ne se masque pas : voir la règle 2 ci-dessus. */
export const peutEtreMasque = (item: SetupItem) => !item.essential && !item.blocking

export function lireMasques(brut: string | null): string[] {
  if (!brut) return []
  try {
    const liste = JSON.parse(brut)
    return Array.isArray(liste) ? liste.filter((c): c is string => typeof c === 'string') : []
  } catch {
    // Valeur abîmée (écriture d'une autre version) : on repart de rien plutôt que de planter.
    return []
  }
}

export const ecrireMasques = (cles: string[]): string => JSON.stringify([...new Set(cles)])

/** Ce que la carte montre : ce qui manque, moins ce que le laveur a écarté. */
export function reglagesAffiches(manques: SetupItem[], masques: string[]): SetupItem[] {
  return manques.filter(m => !masques.includes(m.key))
}

/** Combien de réglages manquants sont écartés — c'est ce nombre qui explique l'écart à 100 %. */
export function nombreMasques(manques: SetupItem[], masques: string[]): number {
  return manques.filter(m => masques.includes(m.key)).length
}

/** Une clé ne reste masquée que tant que le réglage manque encore : celui qui a été fait entre
 *  temps n'a plus à occuper la liste, et s'il redevient à faire un jour, il se remontre. */
export function nettoyerMasques(manques: SetupItem[], masques: string[]): string[] {
  const aFaire = new Set(manques.map(m => m.key))
  return masques.filter(c => aFaire.has(c))
}

export function phraseMasques(nombre: number): string {
  return nombre === 1
    ? '1 réglage non fait, masqué'
    : `${nombre} réglages non faits, masqués`
}
