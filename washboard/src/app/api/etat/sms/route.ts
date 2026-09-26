import { NextRequest, NextResponse } from 'next/server'
import { soldeSms, SEUIL_SMS_BAS } from '@/lib/sms'

export const dynamic = 'force-dynamic'

// Crédits SMS restants chez Brevo, pour la réunion d'équipe du matin.
//
// Pourquoi une route plutôt que de donner la clé Brevo à la routine : cette
// clé peut ENVOYER des SMS, donc dépenser de l'argent. Une routine qui tourne
// sans surveillance n'a aucune raison de la détenir pour afficher un nombre.
// Ici elle reste côté serveur, et la routine ne peut rien faire d'autre que
// lire ce solde.
//
// Pas non plus le `CRON_SECRET` : il déclenche les envois d'avis et de
// relances. Un jeton distinct, qui n'ouvre que cette lecture.
//
// Pas public non plus : le solde est une information d'exploitation, et
// appeler Brevo à chaque passage d'un robot n'aurait aucun sens.

export async function GET(request: NextRequest) {
  const attendu = process.env.ETAT_TOKEN

  if (!attendu) {
    // Dit explicitement que la mesure est indisponible plutôt que de renvoyer
    // un zéro : « 0 crédit » et « je ne sais pas » appellent des réactions
    // opposées, et la réunion du matin doit pouvoir écrire « signal manquant ».
    return NextResponse.json(
      { error: 'ETAT_TOKEN non configuré sur le serveur' },
      { status: 503 },
    )
  }

  const fourni = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (fourni !== attendu) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const credits = await soldeSms()

  if (credits === null) {
    return NextResponse.json(
      { error: 'Solde Brevo illisible', credits: null },
      { status: 502 },
    )
  }

  return NextResponse.json({
    credits,
    seuilBas: SEUIL_SMS_BAS,
    bas: credits <= SEUIL_SMS_BAS,
    ts: new Date().toISOString(),
  })
}
