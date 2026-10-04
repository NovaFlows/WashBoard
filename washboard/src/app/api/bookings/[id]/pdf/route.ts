import { createAdminClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import BookingPDF from '@/components/pdf/BookingPDF'
import FacturePDF from '@/components/pdf/FacturePDF'
import type { FactureContenu } from '@/lib/facture'
import { logoPourPdf } from '@/lib/logoFacture'
import { FUSEAU } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'
import { quotaReservations } from '@/lib/plan'
import { estVerrouillee, seuilsVerrouillage } from '@/lib/reservationsVerrouillees'
import { jetonValide } from '@/lib/bookingToken'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jeton = new URL(req.url).searchParams.get('jeton')

  // Route publique (le client télécharge sa confirmation sans être authentifié).
  // La RLS interdit la lecture de `bookings` à l'anon → service-role, ciblé sur
  // l'id exact.
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

  // L'id seul n'ouvre plus une réservation verrouillée : le laveur le voit dans
  // son tableau de bord. Le jeton, lui, n'est remis qu'au client (voir
  // bookingToken). Une facture déjà émise reste servie sans condition : le
  // client doit pouvoir la retrouver, y compris par un lien envoyé avant le
  // jeton, et le laveur l'a de toute façon établie lui-même.
  if (!facture && !jetonValide(id, jeton)) {
    const { data: laveur, error: errLaveur } = await supabase
      .from('washers')
      .select('id, plan, grandfathered, created_at, subscription_status, trial_ends_at, subscription_ends_at, slug')
      .eq('id', booking.washer_id)
      .single()
    if (errLaveur || !laveur) {
      logger.error('bookings.id.pdf.washer.read_failed', { bookingId: id }, errLaveur)
      return new Response('Not found', { status: 404 })
    }
    const seuils = await seuilsVerrouillage(supabase, laveur, quotaReservations(laveur))
    if (estVerrouillee(booking, seuils)) return new Response('Not found', { status: 404 })
  }

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
      // Le lien est public (le client télécharge sans compte). Un robot ne
      // devine pas cette adresse, mais il suffit qu'un client colle son lien
      // sur un forum pour qu'un moteur la suive : la facture — SIRET, adresses,
      // montant — deviendrait alors trouvable par une recherche. Cette consigne
      // l'interdit. Elle ne restreint aucun accès : qui a le lien ouvre le
      // document comme avant.
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}
