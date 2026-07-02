import { createAdminClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import BookingPDF from '@/components/pdf/BookingPDF'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Route publique (le client télécharge sa confirmation sans être authentifié).
  // La RLS interdit la lecture de `bookings` à l'anon → service-role, ciblé sur
  // l'id exact (UUID = jeton d'accès).
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, services(name), washers(name, phone)')
    .eq('id', id)
    .single()

  if (!booking) return new Response('Not found', { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(BookingPDF, { booking }) as any)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="confirmation-${booking.id.slice(0, 8).toUpperCase()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
