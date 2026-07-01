'use client'

import { useState } from 'react'

type ServiceAddon = { id: string; label: string; price: number; category: string }
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
  notes: string | null
  selected_addons: ServiceAddon[] | null
  travel_fee: number | null
  vehicle_count: number | null
  vehicles_detail: { type: string; count: number; unit_price: number; label?: string; models?: string[] }[] | null
  services: Service | null
}

const VEHICLE_LABELS: Record<string, string> = {
  citadine_2p: 'Citadine 2p', citadine: 'Citadine', berline: 'Berline',
  SUV: 'SUV / 4x4', monospace: 'Monospace', '7places': '7 places',
  utilitaire: 'Van / Utilitaire', 'camping-car': 'Camping-car', camion: 'Camion',
  moto: 'Moto', scooter: 'Scooter', velo: 'Vélo / Trottinette',
}

type Props = {
  bookings: Booking[]
  washerId: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:     { label: 'En attente',     dot: 'bg-amber-400',   badge: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
  confirmed:   { label: 'Confirmé',      dot: 'bg-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' },
  cancelled:   { label: 'Annulé',        dot: 'bg-red-400',     badge: 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' },
  done:        { label: 'Terminé',       dot: 'bg-slate-400',   badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700' },
  closed_late: { label: 'Délai dépassé', dot: 'bg-orange-400',  badge: 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800' },
}

function fmt(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function openGmail(b: Booking) {
  const date    = new Date(b.scheduled_at)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = fmt(date)
  const subject = `Votre réservation — ${b.services?.name ?? 'Lavage'} du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
  const body    = [`Bonjour ${b.client_name},`, '', 'Je vous contacte au sujet de votre réservation :', `• Prestation : ${b.services?.name ?? '—'}`, `• Date : ${dateStr} à ${timeStr}`, `• Adresse : ${b.address}`, '', ''].join('\n')
  const url = new URL('https://mail.google.com/mail/')
  url.searchParams.set('view', 'cm')
  url.searchParams.set('to', b.client_email)
  url.searchParams.set('su', subject)
  url.searchParams.set('body', body)
  window.open(url.toString(), '_blank', 'noopener')
}

function openWhatsapp(b: Booking) {
  if (!b.client_phone) return
  const date    = new Date(b.scheduled_at)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = fmt(date)
  const text    = [`Bonjour ${b.client_name},`, '', 'Je vous contacte au sujet de votre réservation :', `• Prestation : ${b.services?.name ?? '—'}`, `• Date : ${dateStr} à ${timeStr}`, `• Adresse : ${b.address}`, ''].join('\n')
  let phone = b.client_phone.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = '33' + phone.slice(1)
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

export default function BookingList({ bookings }: Props) {
  const [list, setList]       = useState(bookings)
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
  const past     = list.filter(b => b.status === 'done'  || b.status === 'cancelled')

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
            {upcoming.map(b => (
              <BookingCard key={b.id} booking={b} loading={loading} onUpdate={updateStatus} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Historique</h2>
          <div className="space-y-2.5">
            {past.map(b => (
              <BookingCard key={b.id} booking={b} loading={loading} onUpdate={updateStatus} />
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
  const date               = new Date(booking.scheduled_at)
  const dayLabel           = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel          = fmt(date)
  const statusKey          = booking.closed_late ? 'closed_late' : booking.status
  const statusInfo         = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending
  const isLoading          = loading === booking.id
  const isPast             = booking.status === 'done' || booking.status === 'cancelled'
  const isExpiredPending   = booking.status === 'pending'   && date < new Date()
  const isExpiredConfirmed = booking.status === 'confirmed' && date < new Date()
  const basePrice          = booking.booked_price ?? booking.services?.price ?? 0
  const travelFee          = booking.travel_fee ?? 0
  const servicePrice       = basePrice - travelFee
  const isSmart            = booking.is_smart_slot && Number(booking.smart_discount) > 0
  const finalPrice         = isSmart ? basePrice - Number(booking.smart_discount) : basePrice

  const [open, setOpen]           = useState(false)
  const [notesText, setNotesText] = useState(booking.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)

  async function saveNotes() {
    if (notesText === (booking.notes ?? '')) return
    setNotesSaving(true)
    await fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesText }),
    })
    setNotesSaving(false)
  }

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-opacity ${isPast ? 'opacity-60' : ''}`}>

      {/* Ligne compacte — toujours visible */}
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
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span>
                  {booking.services.name} —{' '}
                  {isSmart ? (
                    <>
                      <span className="line-through opacity-50">{basePrice}€</span>{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{finalPrice.toFixed(2).replace(/\.00$/, '')}€</span>{' '}
                      <span className="text-amber-500 font-bold">★</span>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{basePrice}€</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Boutons statut (toujours visibles) + oeil */}
          <div className="flex flex-col gap-2 shrink-0 items-end">
            {booking.status === 'pending' && !isExpiredPending && (
              <div className="flex flex-col sm:flex-row gap-1.5">
                <button
                  onClick={() => onUpdate(booking.id, 'confirmed')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => onUpdate(booking.id, 'cancelled')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 transition-colors border border-red-200 dark:border-red-800"
                >
                  Annuler
                </button>
              </div>
            )}
            {booking.status === 'pending' && isExpiredPending && (
              <span className="px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-lg border border-orange-200 dark:border-orange-800">
                Créneau passé
              </span>
            )}
            {booking.status === 'confirmed' && !isExpiredConfirmed && (
              <div className="flex flex-col sm:flex-row gap-1.5">
                <button
                  onClick={() => onUpdate(booking.id, 'done')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors border border-slate-200 dark:border-slate-700"
                >
                  Terminé
                </button>
                <button
                  onClick={() => onUpdate(booking.id, 'cancelled')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-40 transition-colors border border-red-200 dark:border-red-800"
                >
                  Annuler
                </button>
              </div>
            )}
            {booking.status === 'confirmed' && isExpiredConfirmed && (
              <button
                onClick={() => onUpdate(booking.id, 'done', true)}
                disabled={isLoading}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors border border-slate-200 dark:border-slate-700"
              >
                Clôturer
              </button>
            )}
            {/* Oeil */}
            <button
              onClick={() => setOpen(v => !v)}
              title="Voir le détail"
              className={`p-1.5 rounded-lg transition-colors ${open ? 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Détail dépliable — visible uniquement quand oeil cliqué */}
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 space-y-4">

          {/* Infos complètes */}
          <div className="space-y-2.5">
            <Row icon="mail">{booking.client_email}</Row>
            {booking.client_phone && <Row icon="phone">{booking.client_phone}</Row>}
            {booking.services && (
              <Row icon="bolt">
                {booking.services.name} · {booking.services.duration_minutes} min ·{' '}
                {booking.is_smart_slot && Number(booking.smart_discount) > 0 ? (
                  <>
                    <span className="line-through opacity-50">{servicePrice}€</span>
                    {' '}
                    <span className="font-semibold">{(servicePrice - Number(booking.smart_discount)).toFixed(2).replace(/\.00$/, '')}€</span>
                    {' '}
                    <span className="text-amber-500 font-bold">★ smart</span>
                  </>
                ) : `${servicePrice}€`}
              </Row>
            )}
            {booking.vehicles_detail && booking.vehicles_detail.length > 0 && (
              <Row icon="car">
                {booking.vehicles_detail.flatMap(v => {
                  const label = v.label ?? VEHICLE_LABELS[v.type] ?? v.type
                  const mdls = (v.models ?? []).map(m => m.trim()).filter(Boolean)
                  if (mdls.length === 0) return [`${label} × ${v.count}`]
                  const lines = mdls.map(m => `${label} — ${m}`)
                  if (mdls.length < v.count) lines.push(`${label} × ${v.count - mdls.length}`)
                  return lines
                }).map((line, i) => <span key={i} className="block">{line}</span>)}
              </Row>
            )}
            <Row icon="calendar">
              {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' '}à {timeLabel}
            </Row>
            <Row icon="pin">{booking.address}</Row>
          </div>

          {/* Options supplémentaires + frais de déplacement + total */}
          {((booking.selected_addons && booking.selected_addons.length > 0) || travelFee > 0) && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Détail du prix</p>
              {booking.selected_addons?.map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{a.label}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">+{a.price}€</span>
                </div>
              ))}
              {travelFee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Frais de déplacement</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">+{travelFee}€</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {booking.is_smart_slot && Number(booking.smart_discount) > 0
                    ? `${(basePrice - Number(booking.smart_discount)).toFixed(2).replace(/\.00$/, '')}€`
                    : `${basePrice}€`}
                </span>
              </div>
            </div>
          )}

          {/* Notes internes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Notes internes</label>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              onBlur={saveNotes}
              placeholder="Code portail, instructions particulières..."
              rows={2}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-shadow"
            />
            {notesSaving && <p className="text-[11px] text-slate-400 mt-0.5">Sauvegarde...</p>}
          </div>

          {/* Boutons statut (dans le détail) */}
          {booking.status !== 'done' && booking.status !== 'cancelled' && (
            <div className="flex gap-2">
              {booking.status === 'pending' && (
                isExpiredPending ? (
                  <span className="flex-1 text-center py-2.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-sm font-semibold rounded-xl border border-orange-200 dark:border-orange-800">
                    Créneau passé
                  </span>
                ) : (
                  <button
                    onClick={() => onUpdate(booking.id, 'confirmed')}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                )
              )}
              {booking.status === 'confirmed' && (
                isExpiredConfirmed ? (
                  <button
                    onClick={() => onUpdate(booking.id, 'done', true)}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    Clôturer
                  </button>
                ) : (
                  <button
                    onClick={() => onUpdate(booking.id, 'done')}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    Marquer terminé
                  </button>
                )
              )}
              <button
                onClick={() => onUpdate(booking.id, 'cancelled')}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Boutons contact */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openGmail(booking)}
              className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Gmail
            </button>
            <button
              onClick={() => openWhatsapp(booking)}
              disabled={!booking.client_phone}
              className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ icon, children }: { icon: 'mail' | 'phone' | 'bolt' | 'calendar' | 'pin' | 'car'; children: React.ReactNode }) {
  const icons = {
    mail:     <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>,
    phone:    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>,
    bolt:     <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    pin:      <><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></>,
    car:      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M7 16h.01M17 16h.01"/>,
  }
  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
      <svg className="w-4 h-4 shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {icons[icon]}
      </svg>
      <span className="leading-snug">{children}</span>
    </div>
  )
}
