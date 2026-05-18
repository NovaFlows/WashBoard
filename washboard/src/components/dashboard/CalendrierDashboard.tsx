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
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  is_smart_slot: boolean
  smart_discount: number
  services: Service | null
}

const STATUS = {
  pending:   { label: 'En attente', bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-300',   pill: 'bg-amber-400' },
  confirmed: { label: 'Confirmé',   bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', pill: 'bg-emerald-400' },
  done:      { label: 'Terminé',    bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-300',     pill: 'bg-blue-400' },
  cancelled: { label: 'Annulé',     bg: 'bg-red-100 dark:bg-red-900/40',         text: 'text-red-700 dark:text-red-300',       pill: 'bg-red-400' },
}

const DAYS   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const HOUR_START  = 7
const HOUR_END    = 20
const HOUR_H      = 64 // px per hour slot

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - (d.getDay() + 6) % 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function buildGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const grid: (Date | null)[] = []
  const pad = (first.getDay() + 6) % 7
  for (let i = 0; i < pad; i++) grid.push(null)
  for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(year, month, d))
  while (grid.length < 42) grid.push(null)
  return grid
}

type WeekBooking = Booking & { col: number; totalCols: number }

function layoutDayBookings(bookings: Booking[]): WeekBooking[] {
  if (bookings.length === 0) return []
  const getMs  = (b: Booking) => new Date(b.scheduled_at).getTime()
  const getEnd = (b: Booking) => getMs(b) + (b.services?.duration_minutes ?? 60) * 60_000
  const sorted = [...bookings].sort((a, b) => getMs(a) - getMs(b))

  const colEnds: number[] = []
  const withCol = sorted.map(b => {
    const start = getMs(b)
    let col = colEnds.findIndex(end => end <= start)
    if (col === -1) { col = colEnds.length; colEnds.push(getEnd(b)) }
    else colEnds[col] = getEnd(b)
    return { booking: b, col }
  })

  return withCol.map(({ booking, col }) => {
    const start = getMs(booking), end = getEnd(booking)
    const concurrent = withCol.filter(({ booking: b2 }) => getMs(b2) < end && getEnd(b2) > start)
    const totalCols = Math.max(...concurrent.map(o => o.col)) + 1
    return { ...booking, col, totalCols }
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function fmt(date: Date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function CalendrierDashboard({ bookings: initial }: { bookings: Booking[] }) {
  const today = new Date()
  const [view,        setView]        = useState<'month' | 'week' | 'day'>('month')
  const [current,     setCurrent]     = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [weekStart,   setWeekStart]   = useState(getWeekStart(today))
  const [dayDate,     setDayDate]     = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [bookings,    setBookings]    = useState(initial)
  const [selected,    setSelected]    = useState<Booking | null>(null)
  const [dayList,     setDayList]     = useState<Booking[] | null>(null)
  const [updating,    setUpdating]    = useState(false)
  const [editNotes,   setEditNotes]   = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  const grid     = buildGrid(current.getFullYear(), current.getMonth())
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })

  const byDate = new Map<string, Booking[]>()
  bookings.forEach(b => {
    const k = dayKey(new Date(b.scheduled_at))
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k)!.push(b)
  })

  const monthBookings = bookings.filter(b => {
    const d = new Date(b.scheduled_at)
    return d.getFullYear() === current.getFullYear() && d.getMonth() === current.getMonth()
  })
  const pendingCount = monthBookings.filter(b => b.status === 'pending').length

  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()}–${weekEnd.getDate()} ${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0, 3)}. – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()].slice(0, 3)}. ${weekEnd.getFullYear()}`
  const dayLabel  = dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dayBkgsForView = byDate.get(dayKey(dayDate)) ?? []

  function openBooking(b: Booking) {
    setSelected(b)
    setEditNotes(b.notes ?? '')
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

  async function updateStatus(id: string, status: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as Booking['status'] } : b))
        setSelected(prev => prev?.id === id ? { ...prev, status: status as Booking['status'] } : prev)
      }
    } finally {
      setUpdating(false)
    }
  }

  async function saveNotes() {
    if (!selected) return
    setNotesSaving(true)
    try {
      const res = await fetch(`/api/bookings/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes }),
      })
      if (res.ok) {
        setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, notes: editNotes } : b))
        setSelected(prev => prev ? { ...prev, notes: editNotes } : prev)
      }
    } finally {
      setNotesSaving(false)
    }
  }

  function goBack() {
    if (view === 'month') setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))
    else if (view === 'week') { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
    else { const d = new Date(dayDate); d.setDate(d.getDate() - 1); setDayDate(d) }
  }

  function goForward() {
    if (view === 'month') setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))
    else if (view === 'week') { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
    else { const d = new Date(dayDate); d.setDate(d.getDate() + 1); setDayDate(d) }
  }

  function goToday() {
    setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))
    setWeekStart(getWeekStart(today))
    setDayDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Calendrier</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {monthBookings.length} réservation{monthBookings.length !== 1 ? 's' : ''} ce mois
            {pendingCount > 0 && <span className="ml-2 text-amber-500 font-medium">· {pendingCount} en attente</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vue */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-sm">
            {([['month', 'Mois'], ['week', 'Semaine'], ['day', 'Jour']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  view === v
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Aujourd&apos;hui
          </button>

          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <button onClick={goBack} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 min-w-[200px] text-center select-none capitalize">
              {view === 'month' ? `${MONTHS[current.getMonth()]} ${current.getFullYear()}` : view === 'week' ? weekLabel : dayLabel}
            </span>
            <button onClick={goForward} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Vue mois ── */}
      {view === 'month' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, idx) => {
              if (!day) return (
                <div
                  key={`pad-${idx}`}
                  className="min-h-[88px] border-b border-r border-slate-100 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-950/30"
                  style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : undefined, borderBottom: idx >= 35 ? 'none' : undefined }}
                />
              )
              const isToday  = isSameDay(day, today)
              const isPast   = day < today && !isToday
              const dayBkgs  = byDate.get(dayKey(day)) ?? []
              const visible  = dayBkgs.slice(0, 2)
              const overflow = dayBkgs.length - 2
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[88px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800/50 ${isPast ? 'bg-slate-50/40 dark:bg-slate-950/20' : ''}`}
                  style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : undefined, borderBottom: idx >= 35 ? 'none' : undefined }}
                >
                  <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 select-none ${
                    isToday ? 'bg-blue-600 text-white' : isPast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map(b => (
                      <button
                        key={b.id}
                        onClick={() => openBooking(b)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate transition-opacity hover:opacity-75 ${STATUS[b.status].bg} ${STATUS[b.status].text}`}
                      >
                        {b.is_smart_slot && '★ '}{fmt(new Date(b.scheduled_at))} {b.client_name.split(' ')[0]}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <button
                        onClick={() => setDayList(dayBkgs)}
                        className="w-full text-left px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        +{overflow} autre{overflow > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Vue semaine ── */}
      {view === 'week' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header jours */}
          <div className="grid border-b border-slate-200 dark:border-slate-800" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-r border-slate-100 dark:border-slate-800" />
            {weekDays.map((d, i) => {
              const isToday = isSameDay(d, today)
              return (
                <div key={i} className="py-2.5 text-center border-l border-slate-100 dark:border-slate-800 first:border-l-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{DAYS[i]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto' : 'text-slate-700 dark:text-slate-300'}`}>
                    {d.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Grille horaire */}
          <div className="overflow-y-auto" style={{ maxHeight: 640 }}>
            <div className="relative" style={{ gridTemplateColumns: '52px repeat(7, 1fr)', display: 'grid' }}>
              {/* Colonne heures */}
              <div className="border-r border-slate-100 dark:border-slate-800">
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                  <div key={i} style={{ height: HOUR_H }} className="flex items-start justify-end pr-2 pt-1">
                    <span className="text-[10px] font-medium text-slate-400">{HOUR_START + i}h</span>
                  </div>
                ))}
              </div>

              {/* Colonnes jours */}
              {weekDays.map((day, di) => {
                const dayBkgs = byDate.get(dayKey(day)) ?? []
                const isToday = isSameDay(day, today)
                return (
                  <div
                    key={di}
                    className={`relative border-l border-slate-100 dark:border-slate-800 ${isToday ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}
                    style={{ height: (HOUR_END - HOUR_START) * HOUR_H }}
                  >
                    {/* Lignes heures */}
                    {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                      <div key={i} className="absolute w-full border-b border-slate-100 dark:border-slate-800/50" style={{ top: i * HOUR_H }} />
                    ))}

                    {/* Réservations */}
                    {layoutDayBookings(dayBkgs).map(b => {
                      const d = new Date(b.scheduled_at)
                      const h = d.getHours()
                      const m = d.getMinutes()
                      if (h < HOUR_START || h >= HOUR_END) return null
                      const top      = (h - HOUR_START) * HOUR_H + m * (HOUR_H / 60)
                      const height   = Math.max((b.services?.duration_minutes ?? 60) * (HOUR_H / 60), 28)
                      const widthPct = 100 / b.totalCols
                      const leftPct  = b.col * widthPct
                      return (
                        <button
                          key={b.id}
                          onClick={() => openBooking(b)}
                          className={`absolute rounded-md px-1.5 py-1 text-left overflow-hidden hover:opacity-80 transition-opacity ${STATUS[b.status].bg} ${STATUS[b.status].text}`}
                          style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 2px)` }}
                        >
                          <p className="text-[10px] font-bold leading-tight truncate">{b.is_smart_slot && '★ '}{fmt(d)}</p>
                          <p className="text-[10px] leading-tight truncate opacity-80">{b.client_name.split(' ')[0]}</p>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Vue jour ── */}
      {view === 'day' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid border-b border-slate-200 dark:border-slate-800" style={{ gridTemplateColumns: '52px 1fr' }}>
            <div className="border-r border-slate-100 dark:border-slate-800" />
            <div className="py-3 px-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isSameDay(dayDate, today) ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {dayDate.getDate()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{DAYS[(dayDate.getDay() + 6) % 7]}</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{MONTHS[dayDate.getMonth()]} {dayDate.getFullYear()}</p>
              </div>
              {dayBkgsForView.length > 0 && (
                <span className="ml-auto text-xs font-medium text-slate-400">{dayBkgsForView.length} RDV</span>
              )}
            </div>
          </div>

          {/* Grille horaire */}
          <div className="overflow-y-auto" style={{ maxHeight: 640 }}>
            <div className="relative" style={{ gridTemplateColumns: '52px 1fr', display: 'grid' }}>
              {/* Colonne heures */}
              <div className="border-r border-slate-100 dark:border-slate-800">
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                  <div key={i} style={{ height: HOUR_H }} className="flex items-start justify-end pr-2 pt-1">
                    <span className="text-[10px] font-medium text-slate-400">{HOUR_START + i}h</span>
                  </div>
                ))}
              </div>

              {/* Colonne jour */}
              <div
                className={`relative ${isSameDay(dayDate, today) ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}
                style={{ height: (HOUR_END - HOUR_START) * HOUR_H }}
              >
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                  <div key={i} className="absolute w-full border-b border-slate-100 dark:border-slate-800/50" style={{ top: i * HOUR_H }} />
                ))}

                {layoutDayBookings(dayBkgsForView).map(b => {
                  const d = new Date(b.scheduled_at)
                  const h = d.getHours(), m = d.getMinutes()
                  if (h < HOUR_START || h >= HOUR_END) return null
                  const top      = (h - HOUR_START) * HOUR_H + m * (HOUR_H / 60)
                  const height   = Math.max((b.services?.duration_minutes ?? 60) * (HOUR_H / 60), 28)
                  const widthPct = 100 / b.totalCols
                  const leftPct  = b.col * widthPct
                  return (
                    <button
                      key={b.id}
                      onClick={() => openBooking(b)}
                      className={`absolute rounded-md px-2 py-1 text-left overflow-hidden hover:opacity-80 transition-opacity ${STATUS[b.status].bg} ${STATUS[b.status].text}`}
                      style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 3px)` }}
                    >
                      <p className="text-xs font-bold leading-tight truncate">{b.is_smart_slot && '★ '}{fmt(d)} — {b.client_name}</p>
                      {b.services && <p className="text-[10px] leading-tight truncate opacity-80">{b.services.name} · {b.services.duration_minutes} min</p>}
                    </button>
                  )
                })}

                {dayBkgsForView.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-slate-300 dark:text-slate-600">Aucun RDV ce jour</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center gap-4 mt-3 px-1">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${s.pill}`} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Modal liste du jour */}
      {dayList && !selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDayList(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs border border-slate-200 dark:border-slate-700 p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {new Date(dayList[0].scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setDayList(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {dayList.map(b => (
                <button
                  key={b.id}
                  onClick={() => { openBooking(b); setDayList(null) }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 ${STATUS[b.status].bg} ${STATUS[b.status].text} hover:opacity-80 transition-opacity`}
                >
                  <span className="text-sm font-semibold">{b.client_name}</span>
                  <span className="text-xs opacity-80">{fmt(new Date(b.scheduled_at))}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal détail réservation */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[selected.status].bg} ${STATUS[selected.status].text}`}>
                {STATUS[selected.status].label}
              </span>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{selected.client_name}</h2>

            <div className="space-y-2.5 mb-4">
              <Row icon="mail">{selected.client_email}</Row>
              {selected.client_phone && <Row icon="phone">{selected.client_phone}</Row>}
              {selected.services && (
                <Row icon="bolt">
                  {selected.services.name} · {selected.services.duration_minutes} min ·{' '}
                  {selected.is_smart_slot && Number(selected.smart_discount) > 0 ? (
                    <>
                      <span className="line-through opacity-50">{selected.services.price}€</span>
                      {' '}
                      <span className="font-semibold">{(selected.services.price - Number(selected.smart_discount)).toFixed(2).replace(/\.00$/, '')}€</span>
                      {' '}
                      <span className="text-amber-500 font-bold">★ smart</span>
                    </>
                  ) : `${selected.services.price}€`}
                </Row>
              )}
              <Row icon="calendar">
                {new Date(selected.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}à {fmt(new Date(selected.scheduled_at))}
              </Row>
              <Row icon="pin">{selected.address}</Row>
            </div>

            {/* Notes internes */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Notes internes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Code portail, instructions particulières..."
                rows={2}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-shadow"
              />
              {notesSaving && <p className="text-[11px] text-slate-400 mt-0.5">Sauvegarde...</p>}
            </div>

            {/* Boutons statut */}
            {selected.status !== 'done' && selected.status !== 'cancelled' && (
              <div className="flex gap-2 mb-3">
                {selected.status === 'pending' && (
                  <button
                    onClick={() => updateStatus(selected.id, 'confirmed')}
                    disabled={updating}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                )}
                {selected.status === 'confirmed' && (
                  <button
                    onClick={() => updateStatus(selected.id, 'done')}
                    disabled={updating}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    Marquer terminé
                  </button>
                )}
                <button
                  onClick={() => updateStatus(selected.id, 'cancelled')}
                  disabled={updating}
                  className="flex-1 py-2.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            )}

            {/* Boutons contact */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openGmail(selected)}
                className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Gmail
              </button>
              <button
                onClick={() => openWhatsapp(selected)}
                disabled={!selected.client_phone}
                className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ icon, children }: { icon: 'mail' | 'phone' | 'bolt' | 'calendar' | 'pin'; children: React.ReactNode }) {
  const icons = {
    mail:     <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>,
    phone:    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>,
    bolt:     <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    pin:      <><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></>,
  }
  return (
    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
      <svg className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {icons[icon]}
      </svg>
      <span>{children}</span>
    </div>
  )
}
