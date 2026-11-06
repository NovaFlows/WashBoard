import { aujourdhuiParis } from '@/lib/suiviAppels'

// Zone « Prospects » de l'espace équipe (2026-11-06) : les laveurs qu'on démarche et
// qui n'ont pas (encore) de compte. Deux portes d'entrée :
//   - l'agent prospection, après chaque message Instagram envoyé (« contacte ») et
//     quand il voit une réponse (« reponse ») — route /api/prospects/flux, par jeton ;
//   - l'équipe, à la main (prospects eus au téléphone, à rappeler).
// C'est Alexandre qui juge une réponse positive ou négative : rien ne classe
// automatiquement. Les « non » restent, rangés à part — ils servent aussi à ne
// jamais recontacter quelqu'un qui a refusé.

export const STATUTS = ['contacte', 'a_repondu', 'interesse', 'en_discussion', 'pas_interesse', 'inscrit'] as const
export type StatutProspect = (typeof STATUTS)[number]

export const LIBELLE_STATUT: Record<StatutProspect, string> = {
  contacte: 'Contacté',
  a_repondu: 'A répondu',
  interesse: 'Intéressé',
  en_discussion: 'En discussion',
  pas_interesse: 'Pas intéressé',
  inscrit: 'Inscrit',
}

export const SOURCES = ['instagram', 'telephone', 'autre'] as const
export type SourceProspect = (typeof SOURCES)[number]

export type Prospect = {
  id: string
  instagram: string | null
  nom: string
  ville: string | null
  telephone: string | null
  statut: StatutProspect
  source: SourceProspect
  message: string | null
  reponse: string | null
  notes: string | null
  contacte_le: string | null
  repondu_le: string | null
  relancer_le: string | null
  created_at: string
  updated_at: string
}

/** Un message resté sans réponse passe aux archives au bout de ce délai. */
export const ARCHIVE_APRES_JOURS = 30

export const LONGUEURS = { nom: 120, ville: 80, telephone: 30, texte: 2000 } as const

/** « @Mon.Compte », « instagram.com/mon.compte/?hl=fr » → « mon.compte ». Null si ce n'est pas un nom de compte. */
export function normaliserInstagram(v: unknown): string | null {
  if (typeof v !== 'string') return null
  let s = v.trim().toLowerCase()
  const url = s.match(/instagram\.com\/([^/?#\s]+)/)
  if (url) s = url[1]
  s = s.replace(/^@+/, '').replace(/\/+$/, '')
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null
}

const texte = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

function dateJour(v: unknown): { ok: true; valeur: string | null } | { ok: false } {
  if (v == null || v === '') return { ok: true, valeur: null }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return { ok: false }
  return { ok: true, valeur: v }
}

/** Horodatage envoyé par l'agent ; absent, illisible ou dans le futur → maintenant. */
function horodatage(v: unknown, now: Date): string {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isNaN(t) || t > now.getTime() + 36e5 ? now.toISOString() : new Date(t).toISOString()
}

// ── Saisie de l'équipe ───────────────────────────────────────────────────────

type ChampsModifiables = Partial<Pick<Prospect, 'nom' | 'instagram' | 'telephone' | 'ville' | 'notes' | 'statut' | 'relancer_le'>>

/** Champs envoyés par l'écran (création ou modification). `creation` exige un nom. */
export function validerSaisie(corps: unknown, creation: boolean): { erreur: string } | { champs: ChampsModifiables } {
  const c = (corps ?? {}) as Record<string, unknown>
  const champs: ChampsModifiables = {}
  if (creation || 'nom' in c) {
    const nom = texte(c.nom, LONGUEURS.nom)
    if (!nom) return { erreur: 'Indiquez au moins un nom.' }
    champs.nom = nom
  }
  if ('instagram' in c) {
    if (c.instagram == null || c.instagram === '') champs.instagram = null
    else {
      const ig = normaliserInstagram(c.instagram)
      if (!ig) return { erreur: 'Compte Instagram invalide.' }
      champs.instagram = ig
    }
  }
  if ('telephone' in c) champs.telephone = texte(c.telephone, LONGUEURS.telephone)
  if ('ville' in c) champs.ville = texte(c.ville, LONGUEURS.ville)
  if ('notes' in c) champs.notes = texte(c.notes, LONGUEURS.texte)
  if ('statut' in c || creation) {
    const statut = c.statut ?? 'en_discussion'
    if (!STATUTS.includes(statut as StatutProspect)) return { erreur: 'Étape inconnue.' }
    champs.statut = statut as StatutProspect
  }
  if ('relancer_le' in c) {
    const d = dateJour(c.relancer_le)
    if (!d.ok) return { erreur: 'Date de rappel invalide.' }
    champs.relancer_le = d.valeur
  }
  return { champs }
}

// ── Flux de l'agent prospection ──────────────────────────────────────────────

export type Evenement =
  | { type: 'contacte'; instagram: string; nom: string | null; message: string | null; ville: string | null; le: string }
  | { type: 'reponse'; instagram: string; reponse: string | null; le: string }
  | { type: 'ajout'; instagram: string | null; nom: string; telephone: string | null; ville: string | null; notes: string | null; relancer_le: string | null; statut: StatutProspect }

export function validerEvenement(v: unknown, now: Date = new Date()): { erreur: string } | { evenement: Evenement } {
  const e = (v ?? {}) as Record<string, unknown>
  if (e.type === 'contacte' || e.type === 'reponse') {
    const instagram = normaliserInstagram(e.instagram)
    if (!instagram) return { erreur: 'instagram manquant ou invalide' }
    const le = horodatage(e.le, now)
    return e.type === 'contacte'
      ? { evenement: { type: 'contacte', instagram, nom: texte(e.nom, LONGUEURS.nom), message: texte(e.message, LONGUEURS.texte), ville: texte(e.ville, LONGUEURS.ville), le } }
      : { evenement: { type: 'reponse', instagram, reponse: texte(e.reponse, LONGUEURS.texte), le } }
  }
  if (e.type === 'ajout') {
    const nom = texte(e.nom, LONGUEURS.nom)
    if (!nom) return { erreur: 'nom manquant' }
    let instagram: string | null = null
    if (e.instagram != null && e.instagram !== '') {
      instagram = normaliserInstagram(e.instagram)
      if (!instagram) return { erreur: 'instagram invalide' }
    }
    const statut = e.statut ?? 'en_discussion'
    if (!STATUTS.includes(statut as StatutProspect)) return { erreur: 'statut inconnu' }
    const d = dateJour(e.relancer_le)
    if (!d.ok) return { erreur: 'relancer_le invalide (AAAA-MM-JJ)' }
    return { evenement: { type: 'ajout', instagram, nom, telephone: texte(e.telephone, LONGUEURS.telephone), ville: texte(e.ville, LONGUEURS.ville), notes: texte(e.notes, LONGUEURS.texte), relancer_le: d.valeur, statut: statut as StatutProspect } }
  }
  return { erreur: 'type inconnu (contacte, reponse ou ajout)' }
}

export type Ligne = Omit<Prospect, 'id' | 'created_at' | 'updated_at'>
export type Effet = { creer: Ligne } | { modifier: Partial<Ligne> } | { rien: string }

/** Ce qu'un événement change, selon ce qu'on sait déjà du prospect. Ne fait jamais
 *  reculer l'étape choisie par l'équipe, ne remplace jamais un champ saisi à la main. */
export function appliquerEvenement(existant: Prospect | null, ev: Evenement): Effet {
  const vide: Ligne = { instagram: null, nom: '', ville: null, telephone: null, statut: 'contacte', source: 'instagram', message: null, reponse: null, notes: null, contacte_le: null, repondu_le: null, relancer_le: null }

  if (ev.type === 'contacte') {
    if (!existant) return { creer: { ...vide, instagram: ev.instagram, nom: ev.nom ?? ev.instagram, ville: ev.ville, message: ev.message, contacte_le: ev.le } }
    const m: Partial<Ligne> = {}
    if (!existant.contacte_le) m.contacte_le = ev.le
    if (!existant.message && ev.message) m.message = ev.message
    if (!existant.ville && ev.ville) m.ville = ev.ville
    if (existant.nom === existant.instagram && ev.nom) m.nom = ev.nom
    return Object.keys(m).length ? { modifier: m } : { rien: 'déjà connu' }
  }

  if (ev.type === 'reponse') {
    if (!existant) return { creer: { ...vide, instagram: ev.instagram, nom: ev.instagram, statut: 'a_repondu', reponse: ev.reponse, repondu_le: ev.le } }
    if (existant.repondu_le && Date.parse(existant.repondu_le) >= Date.parse(ev.le) && existant.reponse === ev.reponse) return { rien: 'réponse déjà connue' }
    const m: Partial<Ligne> = { repondu_le: ev.le }
    if (ev.reponse) m.reponse = ev.reponse
    // Un contacté qui répond, ou un « non » qui revient : à trier de nouveau.
    if (existant.statut === 'contacte' || existant.statut === 'pas_interesse') m.statut = 'a_repondu'
    return { modifier: m }
  }

  // ajout (prospect eu au téléphone, transmis à l'agent suivi client)
  if (!existant) return { creer: { ...vide, instagram: ev.instagram, nom: ev.nom, telephone: ev.telephone, ville: ev.ville, notes: ev.notes, relancer_le: ev.relancer_le, statut: ev.statut, source: ev.instagram ? 'instagram' : 'telephone' } }
  const m: Partial<Ligne> = { statut: ev.statut }
  if (ev.relancer_le) m.relancer_le = ev.relancer_le
  if (ev.telephone && !existant.telephone) m.telephone = ev.telephone
  if (ev.ville && !existant.ville) m.ville = ev.ville
  if (ev.notes) m.notes = existant.notes ? `${existant.notes}\n${ev.notes}`.slice(0, LONGUEURS.texte) : ev.notes
  if (existant.nom === existant.instagram) m.nom = ev.nom
  return { modifier: m }
}

// ── Rangement à l'écran ──────────────────────────────────────────────────────

export const ONGLETS = ['trier', 'discussion', 'interesses', 'contactes', 'non', 'inscrits', 'archives'] as const
export type Onglet = (typeof ONGLETS)[number]

export const LIBELLE_ONGLET: Record<Onglet, string> = {
  trier: 'À trier',
  discussion: 'En discussion',
  interesses: 'Intéressés',
  contactes: 'Contactés',
  non: 'Pas intéressés',
  inscrits: 'Inscrits',
  archives: 'Archivés',
}

export function estArchive(p: Prospect, now: Date): boolean {
  if (p.statut !== 'contacte') return false
  const depuis = Date.parse(p.contacte_le ?? p.created_at)
  return now.getTime() - depuis > ARCHIVE_APRES_JOURS * 864e5
}

export function ongletDe(p: Prospect, now: Date): Onglet {
  switch (p.statut) {
    case 'a_repondu': return 'trier'
    case 'en_discussion': return 'discussion'
    case 'interesse': return 'interesses'
    case 'pas_interesse': return 'non'
    case 'inscrit': return 'inscrits'
    default: return estArchive(p, now) ? 'archives' : 'contactes'
  }
}

/** Rappel prévu aujourd'hui ou en retard (en discussion ou intéressé). */
export function rappelDu(p: Prospect, now: Date): boolean {
  return (p.statut === 'en_discussion' || p.statut === 'interesse') && !!p.relancer_le && p.relancer_le <= aujourdhuiParis(now)
}

export function resumerProspects(prospects: Prospect[], now: Date) {
  return {
    total: prospects.length,
    aTrier: prospects.filter(p => p.statut === 'a_repondu').length,
    aRappeler: prospects.filter(p => rappelDu(p, now)).length,
  }
}
