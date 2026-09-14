import { createAdminClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import BookingPDF from '@/components/pdf/BookingPDF'
import FacturePDF from '@/components/pdf/FacturePDF'
import type { FactureContenu } from '@/lib/facture'
import { logoPourPdf } from '@/lib/logoFacture'
import { FUSEAU } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Route publique (le client télécharge sa confirmation sans être authentifié).
  // La RLS interdit la lecture de `bookings` à l'anon → service-role, ciblé sur
  // l'id exact (UUID = jeton d'accès).
  const supabase = createAdminClient()

  const { data: booking, error: errBooking } = await supabase
    .from('bookings')
    .select('*, services(name), washers(name, phone)')
    .eq('id', id)
    .single()

  if (errBooking) logger.error('bookings.id.pdf.booking.read_failed', {}, errBooking)

  if (!booking) return new Response('Not found', { status: 404 })

  // Une fois la facture émise (prestation terminée), le même lien sert la
  // facture ; avant, un récapitulatif qui ne se présente pas comme une facture.
  const facture = booking.facture_numero && booking.facture_contenu
    ? {
        numero: booking.facture_numero as string,
        emiseLe: booking.facture_emise_le as string,
        contenu: booking.facture_contenu as FactureContenu,
      }
    : null

  const document = facture
    ? createElement(FacturePDF, { ...facture, logo: await logoPourPdf(facture.contenu.vendeur.logoUrl) })
    : createElement(BookingPDF, { booking })

  // La date du rendez-vous dans le nom du fichier : c'est elle que le laveur
  // et son client cherchent en retrouvant une facture dans leurs téléchargements.
  const dateRdv = new Date(booking.scheduled_at).toLocaleDateString('en-CA', { timeZone: FUSEAU })
  const nomFichier = facture
    ? `facture-${facture.numero}-${dateRdv}.pdf`
    : `recapitulatif-${booking.id.slice(0, 8).toUpperCase()}.pdf`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(document as any)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Cache-Control': 'no-store',
    },
  })
}
