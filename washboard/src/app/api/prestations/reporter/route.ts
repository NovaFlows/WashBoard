import { NextResponse } from 'next/server'
import { COOKIE_REPORT } from '@/lib/veilleReport'

/** « Plus tard » : on cesse de rediriger vers l'écran de choix.
 *
 *  Cookie de SESSION, sans date d'expiration : il disparaît quand le laveur
 *  ferme son navigateur, et la question revient à la visite suivante. Le
 *  retenir plus longtemps reviendrait à laisser quelqu'un oublier pour de bon
 *  que sa page de réservation n'affiche plus tout son catalogue.
 *
 *  Aucune écriture en base : reporter n'est pas une décision, c'est l'absence
 *  de décision. Rien à enregistrer. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_REPORT, '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
