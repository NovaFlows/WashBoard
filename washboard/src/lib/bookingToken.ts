import { createHmac, timingSafeEqual } from 'crypto'
import { logger } from '@/lib/logger'

// Clé d'accès au PDF d'une réservation, distincte de son id.
//
// L'id seul ne suffit plus : le laveur le voit dans son tableau de bord, y
// compris pour une réservation verrouillée (au-delà du quota), et
// `/api/bookings/[id]/pdf` lui rendait alors nom, téléphone, adresse, heure et
// prix — tout ce que le masquage retient ailleurs. Ce jeton ne part que vers le
// client : l'écran de fin de réservation et les emails qui lui sont adressés.
//
// Rien n'est stocké en base : il se recalcule depuis l'id. Changer la clé
// invalide donc d'un coup tous les liens déjà envoyés — à réserver à une fuite.

function cle(): string | null {
  const secret = process.env.BOOKING_LINK_SECRET
  if (!secret) {
    // Sans clé, aucun jeton n'est émis ni accepté : le masquage tient, mais le
    // client d'une réservation verrouillée ne peut plus ouvrir son PDF. Ce repli
    // ne doit jamais passer inaperçu.
    logger.error('bookings.jeton.secret_missing')
    return null
  }
  return secret
}

export function genererJetonReservation(bookingId: string): string | null {
  const secret = cle()
  if (!secret) return null
  return createHmac('sha256', secret).update(bookingId).digest('base64url')
}

export function jetonValide(bookingId: string, jeton: string | null | undefined): boolean {
  if (!jeton) return false
  const attendu = genererJetonReservation(bookingId)
  if (!attendu) return false
  const recu = Buffer.from(jeton)
  const ref = Buffer.from(attendu)
  // `timingSafeEqual` lève une exception sur deux longueurs différentes ; celle
  // d'un jeton valide n'a rien de secret, la comparer d'abord ne livre rien.
  return recu.length === ref.length && timingSafeEqual(recu, ref)
}
