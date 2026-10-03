import { z } from 'zod'

export const BookingPageModeSchema = z.enum(['default', 'custom'])
export type BookingPageMode = z.infer<typeof BookingPageModeSchema>

/** Une fiche nouvelle ou sans choix explicite utilise la nouvelle page. */
export function bookingPageMode(value: unknown): BookingPageMode {
  return value === 'custom' ? 'custom' : 'default'
}

/** Comptes autorisés à voir la nouvelle page (accordéon) pendant qu'elle est
 *  testée — demande explicite d'Alexandre, 2026-10-03, après avoir repéré que
 *  `default` devenait automatiquement la page de TOUS les comptes existants,
 *  y compris payants, et qu'elle ignore encore leur couleur de marque et leur
 *  fond personnalisé (régression pour l'offre « page personnalisée »).
 *
 *  Tant que cette liste n'est pas vidée, tout le monde D'AUTRE reste sur
 *  l'ancienne page personnalisable, quelle que soit la valeur réellement
 *  enregistrée dans `booking_page_mode` — y compris s'ils ont explicitement
 *  coché/décoché la case dans leurs réglages : leur choix est gardé en base
 *  (rien n'est écrasé), simplement sans effet visible tant qu'ils ne sont pas
 *  dans cette liste. Même principe que `COMPTES_TEST_RETOUR_GRATUIT` dans
 *  lib/plan.ts : une bascule anticipée, compte par compte, dans le code —
 *  pas une variable d'environnement — pour rester lisible dans l'historique
 *  Git. */
export const COMPTES_TEST_NOUVELLE_PAGE_RESERVATION: string[] = [
  'test-config-15d2', // Test Config
  'autonettoyage',    // AutoNett (novaflows.pro@gmail.com)
]

/** Ce que CE compte doit réellement voir, compte tenu à la fois de son choix
 *  enregistré et de la liste de test ci-dessus. À utiliser à la place de
 *  `bookingPageMode()` seule partout où la page publique est rendue. */
export function bookingPageModeEffectif(slug: string, value: unknown): BookingPageMode {
  if (!COMPTES_TEST_NOUVELLE_PAGE_RESERVATION.includes(slug)) return 'custom'
  return bookingPageMode(value)
}
