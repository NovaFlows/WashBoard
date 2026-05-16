'use client'

import { useState } from 'react'

type Service = { name: string; price: number; duration_minutes: number }
type Booking = {
  id: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  scheduled_at: string
  status: string
  services: Service | null
}

type Props = {
  bookings: Booking[]
  washerId: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmé',   color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulé',     color: 'bg-red-100 text-red-700' },
  done:      { label: 'Terminé',    color: 'bg-gray-100 text-gray-600' },
}

export default function BookingList({ bookings, washerId }: Props) {
  const [list, setList] = useState(bookings)
  const [loading, setLoading] = useState<string | null>(null)

  async function updateStatus(bookingId: string, status: string) {
    setLoading(bookingId)
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setList(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b))
    }
    setLoading(null)
  }

  const upcoming = list.filter(b => b.status !== 'done' && b.status !== 'cancelled')
  const past = list.filter(b => b.status === 'done' || b.status === 'cancelled')

  if (list.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">Aucune réservation pour l'instant.</p>
        <p className="text-sm mt-1">Partagez votre lien de réservation pour recevoir vos premiers clients.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">À venir</h2>
          <div className="space-y-3">
            {upcoming.map(booking => (
              <BookingCard key={booking.id} booking={booking} loading={loading} onUpdate={updateStatus} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Historique</h2>
          <div className="space-y-3">
            {past.map(booking => (
              <BookingCard key={booking.id} booking={booking} loading={loading} onUpdate={updateStatus} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BookingCard({ booking, loading, onUpdate }: {
  booking: Booking
  loading: string | null
  onUpdate: (id: string, status: string) => void
}) {
  const date = new Date(booking.scheduled_at)
  const formatted = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const statusInfo = STATUS_LABELS[booking.status] ?? STATUS_LABELS.pending
  const isLoading = loading === booking.id

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{booking.client_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-sm text-blue-600 font-medium">{formatted} à {time}</p>
          {booking.services && (
            <p className="text-sm text-gray-500 mt-0.5">{booking.services.name} — {booking.services.price}€</p>
          )}
          <p className="text-sm text-gray-400 mt-0.5 truncate">{booking.address}</p>
          <div className="flex gap-3 mt-1 text-xs text-gray-400">
            <span>{booking.client_phone}</span>
            <span>{booking.client_email}</span>
          </div>
        </div>

        {booking.status === 'pending' && (
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => onUpdate(booking.id, 'confirmed')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-40 transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={() => onUpdate(booking.id, 'cancelled')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
            >
              Annuler
            </button>
          </div>
        )}

        {booking.status === 'confirmed' && (
          <button
            onClick={() => onUpdate(booking.id, 'done')}
            disabled={isLoading}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors shrink-0"
          >
            Marquer terminé
          </button>
        )}
      </div>
    </div>
  )
}
