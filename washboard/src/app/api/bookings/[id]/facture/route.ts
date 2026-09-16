import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { createAdminClient } from '@/lib/supabase/admin'
import { emettreFacture } from '@/lib/emettreFacture'
import { phraseManques, doitEnvoyerFactureAuClient } from '@/lib/facture'
import { sendFacture } from '@/lib/email'
import { logger } from '@/lib/logger'

// Émission à la demande du laveur : pour un rendez-vous terminé avant qu'il
// ait rempli ses informations de facturation. Le passage en « Terminé »
// l'émet déjà automatiquement quand elles sont complètes.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { data: reservation, error } = await supabase
    .from('bookings')
    .select('id, status, client_name, client_email, is_professional')
    .eq('id', id)
    .eq('washer_id', washerId)
    .maybeSingle()

  if (error) {
    logger.error('facture.demande.read_failed', { bookingId: id }, error)
    return NextResponse.json({ error: 'Impossible de lire ce rendez-vous. Réessayez dans un instant.' }, { status: 503 })
  }
  if (!reservation) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  if (reservation.status !== 'done') {
    return NextResponse.json({ error: 'La facture s\'émet une fois la prestation terminée.' }, { status: 409 })
  }

  const resultat = await emettreFacture(createAdminClient(), id)
  if (resultat.ok) {
    // Même envoi qu'au passage en « Terminé » : sans lui, le client
    // professionnel d'un laveur qui complète ses informations de facturation
    // après coup ne recevait jamais sa facture.
    if (doitEnvoyerFactureAuClient(reservation, resultat)) {
      const { data: washer } = await supabase
        .from('washers').select('name').eq('id', washerId).single()
      await sendFacture({
        to: reservation.client_email as string,
        clientName: reservation.client_name as string,
        washerName: washer?.name ?? '',
        numero: resultat.numero,
        bookingId: id,
      }).catch(e => logger.error('facture.demande.email_failed', { bookingId: id }, e))
    }
    return NextResponse.json({ numero: resultat.numero })
  }
  if (resultat.raison === 'infos_incompletes') {
    return NextResponse.json({ error: phraseManques(resultat.manques) }, { status: 422 })
  }
  return NextResponse.json({ error: 'L\'émission de la facture a échoué. Réessayez dans un instant.' }, { status: 500 })
}
