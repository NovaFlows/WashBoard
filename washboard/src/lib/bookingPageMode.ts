import { z } from 'zod'

export const BookingPageModeSchema = z.enum(['default', 'custom'])
export type BookingPageMode = z.infer<typeof BookingPageModeSchema>

/** Une fiche nouvelle ou sans choix explicite utilise la nouvelle page.
 *
 *  Politique de bascule décidée par Alexandre, 2026-10-04 : les laveurs déjà
 *  inscrits gardent leur page personnalisée (ils peuvent activer la nouvelle
 *  page quand ils veulent, via la case « Page par défaut » de leurs
 *  réglages) ; les nouvelles inscriptions démarrent directement sur la
 *  nouvelle page (voir api/auth/signup/route.ts, `booking_page_mode:
 *  'default'` écrit explicitement à la création) et peuvent la désactiver
 *  pour personnaliser.
 *
 *  Pour que cette règle tienne, la colonne doit refléter le bon choix par
 *  défaut AU MOMENT de chaque inscription — c'est elle, et elle seule, qui
 *  décide ensuite ce qui s'affiche ici, sans liste d'exception dans le code.
 *  (Historique : du 2026-10-03 au 2026-10-04, une liste `COMPTES_TEST_...`
 *  limitait la nouvelle page à deux comptes de test le temps de vérifier
 *  qu'elle ne faisait perdre la personnalisation de personne — retirée une
 *  fois les 24 comptes existants ramenés à `custom` en base.) */
export function bookingPageMode(value: unknown): BookingPageMode {
  return value === 'custom' ? 'custom' : 'default'
}
