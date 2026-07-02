import type { Service } from '@/types'
import type { FormState } from './BookingForm'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'
import { formatPrice } from '@/lib/pricing'

type Props = {
  washerName: string
  bookingId: string
  form: FormState
  services: Service[]
}

export default function StepConfirmation({ washerName, bookingId, form, services }: Props) {
  const service = services.find(s => s.id === form.service_id)
  const date = form.scheduled_at ? new Date(form.scheduled_at) : null
  const displayPrice = form.booked_price ?? service?.price ?? 0

  return (
    <div className="text-center py-2">
      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Réservation envoyée !</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Un email de confirmation vous a été envoyé</p>

      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-left space-y-3 mb-5">
        <Row label="Prestataire" value={washerName} />
        {service && (
          <Row
            label="Prestation"
            value={
              form.is_smart_slot && Number(form.smart_discount) > 0
                ? `${service.name} — ${formatPrice(displayPrice - Number(form.smart_discount))} ★`
                : `${service.name} — ${displayPrice}€`
            }
          />
        )}
        {form.vehicles_detail && form.vehicles_detail.length > 0 && (
          <div className="flex justify-between text-sm gap-3">
            <span className="text-slate-500 dark:text-slate-400 shrink-0">
              Véhicule{form.vehicles_detail.reduce((s, v) => s + v.count, 0) > 1 ? 's' : ''}
            </span>
            <div className="font-medium text-slate-900 dark:text-slate-100 text-right space-y-0.5">
              {form.vehicles_detail.flatMap(v => {
                const label = v.label ?? VEHICLE_LABELS[v.type] ?? v.type
                const mdls = (v.models ?? []).map(m => m.trim()).filter(Boolean)
                if (mdls.length === 0) return [`${label} × ${v.count}`]
                const lines = mdls.map(m => `${label} — ${m}`)
                if (mdls.length < v.count) lines.push(`${label} × ${v.count - mdls.length}`)
                return lines
              }).map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        )}
        {form.selected_addons && form.selected_addons.length > 0 && (
          form.selected_addons.map(a => (
            <Row key={a.id} label={a.label} value={`+${a.price}€`} />
          ))
        )}
        {form.travel_fee != null && form.travel_fee > 0 && (
          <Row label="Frais de déplacement" value={`+${form.travel_fee}€`} />
        )}
        {form.travel_fee != null && form.travel_fee > 0 && (
          <div className="flex justify-between text-sm gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Total</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {formatPrice(displayPrice + form.travel_fee - (form.is_smart_slot ? Number(form.smart_discount ?? 0) : 0))}
            </span>
          </div>
        )}
        {date && (
          <Row
            label="Date & heure"
            value={`${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
          />
        )}
        {form.address && <Row label="Adresse" value={form.address} right />}
        {form.notes && <Row label="Note" value={form.notes} right />}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg mb-5">
        <span className="text-xs text-slate-500 dark:text-slate-400">Référence</span>
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
          {bookingId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <a
        href={`/api/bookings/${bookingId}/pdf`}
        download={`confirmation-${bookingId.slice(0, 8).toUpperCase()}.pdf`}
        className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        Télécharger la confirmation PDF
      </a>
    </div>
  )
}

function Row({ label, value, right }: { label: string; value: string; right?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-3">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className={`font-medium text-slate-900 dark:text-slate-100 ${right ? 'text-right' : ''}`}>{value}</span>
    </div>
  )
}
