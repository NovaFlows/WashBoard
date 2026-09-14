import { unzipSync } from 'fflate'

/** Ouverture, dans le navigateur, d'un ZIP de factures déjà faites.
 *
 *  Le ZIP ne transite jamais par notre serveur : sur Vercel, une requête ne
 *  peut pas dépasser 4,5 Mo. Il est ouvert ici, chez le laveur, et chaque
 *  facture part ensuite seule, directement dans le stockage privé.
 *
 *  Les limites protègent d'abord le laveur lui-même : un ZIP piégé, qui
 *  décompressé pèserait des gigaoctets, ferait planter son onglet. */

export const TYPES_ACCEPTES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export const LIMITES = {
  tailleFichier: 10 * 1024 * 1024,
  tailleTotale: 100 * 1024 * 1024,
  nombreFichiers: 200,
}

export type FichierExtrait = { nom: string; type: string; donnees: Uint8Array }
export type ResultatZip = { fichiers: FichierExtrait[]; ignores: string[] }

export function extension(nom: string): string {
  return (/\.([a-z0-9]+)$/i.exec(nom)?.[1] ?? '').toLowerCase()
}

/** Nom affiché d'une entrée de ZIP : sans les dossiers qui la contiennent. */
function nomCourt(chemin: string): string {
  return chemin.split('/').pop() ?? chemin
}

/** Les fichiers système qu'un Mac ou Windows glisse dans un ZIP ne sont pas des factures. */
function estFichierSysteme(chemin: string): boolean {
  const nom = nomCourt(chemin)
  return chemin.startsWith('__MACOSX/') || nom.startsWith('.') || nom.toLowerCase() === 'thumbs.db' || chemin.endsWith('/')
}

export function extraireZip(zip: Uint8Array): ResultatZip {
  const ignores: string[] = []
  let total = 0
  let nombre = 0

  // Le filtre s'exécute AVANT la décompression de chaque entrée, sur la taille
  // qu'elle annonce : c'est là qu'on refuse le volume excessif.
  const contenu = unzipSync(zip, {
    filter: f => {
      if (estFichierSysteme(f.name)) return false
      if (!TYPES_ACCEPTES[extension(f.name)]) { ignores.push(`${nomCourt(f.name)} : format non accepté`); return false }
      if (f.originalSize > LIMITES.tailleFichier) { ignores.push(`${nomCourt(f.name)} : plus de 10 Mo`); return false }
      if (nombre >= LIMITES.nombreFichiers) { ignores.push(`${nomCourt(f.name)} : plus de ${LIMITES.nombreFichiers} fichiers`); return false }
      if (total + f.originalSize > LIMITES.tailleTotale) { ignores.push(`${nomCourt(f.name)} : ZIP de plus de 100 Mo`); return false }
      total += f.originalSize
      nombre++
      return true
    },
  })

  const fichiers = Object.entries(contenu)
    // Double contrôle après décompression : une taille annoncée peut mentir.
    .filter(([chemin, donnees]) => {
      if (donnees.length > LIMITES.tailleFichier) { ignores.push(`${nomCourt(chemin)} : plus de 10 Mo`); return false }
      return true
    })
    .map(([chemin, donnees]) => ({ nom: nomCourt(chemin), type: TYPES_ACCEPTES[extension(chemin)], donnees }))

  return { fichiers, ignores }
}
