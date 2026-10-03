import { z } from 'zod'

export const BookingPageModeSchema = z.enum(['default', 'custom'])
export type BookingPageMode = z.infer<typeof BookingPageModeSchema>

/** Une fiche nouvelle ou sans choix explicite utilise la nouvelle page. */
export function bookingPageMode(value: unknown): BookingPageMode {
  return value === 'custom' ? 'custom' : 'default'
}
