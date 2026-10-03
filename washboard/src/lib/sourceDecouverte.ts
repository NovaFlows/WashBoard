import { z } from 'zod'

// Comment le CLIENT a connu le laveur — demandé une fois sur l'écran de
// confirmation, juste après la réservation (voir StepConfirmation).
//
// À ne pas confondre avec `SOURCES_ACQUISITION` (lib/onboarding.ts) : cette
// liste-là répond à une question différente, « comment LE LAVEUR a connu
// WashBoard ? », posée au laveur lui-même à son inscription. Deux publics,
// deux moments, deux colonnes (`washers.acquisition_source` vs
// `bookings.source_decouverte`) — rien ne les relie.
export const SOURCES_DECOUVERTE = [
  { valeur: 'bouche_a_oreille', label: 'Bouche-à-oreille' },
  // Souvent la toute première source d'un laveur mobile, et jusqu'ici
  // invisible : personne ne coche « j'ai vu la camionnette » nulle part.
  { valeur: 'camionnette',      label: 'J’ai vu la camionnette' },
  { valeur: 'instagram',        label: 'Instagram' },
  { valeur: 'tiktok',           label: 'TikTok' },
  { valeur: 'google',           label: 'Google' },
  { valeur: 'autre',            label: 'Autre' },
] as const

export type SourceDecouverte = (typeof SOURCES_DECOUVERTE)[number]['valeur']

const VALEURS = SOURCES_DECOUVERTE.map(s => s.valeur) as [SourceDecouverte, ...SourceDecouverte[]]

/** Schéma de validation serveur : une liste fermée, jamais une chaîne libre —
 *  c'est ce qui permet d'agréger la réponse plus tard sans avoir à nettoyer du
 *  texte saisi à la main. */
export const SourceDecouverteSchema = z.enum(VALEURS)

export function estSourceDecouverte(valeur: unknown): valeur is SourceDecouverte {
  return SourceDecouverteSchema.safeParse(valeur).success
}

export function libelleSourceDecouverte(valeur: SourceDecouverte): string {
  return SOURCES_DECOUVERTE.find(s => s.valeur === valeur)?.label ?? valeur
}
