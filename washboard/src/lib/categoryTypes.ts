import type { CategoryType } from '@/types'

/** Nettoie les « types » d'une catégorie envoyés par le client (ex. « Citadine »,
 *  « SUV » pour la catégorie Voiture).
 *
 *  C'est une frontière de confiance : la charge vient du navigateur, donc rien
 *  n'y est supposé — ni la forme, ni les types, ni la présence des champs.
 *  Les entrées sans nom sont écartées plutôt que corrigées : un type vide
 *  apparaîtrait comme un bouton sans libellé sur la page de réservation.
 *
 *  Définie ici parce que les deux routes `/api/categories` (création et mise à
 *  jour) en avaient chacune une copie identique — deux endroits à corriger le
 *  jour où la règle change. */
export function sanitizeTypes(raw: unknown): CategoryType[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => {
      const obj = t as { id?: unknown; name?: unknown }
      const name = typeof obj?.name === 'string' ? obj.name.trim() : ''
      // Un identifiant absent ou non textuel est régénéré : sans identifiant
      // stable, les prestations rattachées à ce type perdraient leur lien.
      const id = typeof obj?.id === 'string' && obj.id ? obj.id : crypto.randomUUID()
      return { id, name }
    })
    .filter((t) => t.name.length > 0)
}
