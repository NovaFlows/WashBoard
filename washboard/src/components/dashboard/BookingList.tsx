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
  is_smart_slot: boolean
  smart_discount: number
  closed_late: boolean
  booked_price: number | null
  services: Service | null
}

type Props = {
  bookings: Booking[]
  washerId: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:     { label: 'En attente',    dot: 'bg-amber-400',  badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
  confirmed:   { label: 'Confirmé',     dot: 'bg-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' },
  cancelled:   { label: 'Annulé',      dot: 'bg-red-400',    badge: 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' },
  done:        { label: 'Terminé',     dot: 'bg-slate-400',  badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700' },
  closed_late: { label: 'Délai dépassé', dot: 'bg-orange-400', badge: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' },
}

export default function BookingList({ bookings, washerId }: Props) {
  const [list, setList] = useState(bookings)
  const [loading, setLoading] = useState<string | null>(null)

  async function updateStatus(bookingId: string, status: string, closedLate?: boolean) {
    setLoading(bookingId)
    const body: Record<string, unknown> = { status }
    if (closedLate !== undefined) body.closed_late = closedLate
    let res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    // Fallback: if closed_late column doesn't exist yet, retry without it
    if (!res.ok && closedLate !== undefined) {
      res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    }
    if (res.ok) {
      setList(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, status, ...(closedLate !== undefined ? { closed_late: closedLate } : {}) }
          : b
      ))
    }
    setLoading(null)
  }

  const upcoming = list.filter(b => b.status !== 'done' && b.status !== 'cancelled')
  const past = list.filter(b => b.status === 'done' || b.status === 'cancelled')

  if (list.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p className="font-semibold text-slate-700 dark:text-slate-300">Aucune réservation</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
          Partagez votre lien de réservation pour recevoir vos premiers clients.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">À venir</h2>
            <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {upcoming.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {upcoming.map(booking => (
              <BookingCard key={booking.id} booking={booking} loading={loading} onUpdate={updateStatus} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Historique</h2>
          <div className="space-y-2.5">
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
  onUpdate: (id: string, status: string, closedLate?: boolean) => void
}) {
  const date = new Date(booking.scheduled_at)
  const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const statusKey = booking.closed_late ? 'closed_late' : booking.status
  const statusInfo = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending
  const isLoading = loading === booking.id
  const isPast = booking.status === 'done' || booking.status === 'cancelled'
  const isExpiredPending  = booking.status === 'pending'   && date < new Date()
  const isExpiredConfirmed = booking.status === 'confirmed' && date < new Date()

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-opacity ${isPast ? 'opacity-60' : ''}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{booking.client_name}</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 mb-1">
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="capitalize">{dayLabel} à {timeLabel}</span>
            </div>

            {booking.services && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 22V12M12 12L8 8M12 12l4-4"/>
                  <circle cx="12" cy="5" r="3"/>
                </svg>
                <span>
                  {booking.services.name} —{' '}
                  {(() => {
                    const basePrice = booking.booked_price ?? booking.services!.price
                    if (booking.is_smart_slot && Number(booking.smart_discount) > 0) {
                      return (
                        <>
                          <span className="line-through opacity-50">{basePrice}€</span>
                          {' '}
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {(basePrice - Number(booking.smart_discount)).toFixed(2).replace(/\.00$/, '')}€ ★
                          </span>
                        </>
                      )
                    }
                    return <span className="font-semibold text-slate-700 dark:text-slate-300">{basePrice}€</span>
                  })()}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 mb-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate">{booking.address}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mt-1">
              <span>{booking.client_phone}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="truncate">{booking.client_email}</span>
            </div>
          </div>

          {booking.status === 'pending' && (
            <div className="flex flex-col gap-2 shrink-0">
              {isExpiredPending ? (
                <span className="px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-lg border border-orange-200 dark:border-orange-800 text-center">
                  Créneau passé
                </span>
              ) : (
                <button
                  onClick={() => onUpdate(booking.id, 'confirmed')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  Confirmer
                </button>
              )}
              <button
                onClick={() => onUpdate(booking.id, 'cancelled')}
                disabled={isLoading}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 transition-colors border border-red-200 dark:border-red-800"
              >
                Annuler
              </button>
            </div>
          )}

          {booking.status === 'confirmed' && (
            isExpiredConfirmed ? (
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg border border-red-300 dark:border-red-800">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  Délai dépassé
                </span>
                <button
                  onClick={() => onUpdate(booking.id, 'done', true)}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  Clôturer
                </button>
              </div>
            ) : (
              <button
                onClick={() => onUpdate(booking.id, 'done')}
                disabled={isLoading}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shrink-0 border border-slate-200 dark:border-slate-700"
              >
                Terminé
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
