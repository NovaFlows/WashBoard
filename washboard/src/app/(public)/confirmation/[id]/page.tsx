import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function ConfirmationPage({ params }: Props) {
  const { id } = await params

  // Le client qui vient de réserver n'est PAS authentifié, or la RLS interdit la
  // lecture de `bookings` aux non-propriétaires (client anon → permission denied →
  // page introuvable). On lit donc via le service-role, en se limitant à l'id exact
  // (UUID imprévisible = jeton d'accès), jamais une liste.
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, services(name, duration_minutes), washers(name, phone, logo_url)')
    .eq('id', id)
    .single()

  if (!booking) notFound()

  const washer  = booking.washers as { name: string; phone: string | null; logo_url: string | null }
  const service = booking.services as { name: string; duration_minutes: number } | null

  const date         = new Date(booking.scheduled_at)
  const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const today         = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const ref           = booking.id.slice(0, 8).toUpperCase()

  const discount   = Number(booking.smart_discount ?? 0)
  const basePrice  = Number(booking.booked_price ?? 0)
  const finalPrice = booking.is_smart_slot && discount > 0 ? Math.max(0, basePrice - discount) : basePrice
  const finalStr   = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const baseStr    = Number.isInteger(basePrice) ? String(basePrice) : basePrice.toFixed(2)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 py-10 px-4 print:bg-white print:py-0">

        {/* Barre d'actions */}
        <div className="no-print max-w-[680px] mx-auto mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">Confirmation de réservation · Réf. <span className="font-mono font-semibold text-slate-700">{ref}</span></p>
          <a
            href={`/api/bookings/${booking.id}/pdf`}
            download={`confirmation-${ref}.pdf`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Télécharger PDF
          </a>
        </div>

        {/* Document */}
        <div className="print-page max-w-[680px] mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">

          {/* Barre supérieure */}
          <div className="bg-slate-900 px-10 py-3 flex justify-between items-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Reçu de prestation de service</span>
            <span className="text-xs text-slate-500 font-mono font-semibold">Réf. {ref}</span>
          </div>

          {/* En-tête */}
          <div className="px-10 pt-8 pb-6 flex justify-between items-start">
            <div>
              {washer.logo_url && (
                <img src={washer.logo_url} alt={washer.name} className="w-14 h-14 rounded-xl object-cover mb-3" />
              )}
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{washer.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">Prestataire de lavage automobile à domicile</p>
              {washer.phone && <p className="text-sm text-slate-500 mt-0.5">{washer.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Date d&apos;émission</p>
              <p className="text-sm font-semibold text-slate-600">{today}</p>
              <div className="mt-4 px-3 py-1.5 bg-slate-100 rounded-lg inline-block">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Référence</p>
                <p className="text-base font-mono font-bold text-slate-800">{ref}</p>
              </div>
            </div>
          </div>

          <div className="mx-10 border-t-2 border-slate-200" />

          {/* Prestataire / Client */}
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="px-10 py-5">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Prestataire</p>
              <p className="font-bold text-slate-900">{washer.name}</p>
              {washer.phone && <p className="text-sm text-slate-500 mt-0.5">{washer.phone}</p>}
            </div>
            <div className="px-10 py-5">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Client</p>
              <p className="font-bold text-slate-900">{booking.client_name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{booking.client_email}</p>
              {booking.client_phone && <p className="text-sm text-slate-500 mt-0.5">{booking.client_phone}</p>}
            </div>
          </div>

          {/* Tableau prestation */}
          <div className="mx-10 mb-6">
            <table className="w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-[10px] text-slate-500 uppercase tracking-widest font-bold">Désignation</th>
                  <th className="px-4 py-2.5 text-right text-[10px] text-slate-500 uppercase tracking-widest font-bold whitespace-nowrap">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-4 align-top">
                    <p className="font-bold text-slate-900 text-base">
                      {service?.name ?? 'Lavage automobile'}
                      {booking.vehicle_type && <span className="font-normal text-slate-500"> — {booking.vehicle_type}</span>}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">{formattedDate} à {time}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{booking.address}</p>
                    {booking.is_smart_slot && discount > 0 && (
                      <p className="text-amber-600 text-xs font-semibold mt-1.5">★ Créneau optimisé (remise de {discount}€)</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right align-top whitespace-nowrap">
                    {booking.is_smart_slot && discount > 0 ? (
                      <>
                        <p className="text-slate-400 line-through text-sm">{baseStr}€</p>
                        <p className="font-bold text-amber-600 text-lg">{finalStr}€</p>
                      </>
                    ) : (
                      <p className="font-bold text-slate-900 text-lg">{finalStr}€</p>
                    )}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-400 italic">TVA non applicable — art. 293 B du CGI</td>
                  <td></td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-900">
                  <td className="px-4 py-3.5 font-bold text-white text-sm">TOTAL À RÉGLER SUR PLACE</td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-white text-xl whitespace-nowrap">{finalStr}€</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-xs text-slate-400 text-right mt-1.5">Mode de règlement : paiement comptant sur place</p>
          </div>

          {/* Encart justificatif */}
          <div className="mx-10 mb-8 bg-blue-50 border-l-4 border-blue-500 px-5 py-3.5 rounded-r-lg">
            <p className="text-sm font-bold text-blue-800">Justificatif de prestation — facture</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Ce document fait office de reçu de prestation de service et peut être utilisé pour une facture.
              Référence : <strong>{ref}</strong> · Émis le {today}
            </p>
          </div>

          {/* Pied de page */}
          <div className="bg-slate-50 border-t border-slate-200 px-10 py-4 text-center">
            <p className="text-xs text-slate-400">
              Ce reçu a été généré automatiquement par <strong>WashBoard</strong> · Plateforme de réservation de lavage automobile à domicile
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
