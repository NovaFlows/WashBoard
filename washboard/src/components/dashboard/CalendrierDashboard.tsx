'use client'

import { useState } from 'react'

type Service = { name: string; price: number; duration_minutes: number }
type ServiceFull = { id: string; name: string; price: number; duration_minutes: number; vehicle_price_overrides: Record<string, number> }
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

type Unavailability = { id: string; start_date: string; end_date: string; label: string | null; team_members_off: number }

const VEHICLE_TYPES = [
  { value: 'citadine',    label: 'Citadine' },
  { value: 'berline',     label: 'Berline' },
  { value: 'SUV',         label: 'SUV / 4x4' },
  { value: 'utilitaire',  label: 'Utilitaire / Van' },
  { value: 'camping-car', label: 'Camping-car' },
  { value: 'camion',      label: 'Camion' },
  { value: 'moto',        label: 'Moto' },
  { value: 'scooter',     label: 'Scooter' },
  { value: 'velo',        label: 'Vélo / Trottinette' },
]

type ManualBooking = {
  service_id: string
  vehicle_type: string
  vehicle_count: number
  booked_price: number
  date: string
  time: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  is_professional: boolean
  company_name: string
  siret: string
  billing_address: string
  notes: string
  status: 'pending' | 'confirmed'
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Props = { bookings: Booking[]; unavailabilities: Unavailability[]; teamSize: number; services: ServiceFull[]; washerId: string }

export default function CalendrierDashboard({ bookings: initial, unavailabilities: initialUnavail, teamSize, services, washerId }: Props) {
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

  // Unavailabilities
  const [unavails,    setUnavails]    = useState(initialUnavail)
  const [addModal,    setAddModal]    = useState<{ start: string; end: string; label: string; team_members_off: number } | null>(null)
  const [delModal,    setDelModal]    = useState<Unavailability | null>(null)
  const [uSaving,     setUSaving]     = useState(false)

  // ── Ajout manuel de réservation ─────────────────────────────────────────
  const emptyManual = (): ManualBooking => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    return {
      service_id: services[0]?.id ?? '',
      vehicle_type: 'citadine',
      vehicle_count: 1,
      booked_price: services[0]?.price ?? 0,
      date: toDateStr(now),
      time: `${String(now.getHours()).padStart(2, '0')}:00`,
      client_name: '', client_email: '', client_phone: '', address: '',
      is_professional: false, company_name: '', siret: '', billing_address: '',
      notes: '', status: 'confirmed',
    }
  }
  const [manualModal, setManualModal] = useState<ManualBooking | null>(null)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualErr,    setManualErr]    = useState<string | null>(null)

  function openManualModal(date?: Date) {
    const m = emptyManual()
    if (date) m.date = toDateStr(date)
    setManualModal(m)
    setManualErr(null)
  }

  function updateManual<K extends keyof ManualBooking>(key: K, value: ManualBooking[K]) {
    setManualModal(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      // Recalcul prix automatique si service ou count change
      if (key === 'service_id' || key === 'vehicle_count' || key === 'vehicle_type') {
        const svc = services.find(s => s.id === next.service_id)
        if (svc) {
          const unitPrice = svc.vehicle_price_overrides?.[next.vehicle_type] ?? svc.price
          next.booked_price = unitPrice * next.vehicle_count
        }
      }
      return next
    })
  }

  async function submitManualBooking() {
    if (!manualModal) return
    setManualErr(null)
    if (!manualModal.client_name.trim()) { setManualErr('Nom du client requis'); return }
    if (!manualModal.client_email.trim()) { setManualErr('Email du client requis'); return }
    if (!manualModal.client_phone.trim()) { setManualErr('Téléphone du client requis'); return }
    if (!manualModal.address.trim()) { setManualErr('Adresse requise'); return }
    if (!manualModal.service_id) { setManualErr('Sélectionnez une prestation'); return }
    if (manualModal.is_professional && manualModal.siret && !/^\d{14}$/.test(manualModal.siret)) {
      setManualErr('Le SIRET doit contenir exactement 14 chiffres'); return
    }

    // ── Vérification de disponibilité ──────────────────────────────────────
    const selectedStart = new Date(`${manualModal.date}T${manualModal.time}:00`)
    const svcCheck      = services.find(s => s.id === manualModal.service_id)
    const durationMs    = (svcCheck?.duration_minutes ?? 60) * 60_000
    const selectedEnd   = new Date(selectedStart.getTime() + durationMs)
    const dayStr        = manualModal.date

    // Taille d'équipe effective en tenant compte des congés partiels
    const dayUnavail    = unavails.find(u => u.start_date <= dayStr && dayStr <= u.end_date)
    const effectiveTeam = Math.max(0, teamSize - (dayUnavail?.team_members_off ?? 0))

    if (effectiveTeam === 0) {
      setManualErr("Impossible — toute l'équipe est en congés ce jour-là")
      return
    }

    // Compter les RDV non-annulés qui se chevauchent avec ce créneau
    const overlapping = bookings.filter(b => {
      if (b.status === 'cancelled') return false
      const bStart = new Date(b.scheduled_at).getTime()
      const bEnd   = bStart + (b.services?.duration_minutes ?? 60) * 60_000
      return bStart < selectedEnd.getTime() && bEnd > selectedStart.getTime()
    })

    if (overlapping.length >= effectiveTeam) {
      setManualErr(
        `Créneau complet — ${overlapping.length}/${effectiveTeam} laveur${effectiveTeam > 1 ? 's' : ''} déjà occupé${effectiveTeam > 1 ? 's' : ''} à cet horaire`
      )
      return
    }
    // ───────────────────────────────────────────────────────────────────────

    const scheduled_at = selectedStart.toISOString()
    setManualSaving(true)

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        washer_id:       washerId,
        service_id:      manualModal.service_id,
        vehicle_type:    manualModal.vehicle_type,
        vehicle_count:   manualModal.vehicle_count,
        booked_price:    manualModal.booked_price,
        address:         manualModal.address,
        scheduled_at,
        client_name:     manualModal.client_name,
        client_email:    manualModal.client_email,
        client_phone:    manualModal.client_phone,
        is_professional: manualModal.is_professional,
        company_name:    manualModal.company_name || undefined,
        siret:           manualModal.siret || undefined,
        billing_address: manualModal.billing_address || undefined,
        is_smart_slot:   false,
        smart_discount:  0,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setManualErr(json.error ?? 'Erreur lors de la création'); setManualSaving(false); return }

    // Ajoute le RDV à l'état local
    const svc = services.find(s => s.id === manualModal.service_id)
    const newBooking: Booking = {
      id:           json.data.id,
      client_name:  manualModal.client_name,
      client_email: manualModal.client_email,
      client_phone: manualModal.client_phone,
      address:      manualModal.address,
      scheduled_at,
      status:       manualModal.status,
      notes:        manualModal.notes || null,
      is_smart_slot: false,
      smart_discount: 0,
      services:     svc ? { name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes } : null,
    }
    // Applique toujours le statut choisi (l'API crée en 'pending' par défaut)
    await fetch(`/api/bookings/${json.data.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: manualModal.status }),
    })
    setBookings(prev => [...prev, newBooking].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    setManualModal(null)
    setManualSaving(false)
  }

  function getUnavail(date: Date): Unavailability | null {
    const s = toDateStr(date)
    return unavails.find(u => u.start_date <= s && s <= u.end_date) ?? null
  }

  function openAddModal(date: Date) {
    const s = toDateStr(date)
    setAddModal({ start: s, end: s, label: '', team_members_off: teamSize })
  }

  function isFullyUnavailable(u: Unavailability): boolean {
    return (u.team_members_off ?? 1) >= teamSize
  }

  async function saveUnavail() {
    if (!addModal) return
    setUSaving(true)
    const res = await fetch('/api/unavailabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: addModal.start, end_date: addModal.end, label: addModal.label, team_members_off: addModal.team_members_off }),
    })
    const json = await res.json()
    if (res.ok) {
      setUnavails(u => [...u, json.data].sort((a, b) => a.start_date.localeCompare(b.start_date)))
      setAddModal(null)
    }
    setUSaving(false)
  }

  async function deleteUnavail() {
    if (!delModal) return
    setUSaving(true)
    await fetch(`/api/unavailabilities/${delModal.id}`, { method: 'DELETE' })
    setUnavails(u => u.filter(x => x.id !== delModal.id))
    setDelModal(null)
    setUSaving(false)
  }

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
  const unavailDay = getUnavail(dayDate)

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
          <button
            onClick={() => openManualModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter un RDV
          </button>
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
              const unavail  = getUnavail(day)
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[88px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800/50 ${
                    unavail ? 'bg-orange-50/60 dark:bg-orange-950/15' : isPast ? 'bg-slate-50/40 dark:bg-slate-950/20' : ''
                  }`}
                  style={{ borderRight: (idx + 1) % 7 === 0 ? 'none' : undefined, borderBottom: idx >= 35 ? 'none' : undefined }}
                >
                  <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 select-none ${
                    isToday ? 'bg-blue-600 text-white' : isPast ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {day.getDate()}
                  </div>
                  {unavail && isFullyUnavailable(unavail) ? (
                    <button
                      onClick={() => setDelModal(unavail)}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                    >
                      {unavail.label ?? 'Indisponible'}
                      {teamSize > 1 && <span className="ml-1 opacity-70">{unavail.team_members_off}/{teamSize}</span>}
                    </button>
                  ) : (
                    <div className="space-y-0.5">
                      {unavail && (
                        <button
                          onClick={() => setDelModal(unavail)}
                          className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                        >
                          {unavail.label ?? 'Partiel'} {unavail.team_members_off}/{teamSize}
                        </button>
                      )}
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
                      {!unavail && (
                        <button
                          onClick={() => openAddModal(day)}
                          className="w-full text-center py-0.5 text-[9px] text-slate-300 dark:text-slate-700 hover:text-orange-400 dark:hover:text-orange-500 transition-colors"
                        >
                          + bloquer
                        </button>
                      )}
                    </div>
                  )}
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
                const unavail = getUnavail(day)
                return (
                  <div
                    key={di}
                    className={`relative border-l border-slate-100 dark:border-slate-800 ${isToday ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}
                    style={{ height: (HOUR_END - HOUR_START) * HOUR_H }}
                  >
                    {unavail && (
                      isFullyUnavailable(unavail) ? (
                        <button
                          onClick={() => setDelModal(unavail)}
                          className="absolute inset-0 z-10 bg-orange-50/70 dark:bg-orange-950/20 flex items-center justify-center hover:bg-orange-100/70 dark:hover:bg-orange-950/30 transition-colors"
                        >
                          <span className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 rounded-full" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            {unavail.label ?? 'Indisponible'}{teamSize > 1 ? ` ${unavail.team_members_off}/${teamSize}` : ''}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setDelModal(unavail)}
                          className="absolute top-0 left-0 right-0 z-10 bg-orange-100/90 dark:bg-orange-950/50 border-b border-orange-200 dark:border-orange-800 px-1 py-0.5 flex items-center justify-center gap-1 hover:bg-orange-200/90 dark:hover:bg-orange-950/70 transition-colors"
                        >
                          <span className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 truncate">
                            {unavail.label ?? 'Partiel'} {unavail.team_members_off}/{teamSize}
                          </span>
                        </button>
                      )
                    )}
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
                {unavailDay && (
                  isFullyUnavailable(unavailDay) ? (
                    <button
                      onClick={() => setDelModal(unavailDay)}
                      className="absolute inset-0 z-10 bg-orange-50/70 dark:bg-orange-950/20 flex items-center justify-center hover:bg-orange-100/70 dark:hover:bg-orange-950/30 transition-colors"
                    >
                      <div className="text-center px-4">
                        <p className="text-base font-semibold text-orange-500 dark:text-orange-400">{unavailDay.label ?? 'Indisponible'}</p>
                        {teamSize > 1 && (
                          <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5 font-medium">Toute l&apos;équipe</p>
                        )}
                        <p className="text-xs text-orange-400 dark:text-orange-500 mt-1">Cliquer pour supprimer</p>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => setDelModal(unavailDay)}
                      className="absolute top-0 left-0 right-0 z-10 bg-orange-100 dark:bg-orange-950/40 border-b border-orange-200 dark:border-orange-800 px-4 py-2 flex items-center justify-between hover:bg-orange-200/80 dark:hover:bg-orange-950/60 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                          {unavailDay.label ?? 'Indisponible'} — {unavailDay.team_members_off}/{teamSize} laveurs
                        </p>
                        <p className="text-[10px] text-orange-500 dark:text-orange-500">
                          {teamSize - unavailDay.team_members_off} laveur{teamSize - unavailDay.team_members_off > 1 ? 's' : ''} disponible{teamSize - unavailDay.team_members_off > 1 ? 's' : ''} · capacité réduite
                        </p>
                      </div>
                      <span className="text-[10px] text-orange-400 shrink-0 ml-3">Supprimer</span>
                    </button>
                  )
                )}
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

      {/* Modal ajouter indisponibilité */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAddModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bloquer une période</h3>
              <button onClick={() => setAddModal(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Du</p>
                  <input
                    type="date"
                    value={addModal.start}
                    onChange={e => setAddModal(m => m ? { ...m, start: e.target.value } : m)}
                    className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="text-slate-400 mt-5">→</div>
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Au</p>
                  <input
                    type="date"
                    value={addModal.end}
                    min={addModal.start}
                    onChange={e => setAddModal(m => m ? { ...m, end: e.target.value } : m)}
                    className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Motif (optionnel)</p>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {['Vacances', 'Formation', 'Congé maladie', 'Jour férié'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAddModal(m => m ? { ...m, label: m.label === p ? '' : p } : m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        addModal.label === p
                          ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={addModal.label}
                  onChange={e => setAddModal(m => m ? { ...m, label: e.target.value } : m)}
                  placeholder="Ou saisissez un motif libre..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              {/* Nombre de laveurs concernés — visible seulement si équipe > 1 */}
              {teamSize > 1 && (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Laveurs indisponibles</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAddModal(m => m ? { ...m, team_members_off: Math.max(1, m.team_members_off - 1) } : m)}
                      disabled={addModal.team_members_off <= 1}
                      className="w-8 h-8 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >−</button>
                    <div className="flex-1 text-center">
                      <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{addModal.team_members_off}</span>
                      <span className="text-sm text-slate-400 dark:text-slate-500"> / {teamSize}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddModal(m => m ? { ...m, team_members_off: Math.min(teamSize, m.team_members_off + 1) } : m)}
                      disabled={addModal.team_members_off >= teamSize}
                      className="w-8 h-8 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >+</button>
                  </div>
                  <p className={`text-xs mt-2 text-center font-medium ${addModal.team_members_off >= teamSize ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {addModal.team_members_off >= teamSize
                      ? '⚠ Toute l\'équipe — les créneaux seront bloqués'
                      : `${teamSize - addModal.team_members_off} laveur${teamSize - addModal.team_members_off > 1 ? 's' : ''} restant — capacité réduite`
                    }
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setAddModal(null)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Annuler
                </button>
                <button
                  onClick={saveUnavail}
                  disabled={uSaving}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                >
                  {uSaving ? 'Enregistrement...' : 'Bloquer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal supprimer indisponibilité */}
      {delModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDelModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Supprimer cette période ?</h3>
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {delModal.start_date === delModal.end_date
                  ? new Date(delModal.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : `${new Date(delModal.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} → ${new Date(delModal.end_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                }
              </p>
              {delModal.label && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{delModal.label}</p>}
              {teamSize > 1 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                  {isFullyUnavailable(delModal) ? '⚠ Toute l\'équipe' : `${delModal.team_members_off} / ${teamSize} laveurs`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDelModal(null)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Annuler
              </button>
              <button
                onClick={deleteUnavail}
                disabled={uSaving}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
              >
                {uSaving ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout manuel de réservation */}
      {manualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setManualModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Ajouter un rendez-vous</h3>
              <button onClick={() => setManualModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Date & heure */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Date & heure</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Date</label>
                    <input type="date" value={manualModal.date} onChange={e => updateManual('date', e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Heure</label>
                    <input type="time" value={manualModal.time} onChange={e => updateManual('time', e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Prestation & véhicule */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Prestation</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Service</label>
                    <select value={manualModal.service_id} onChange={e => updateManual('service_id', e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.price}€</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Type de véhicule</label>
                      <select value={manualModal.vehicle_type} onChange={e => updateManual('vehicle_type', e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Quantité</label>
                      <input type="number" min={1} max={99} value={manualModal.vehicle_count}
                        onChange={e => updateManual('vehicle_count', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Prix total (€)</label>
                    <input type="number" min={0} step={0.01} value={manualModal.booked_price}
                      onChange={e => updateManual('booked_price', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="text-[11px] text-slate-400 mt-1">Calculé automatiquement — modifiable</p>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Client</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Nom complet *</label>
                      <input type="text" placeholder="Jean Dupont" value={manualModal.client_name}
                        onChange={e => updateManual('client_name', e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Email *</label>
                      <input type="email" placeholder="jean@exemple.com" value={manualModal.client_email}
                        onChange={e => updateManual('client_email', e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="w-40">
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Téléphone *</label>
                      <input type="tel" placeholder="06 00 00 00 00" value={manualModal.client_phone}
                        onChange={e => updateManual('client_phone', e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Adresse d&apos;intervention *</label>
                    <input type="text" placeholder="12 rue de la Paix, 75001 Paris" value={manualModal.address}
                      onChange={e => updateManual('address', e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Client professionnel */}
              <div>
                <button
                  type="button"
                  onClick={() => updateManual('is_professional', !manualModal.is_professional)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    manualModal.is_professional
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  Client professionnel
                  {manualModal.is_professional && <span className="ml-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-md">PRO</span>}
                </button>
                {manualModal.is_professional && (
                  <div className="mt-3 space-y-3 pl-1">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Nom de l&apos;entreprise</label>
                      <input type="text" placeholder="Kooki Clean SAS" value={manualModal.company_name}
                        onChange={e => updateManual('company_name', e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">SIRET (14 chiffres)</label>
                        <input type="text" placeholder="12345678901234" value={manualModal.siret}
                          onChange={e => updateManual('siret', e.target.value.replace(/\D/g, '').slice(0, 14))}
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Adresse de facturation</label>
                      <input type="text" placeholder="Identique à l'adresse d'intervention si vide" value={manualModal.billing_address}
                        onChange={e => updateManual('billing_address', e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Statut & notes */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Statut & notes</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Statut initial</label>
                    <div className="flex gap-2">
                      {(['confirmed', 'pending'] as const).map(s => (
                        <button key={s} type="button" onClick={() => updateManual('status', s)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                            manualModal.status === s
                              ? s === 'confirmed'
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                          {s === 'confirmed' ? 'Confirmé' : 'En attente'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Notes internes</label>
                    <textarea rows={2} placeholder="Code portail, instructions particulières..." value={manualModal.notes}
                      onChange={e => updateManual('notes', e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                </div>
              </div>

              {manualErr && <p className="text-sm text-red-600 dark:text-red-400">{manualErr}</p>}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setManualModal(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Annuler
                </button>
                <button onClick={submitManualBooking} disabled={manualSaving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors">
                  {manualSaving ? 'Création...' : 'Créer le RDV'}
                </button>
              </div>
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
