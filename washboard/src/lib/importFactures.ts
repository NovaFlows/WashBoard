import { LIMITES } from '@/lib/zipFactures'

/** Règles des factures importées : celles qu'un laveur a faites ailleurs,
 *  avant WashBoard, et qu'il range dans son onglet Factures.
 *
 *  Tout ce qui arrive du navigateur est vérifié ici, côté serveur : un chemin
 *  de fichier qui ne serait pas dans le dossier du laveur connecté lui
 *  donnerait accès aux factures d'un autre. */

export const BUCKET_FACTURES_IMPORTEES = 'factures-importees'

const EXTENSION_PAR_TYPE: Record<string, 'pdf' | 'jpg' | 'png'> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export function extensionStockage(type: unknown): 'pdf' | 'jpg' | 'png' | null {
  return typeof type === 'string' ? EXTENSION_PAR_TYPE[type] ?? null : null
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** Le fichier est-il bien rangé dans le dossier de CE laveur, sous un nom que
 *  nous avons nous-mêmes attribué ? Tout le reste est refusé. */
export function cheminAppartient(chemin: unknown, washerId: string): chemin is string {
  return typeof chemin === 'string'
    && new RegExp(`^${UUID}/${UUID}\\.(pdf|jpg|png)$`).test(chemin)
    && chemin.startsWith(`${washerId}/`)
}

export type FactureImporteeSaisie = {
  chemin: string
  nomFichier: string
  typeFichier: string
  taille: number
  dateFacture: string
  montant: number | null
  numero: string | null
}

export function validerSaisie(
  brut: unknown,
  washerId: string,
  maintenant = new Date(),
): { ok: true; valeur: FactureImporteeSaisie } | { ok: false; erreur: string } {
  const b = (brut ?? {}) as Record<string, unknown>
  if (!cheminAppartient(b.chemin, washerId)) return { ok: false, erreur: 'Fichier introuvable dans votre espace.' }

  const nomFichier = typeof b.nomFichier === 'string' ? b.nomFichier.trim().slice(0, 200) : ''
  if (!nomFichier) return { ok: false, erreur: 'Nom de fichier manquant.' }
  if (!extensionStockage(b.typeFichier)) return { ok: false, erreur: `${nomFichier} : format non accepté.` }

  const taille = Number(b.taille)
  if (!Number.isInteger(taille) || taille <= 0 || taille > LIMITES.tailleFichier) {
    return { ok: false, erreur: `${nomFichier} : taille invalide.` }
  }

  const date = typeof b.dateFacture === 'string' ? b.dateFacture : ''
  const d = new Date(`${date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    return { ok: false, erreur: `${nomFichier} : date manquante ou invalide.` }
  }
  if (d.getUTCFullYear() < 2000 || d.getTime() > maintenant.getTime() + 86_400_000) {
    return { ok: false, erreur: `${nomFichier} : la date doit être passée.` }
  }

  let montant: number | null = null
  if (b.montant !== null && b.montant !== undefined && b.montant !== '') {
    const n = Number(b.montant)
    if (!Number.isFinite(n) || n < 0 || n >= 1_000_000) return { ok: false, erreur: `${nomFichier} : montant invalide.` }
    montant = Math.round(n * 100) / 100
  }

  const numero = typeof b.numero === 'string' && b.numero.trim() ? b.numero.trim().slice(0, 40) : null

  return {
    ok: true,
    valeur: { chemin: b.chemin, nomFichier, typeFichier: b.typeFichier as string, taille, dateFacture: date, montant, numero },
  }
}
