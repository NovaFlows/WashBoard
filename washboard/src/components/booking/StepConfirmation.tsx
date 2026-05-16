import type { Service } from '@/types'
import type { FormState } from './BookingForm'

type Props = {
  washerName: string
  bookingId: string
  form: FormState
  services: Service[]
}

export default function StepConfirmation({ washerName, bookingId, form, services }: Props) {
  const service = services.find(s => s.id === form.service_id)
  const date = form.scheduled_at ? new Date(form.scheduled_at) : null

  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Réservation confirmée</h2>
      <p className="text-gray-500 text-sm mb-6">Un email de confirmation vous a été envoyé</p>

      <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Prestataire</span>
          <span className="font-medium text-gray-900">{washerName}</span>
        </div>
        {service && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Prestation</span>
            <span className="font-medium text-gray-900">{service.name} — {service.price}€</span>
          </div>
        )}
        {date && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">
              {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {form.address && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Adresse</span>
            <span className="font-medium text-gray-900 text-right max-w-[60%]">{form.address}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">Réf. {bookingId.slice(0, 8).toUpperCase()}</p>
    </div>
  )
}
