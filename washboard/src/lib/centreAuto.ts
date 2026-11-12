import { z } from 'zod'

// Prestation en centre auto (demande d'un client, 2026-11-01) : un laveur qui a un local
// peut recevoir ses clients sur place, en plus ou à la place du déplacement à domicile.
// Réglages rangés dans `washers.centre_auto` (jsonb), le lieu choisi dans `bookings.lieu`.
// Sans réglage, ou centre sans adresse : à domicile seulement, comme avant.

export type Lieu = 'domicile' | 'centre'
export type LieuxProposes = 'domicile' | 'centre' | 'les_deux'

// Plusieurs locaux (demande du 2026-11-12) : `centres` liste tous les centres (nom + adresse),
// `adresse` reste l'adresse du premier (celui par défaut) pour que tout ce qui lisait
// l'adresse unique continue de marcher. Sans `centres`, c'est l'ancien centre unique.
export const MAX_CENTRES = 10

export const CentreSchema = z.object({
  nom: z.string().trim().max(80).default(''),
  adresse: z.string().trim().max(300),
  // Identifiant stable (posé à l'enregistrement) : les prestations s'y rattachent, l'adresse
  // pouvant changer. Absent sur un centre enregistré avant le 2026-11-12.
  id: z.string().trim().max(40).optional(),
})

export type Centre = z.infer<typeof CentreSchema>

export const ReglagesCentreAutoSchema = z.object({
  actif: z.boolean(),
  adresse: z.string().trim().max(300).default(''),
  lieux: z.enum(['domicile', 'centre', 'les_deux']).default('les_deux'),
  centres: z.array(CentreSchema).max(MAX_CENTRES).default([]),
}).refine(r => !r.actif || centresDeReglages(r).length > 0, {
  message: 'Indiquez l’adresse de votre centre auto.',
  path: ['adresse'],
}).refine(r => !r.actif || r.centres.every(c => c.adresse.length >= 5), {
  message: 'Chaque centre auto doit avoir une adresse.',
  path: ['centres'],
})

export type ReglagesCentreAuto = z.infer<typeof ReglagesCentreAutoSchema>

/** Les centres d'un réglage : la liste, ou l'ancien centre unique (adresse seule). */
export function centresDeReglages(r: { adresse: string; centres?: Centre[] }): Centre[] {
  if (r.centres && r.centres.length > 0) return r.centres.filter(c => c.adresse.length >= 5)
  return r.adresse.length >= 5 ? [{ nom: '', adresse: r.adresse }] : []
}

export function nouvelIdentifiantCentre(): string {
  return globalThis.crypto.randomUUID().slice(0, 8)
}

/** Réglages à enregistrer : `adresse` suit toujours le premier centre. */
export function normaliserReglages(r: ReglagesCentreAuto): ReglagesCentreAuto {
  // Chaque centre garde son identifiant ; un nouveau centre en reçoit un.
  const centres = r.centres.filter(c => c.adresse.length > 0).map(c => (c.id ? c : { ...c, id: nouvelIdentifiantCentre() }))
  return { ...r, centres, adresse: centres[0]?.adresse ?? r.adresse }
}

/** Ce que la page de réservation propose. `null` = à domicile seulement (cas par défaut).
 *  `adresse` = celle du premier centre ; `centres` absent = un seul centre sans nom. */
export type CentreAutoPublic = { adresse: string; domicile: boolean; centres?: Centre[] }

/** Tous les centres proposés au client (au moins un). */
export function centresDe(centre: CentreAutoPublic): Centre[] {
  return centre.centres && centre.centres.length > 0 ? centre.centres : [{ nom: '', adresse: centre.adresse }]
}

// Prestation rattachée à certains centres seulement (`services.centres_ids`, identifiants de
// centres) : vide = tous. Des identifiants qui ne désignent plus aucun centre (centre supprimé)
// ne bloquent rien : la prestation reste proposée dans tous les centres.
export const MAX_CENTRES_PRESTATION = MAX_CENTRES

export function identifiantsCentresValides(brut: unknown): string[] | null {
  if (!Array.isArray(brut)) return null
  const ids = [...new Set(brut.filter((i): i is string => typeof i === 'string' && i.length > 0 && i.length <= 40))]
  return ids.length > 0 ? ids : null
}

export function identifiantsCentresAcceptables(brut: unknown): boolean {
  if (brut === undefined || brut === null) return true
  return Array.isArray(brut) && brut.length <= MAX_CENTRES_PRESTATION && brut.every(i => typeof i === 'string' && i.length > 0 && i.length <= 40)
}

/** Ce que voit le client pour cette prestation : seulement les centres où elle se fait. */
export function centreRestreint(centre: CentreAutoPublic | null | undefined, ids: string[] | null | undefined): CentreAutoPublic | null {
  if (!centre) return null
  const permis = identifiantsCentresValides(ids)
  if (!permis) return centre
  const gardes = centresDe(centre).filter(c => c.id && permis.includes(c.id))
  if (gardes.length === 0) return centre
  return { adresse: gardes[0].adresse, domicile: centre.domicile, centres: gardes }
}

/** Le centre dont c'est l'adresse (celle envoyée par la page) ; à défaut, le premier. Le
 *  serveur ne prend jamais une adresse libre : seulement l'une de celles du laveur. */
export function centreParAdresse(centre: CentreAutoPublic, adresse: string | null | undefined): Centre {
  const liste = centresDe(centre)
  const voulue = (adresse ?? '').trim()
  return liste.find(c => c.adresse === voulue) ?? liste[0]
}

/** Texte enregistré comme adresse du rendez-vous : « Nom · adresse », ou l'adresse seule. */
export function libelleCentre(c: Centre): string {
  return c.nom ? `${c.nom} · ${c.adresse}` : c.adresse
}

/** Lit la colonne brute : `null` dès que le centre ne doit pas apparaître côté client. */
export function centreAutoPublic(brut: unknown): CentreAutoPublic | null {
  const r = ReglagesCentreAutoSchema.safeParse(brut)
  if (!r.success || !r.data.actif || r.data.lieux === 'domicile') return null
  const centres = centresDeReglages(r.data)
  if (centres.length === 0) return null
  const base = { adresse: centres[0].adresse, domicile: r.data.lieux === 'les_deux' }
  // Un seul centre : même forme qu'avant ; la liste n'apparaît qu'à partir de deux.
  return centres.length > 1 ? { ...base, centres } : base
}

/** Le lieu demandé est-il proposé par ce laveur ? */
export function lieuAccepte(centre: CentreAutoPublic | null, lieu: Lieu): boolean {
  return lieu === 'centre' ? centre !== null : centre === null || centre.domicile
}

// Prestation limitée à un lieu (demande du 2026-11-12) : `services.lieu_restreint` vaut
// 'domicile' ou 'centre' ; vide = les deux. Elle croise ce que le laveur propose : une
// prestation « en centre » chez un laveur sans centre n'est réservable nulle part.
export type LieuRestreint = Lieu | null | undefined

/** Les lieux où cette prestation peut se faire, selon le centre du laveur et sa restriction. */
export function lieuxPossibles(centre: CentreAutoPublic | null | undefined, restreint: LieuRestreint): Lieu[] {
  const base: Lieu[] = !centre ? ['domicile'] : centre.domicile ? ['domicile', 'centre'] : ['centre']
  return restreint === 'domicile' || restreint === 'centre' ? base.filter(l => l === restreint) : base
}

/** Valeur lue en base ou reçue : seulement 'domicile' ou 'centre', sinon pas de restriction. */
export function lieuRestreintValide(v: unknown): Lieu | null {
  return v === 'domicile' || v === 'centre' ? v : null
}

export const CHOIX_LIEU_PRESTATION: { valeur: Lieu | null; libelle: string }[] = [
  { valeur: null, libelle: 'Les deux' },
  { valeur: 'domicile', libelle: 'En déplacement' },
  { valeur: 'centre', libelle: 'En centre auto' },
]

/** Lieu coché à l'ouverture de la page : à domicile dès qu'il est proposé. */
export function lieuParDefaut(centre: CentreAutoPublic | null): Lieu {
  return centre && !centre.domicile ? 'centre' : 'domicile'
}

export const CHOIX_LIEUX: { valeur: LieuxProposes; libelle: string; detail: string }[] = [
  { valeur: 'les_deux', libelle: 'Les deux', detail: 'Le client choisit. « À domicile » est coché par défaut.' },
  { valeur: 'domicile', libelle: 'À domicile seulement', detail: 'Votre page reste comme aujourd’hui.' },
  { valeur: 'centre', libelle: 'En centre auto seulement', detail: 'Le client vient à votre centre. Pas de frais de déplacement.' },
]

/** Ligne de la feuille « Mon profil ». */
export function resumeCentreAuto(brut: unknown): string {
  const r = ReglagesCentreAutoSchema.safeParse(brut)
  if (!r.success || !r.data.actif) return 'Non'
  const n = centresDeReglages(r.data).length
  const nb = n > 1 ? `${n} centres · ` : ''
  if (r.data.lieux === 'domicile') return `Oui · ${nb}page : à domicile seulement`
  if (r.data.lieux === 'centre') return `Oui · ${nb}page : en centre auto seulement`
  return `Oui · ${nb}page : à domicile et en centre auto`
}

/** Intitulé de l'adresse d'un rendez-vous (emails, reçu, agenda) : au centre, c'est celle
 *  du laveur, pas celle du client. Toute autre valeur (colonne absente) vaut domicile. */
export function libelleAdresse(lieu: unknown): string {
  return lieu === 'centre' ? 'Au centre auto' : 'Adresse'
}

/** L'adresse précédée de « Centre auto · » quand le client vient au centre. */
export function adresseAvecLieu(adresse: string, lieu: unknown): string {
  return lieu === 'centre' ? `Centre auto · ${adresse}` : adresse
}
