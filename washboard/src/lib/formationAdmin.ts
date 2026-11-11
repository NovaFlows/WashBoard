import type { NiveauFormation, TypeLecon } from '@/lib/formation'

// Validation des écritures d'administration de la formation (branche feat/formation, 2026-11-11).
// Tout ce qui arrive du navigateur est nettoyé ici avant d'atteindre la base : longueurs bornées,
// valeurs autorisées, entiers positifs. Pur, donc testable.

const NIVEAUX: NiveauFormation[] = ['debutant', 'intermediaire', 'avance']
const TYPES: TypeLecon[] = ['video', 'lecture', 'quiz']
const BORNE_PRIX = 10_000_000 // 100 000 € en centimes : au-delà, c'est une faute de frappe
const BORNE_DUREE = 24 * 3600

export const BUCKET_VIDEOS = 'formation-videos'
export const TAILLE_MAX_VIDEO_MO = 2048
export const TYPES_VIDEO_ACCEPTES = ['video/mp4', 'video/webm', 'video/quicktime']

const texte = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.trim().slice(0, max) : null)
const entier = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null
}

/** « Le lavage à domicile : les bases » → `le-lavage-a-domicile-les-bases`. */
export function slugDe(titre: string): string {
  return (
    titre
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'formation'
  )
}

export type ChampsPack = {
  titre?: string
  accroche?: string
  description?: string
  niveau?: NiveauFormation
  prix_cents?: number
  statut?: 'disponible' | 'bientot'
  objectifs?: string[]
  publie?: boolean
  ordre?: number
}

/** Ne garde que les champs valides d'un pack ; `null` si le titre fourni est vide. */
export function nettoyerPack(brut: unknown): ChampsPack | null {
  if (!brut || typeof brut !== 'object') return null
  const b = brut as Record<string, unknown>
  const out: ChampsPack = {}
  if ('titre' in b) {
    const t = texte(b.titre, 120)
    if (!t) return null
    out.titre = t
  }
  if ('accroche' in b) out.accroche = texte(b.accroche, 200) ?? ''
  if ('description' in b) out.description = texte(b.description, 2000) ?? ''
  if (typeof b.niveau === 'string' && NIVEAUX.includes(b.niveau as NiveauFormation)) out.niveau = b.niveau as NiveauFormation
  if ('prix_cents' in b) {
    const p = entier(b.prix_cents, 0, BORNE_PRIX)
    if (p !== null) out.prix_cents = p
  }
  if (b.statut === 'disponible' || b.statut === 'bientot') out.statut = b.statut
  if (Array.isArray(b.objectifs)) out.objectifs = b.objectifs.map(o => texte(o, 140)).filter((o): o is string => !!o).slice(0, 6)
  if (typeof b.publie === 'boolean') out.publie = b.publie
  if ('ordre' in b) {
    const o = entier(b.ordre, 0, 9999)
    if (o !== null) out.ordre = o
  }
  return out
}

export type ChampsLecon = {
  titre?: string
  module_titre?: string
  module_ordre?: number
  ordre?: number
  type?: TypeLecon
  duree_sec?: number
  apercu_gratuit?: boolean
}

export function nettoyerLecon(brut: unknown): ChampsLecon | null {
  if (!brut || typeof brut !== 'object') return null
  const b = brut as Record<string, unknown>
  const out: ChampsLecon = {}
  if ('titre' in b) {
    const t = texte(b.titre, 140)
    if (!t) return null
    out.titre = t
  }
  if ('module_titre' in b) out.module_titre = texte(b.module_titre, 100) || 'Leçons'
  if ('module_ordre' in b) {
    const o = entier(b.module_ordre, 0, 999)
    if (o !== null) out.module_ordre = o
  }
  if ('ordre' in b) {
    const o = entier(b.ordre, 0, 9999)
    if (o !== null) out.ordre = o
  }
  if (typeof b.type === 'string' && TYPES.includes(b.type as TypeLecon)) out.type = b.type as TypeLecon
  if ('duree_sec' in b) {
    const d = entier(b.duree_sec, 0, BORNE_DUREE)
    if (d !== null) out.duree_sec = d
  }
  if (typeof b.apercu_gratuit === 'boolean') out.apercu_gratuit = b.apercu_gratuit
  return out
}

/** Chemin de stockage d'une vidéo : rangé par leçon, nom assaini (jamais celui du fichier tel quel). */
export function cheminVideo(leconId: string, nomFichier: string, maintenant = Date.now()): string {
  const ext = (nomFichier.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'mp4').toLowerCase()
  return `${leconId}/${maintenant}.${ext}`
}
