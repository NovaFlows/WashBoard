import { z } from 'zod'

// Prestation en centre auto (demande d'un client, 2026-11-01) : un laveur qui a un local
// peut recevoir ses clients sur place, en plus ou à la place du déplacement à domicile.
// Réglages rangés dans `washers.centre_auto` (jsonb), le lieu choisi dans `bookings.lieu`.
// Sans réglage, ou centre sans adresse : à domicile seulement, comme avant.

export type Lieu = 'domicile' | 'centre'
export type LieuxProposes = 'domicile' | 'centre' | 'les_deux'

export const ReglagesCentreAutoSchema = z.object({
  actif: z.boolean(),
  adresse: z.string().trim().max(300).default(''),
  lieux: z.enum(['domicile', 'centre', 'les_deux']).default('les_deux'),
}).refine(r => !r.actif || r.adresse.length >= 5, {
  message: 'Indiquez l’adresse de votre centre auto.',
  path: ['adresse'],
})

export type ReglagesCentreAuto = z.infer<typeof ReglagesCentreAutoSchema>

/** Ce que la page de réservation propose. `null` = à domicile seulement (cas par défaut). */
export type CentreAutoPublic = { adresse: string; domicile: boolean }

/** Lit la colonne brute : `null` dès que le centre ne doit pas apparaître côté client. */
export function centreAutoPublic(brut: unknown): CentreAutoPublic | null {
  const r = ReglagesCentreAutoSchema.safeParse(brut)
  if (!r.success || !r.data.actif || r.data.lieux === 'domicile') return null
  return { adresse: r.data.adresse, domicile: r.data.lieux === 'les_deux' }
}

/** Le lieu demandé est-il proposé par ce laveur ? */
export function lieuAccepte(centre: CentreAutoPublic | null, lieu: Lieu): boolean {
  return lieu === 'centre' ? centre !== null : centre === null || centre.domicile
}

/** Lieu coché à l'ouverture de la page : à domicile dès qu'il est proposé. */
export function lieuParDefaut(centre: CentreAutoPublic | null): Lieu {
  return centre && !centre.domicile ? 'centre' : 'domicile'
}

/** Ligne de la feuille « Mon profil ». */
export function resumeCentreAuto(brut: unknown): string {
  const r = ReglagesCentreAutoSchema.safeParse(brut)
  if (!r.success || !r.data.actif) return 'Non'
  if (r.data.lieux === 'domicile') return 'Oui · page : à domicile seulement'
  if (r.data.lieux === 'centre') return 'Oui · page : en centre auto seulement'
  return 'Oui · page : à domicile et en centre auto'
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
