'use client'

import { useState, useEffect } from 'react'
import { BOOKING_HORIZON_DAYS } from '@/lib/bookingWindow'
import type { Availability } from '@/types'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { generateSlots, countOverlaps, isSlotInWindows, isSlotFeasible, effectiveTeamSize as computeEffectiveTeamSize, dureeIncompatible, slotEstPasse } from '@/lib/slots'
import { effectiveDuration, addonsDuration, smartDiscountAmount, formatDureeFr } from '@/lib/pricing'
import BookingAction from './BookingAction'
import { toDateStr } from '@/lib/dateUtils'

// Supabase peut renvoyer l'embed `services` en objet OU en tableau → on gère les deux
type EmbedService = { duration_minutes: number } | { duration_minutes: number }[] | null
type ExistingBooking  = { scheduled_at: string; vehicle_count: number | null; selected_addons?: { duration_minutes?: number }[] | null; services: EmbedService }

function embedDuration(services: EmbedService): number {
  const dm = Array.isArray(services) ? services[0]?.duration_minutes : services?.duration_minutes
  return dm ?? 60
}

type UnavailabilityItem = { id: string; start_date: string; end_date: string; team_members_off?: number | null }

type Props = {
  availabilities: Availability[]
  existingBookings: ExistingBooking[]
  unavailabilities: UnavailabilityItem[]
  teamSize: number
  serviceDuration: number
  servicePrice: number
  washerId: string
  hasTravelFee?: boolean
  travelFeeMode?: 'base' | 'previous'
  /** Le laveur accepte-t-il les réservations pour aujourd'hui ? Faux par
   *  défaut : sans ce réglage explicite, le comportement d'avant (à partir
   *  de demain) ne doit pas changer sous les pieds d'un laveur qui n'a rien
   *  demandé. */
  reservationJourMeme?: boolean
  onNext: (data: { scheduled_at: string; address: string; is_smart_slot?: boolean; smart_discount?: number; travel_fee?: number }) => void
  initialAddress?: string
  active: boolean
  actionTarget: HTMLElement | null
  onDraft: (data: { address: string; scheduled_at?: string; travel_fee?: number; is_smart_slot: boolean; smart_discount: number }) => void
  accent?: string
}

const MONTH_NAMES = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']

/** En-têtes de la grille, semaine commençant le lundi (usage français). */
const ENTETES_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MOIS_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/** Minuit, pour comparer des jours sans se soucier de l'heure. */
function aMinuit(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Les cases d'un mois : d'abord les vides qui décalent le 1er sur son jour de
 *  semaine, puis chaque jour. Une grille de calendrier, pas une liste. */
function grilleDuMois(mois: Date): (Date | null)[] {
  const premier = new Date(mois.getFullYear(), mois.getMonth(), 1)
  // getDay() rend 0 pour dimanche ; on décale pour que lundi vaille 0.
  const decalage = (premier.getDay() + 6) % 7
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate()
  const cases: (Date | null)[] = Array.from({ length: decalage }, () => null)
  for (let j = 1; j <= nbJours; j++) {
    cases.push(new Date(mois.getFullYear(), mois.getMonth(), j))
  }
  return cases
}

const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString()

export default function StepSlot({
  availabilities, existingBookings, unavailabilities, teamSize, serviceDuration, servicePrice, washerId,
  hasTravelFee = false, travelFeeMode = 'base', reservationJourMeme = false, onNext, accent = '#2563eb', initialAddress = '', active, actionTarget, onDraft,
}: Props) {
  const [selectedDate,      setSelectedDate]      = useState<Date | null>(null)
  const [selectedTime,      setSelectedTime]      = useState<string | null>(null)
  const [address,           setAddress]           = useState(initialAddress)
  const [debouncedAddress,  setDebouncedAddress]  = useState('')
  const [zoneAllowed,       setZoneAllowed]       = useState(true)
  const [zoneMessage,       setZoneMessage]       = useState<string | null>(null)
  const [travelFeeEstimate, setTravelFeeEstimate] = useState<number | null>(null)
  const [fetchingTravelFee, setFetchingTravelFee] = useState(false)
  type SmartWindow = { start: string; end: string }
  type BookingConstraint = { start: string; end: string; travelToNew: number; travelFromNew: number }
  const [smartWindows,       setSmartWindows]       = useState<SmartWindow[]>([])
  const [bookingConstraints, setBookingConstraints] = useState<BookingConstraint[]>([])
  const [smartDiscountType,  setSmartDiscountType]  = useState<'fixed' | 'percent'>('fixed')
  const [smartDiscountValue, setSmartDiscountValue] = useState(0)
  const [fetchingSmarts,     setFetchingSmarts]     = useState(false)
  const [visibleSlots, setVisibleSlots] = useState(6)
  const [fetchingZone, setFetchingZone] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  // Fenêtre réservable : d'aujourd'hui (si le laveur l'a activé) ou de
  // demain, à l'horizon que le serveur accepte.
  const [premierJour] = useState(() => {
    const d = aMinuit(new Date())
    if (!reservationJourMeme) d.setDate(d.getDate() + 1)
    return d
  })
  const [dernierJour] = useState(() => {
    const d = aMinuit(new Date())
    d.setDate(d.getDate() + BOOKING_HORIZON_DAYS)
    return d
  })
  const [moisAffiche, setMoisAffiche] = useState(
    () => new Date(premierJour.getFullYear(), premierJour.getMonth(), 1),
  )
  // Le calendrier s'efface dès qu'un jour est choisi, pour laisser la place
  // aux horaires. « Changer de date » le rouvre : sauter à la semaine suivante
  // ne doit pas demander sept clics sur la flèche.
  const [choixDateOuvert, setChoixDateOuvert] = useState(false)


  // Debounce address changes (800 ms) to avoid spamming the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAddress(address), 800)
    return () => clearTimeout(t)
  }, [address])

  // Ignorer les anciennes réponses : adresse/date modifiées pendant une requête.
  useEffect(() => {
    if (!active || debouncedAddress.trim().length <= 5) return
    let stale = false
    setFetchingZone(true)
    setZoneAllowed(false)
    setZoneMessage(null)
    fetch(`/api/zone/check?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (!stale) { setZoneAllowed(data.allowed === true); setZoneMessage(data.allowed ? null : 'Adresse hors zone d’intervention') } })
      .catch(() => { if (!stale) { setZoneAllowed(false); setZoneMessage('Impossible de vérifier cette adresse. Réessayez.') } })
      .finally(() => { if (!stale) setFetchingZone(false) })
    return () => { stale = true }
  }, [debouncedAddress, washerId, active, retry])

  useEffect(() => {
    if (!active || !hasTravelFee || debouncedAddress.trim().length <= 5 || (travelFeeMode === 'previous' && !(selectedDate && selectedTime))) {
      setTravelFeeEstimate(null)
      setFetchingTravelFee(false)
      return
    }
    let stale = false
    let scheduled = ''
    if (selectedDate && selectedTime) {
      const dt = new Date(selectedDate)
      const [h, m] = selectedTime.split(':').map(Number)
      dt.setHours(h, m, 0, 0)
      scheduled = '&scheduled_at=' + encodeURIComponent(dt.toISOString())
    }
    setTravelFeeEstimate(null)
    setFetchingTravelFee(true)
    fetch(`/api/travel-fee?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}${scheduled}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (!stale) setTravelFeeEstimate(typeof data.fee === 'number' ? data.fee : null) })
      .catch(() => { if (!stale) setTravelFeeEstimate(null) })
      .finally(() => { if (!stale) setFetchingTravelFee(false) })
    return () => { stale = true }
  }, [debouncedAddress, selectedDate, selectedTime, washerId, hasTravelFee, travelFeeMode, active, retry])

  useEffect(() => {
    if (!active || !selectedDate || debouncedAddress.trim().length <= 5) return
    let stale = false
    setFetchingSmarts(true)
    setRequestError(null)
    fetch(`/api/slots/smart?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}&date=${toDateStr(selectedDate)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (!stale) {
        setSmartWindows(data.smartWindows ?? [])
        setBookingConstraints(data.bookingConstraints ?? [])
        setSmartDiscountType(data.discountType ?? 'fixed')
        setSmartDiscountValue(data.discountValue ?? 0)
      } })
      .catch(() => { if (!stale) { setSmartWindows([]); setBookingConstraints([]); setRequestError('Impossible de vérifier les horaires. Réessayez.') } })
      .finally(() => { if (!stale) setFetchingSmarts(false) })
    return () => { stale = true }
  }, [selectedDate, debouncedAddress, washerId, active, retry])

  const availableDaysOfWeek = availabilities.map(a => a.day_of_week)

  function getEffectiveTeamSize(date: Date): number {
    return computeEffectiveTeamSize(teamSize, unavailabilities, toDateStr(date))
  }

  function isDateUnavailable(date: Date): boolean {
    return getEffectiveTeamSize(date) === 0
  }

  /** Réservable = dans la fenêtre autorisée, un jour où le laveur travaille,
   *  et pas entièrement en congé. */
  function estReservable(d: Date): boolean {
    if (d < premierJour || d > dernierJour) return false
    return availableDaysOfWeek.includes(d.getDay()) && !isDateUnavailable(d)
  }

  function choisirJour(d: Date) {
    setSelectedDate(d)
    setSelectedTime(null)
    setVisibleSlots(6)
    setChoixDateOuvert(false)
  }

  const moisMin = new Date(premierJour.getFullYear(), premierJour.getMonth(), 1)
  const moisMax = new Date(dernierJour.getFullYear(), dernierJour.getMonth(), 1)
  const moisPrecedentPossible = moisAffiche > moisMin
  const moisSuivantPossible   = moisAffiche < moisMax
  const effectiveTeamSize = selectedDate ? getEffectiveTeamSize(selectedDate) : teamSize

  const overlapBookings = existingBookings.map(b => ({
    scheduled_at: b.scheduled_at,
    durationMin: effectiveDuration(embedDuration(b.services) + addonsDuration(b.selected_addons), b.vehicle_count),
  }))

  const dayAvailabilities = selectedDate
    ? availabilities.filter(a => a.day_of_week === selectedDate.getDay())
    : []

  const slotsForDay = selectedDate
    ? dayAvailabilities
        .flatMap(a => generateSlots(a.start_time, a.end_time, serviceDuration))
        // Sans effet un jour futur (jamais « passé ») ; retire les horaires du
        // matin quand le jour même est réservable et qu'il est déjà l'après-midi.
        .filter(slot => !slotEstPasse(slot, selectedDate))
        .filter(slot => countOverlaps(slot, selectedDate, serviceDuration, overlapBookings) < effectiveTeamSize)
        .filter(slot => isSlotFeasible(slot, selectedDate, serviceDuration, bookingConstraints))
    : []

  // Distingue « la prestation ne rentre nulle part ce jour-là » de « tout est
  // déjà réservé » : deux causes différentes derrière le même écran vide.
  const dureeTropLongue = selectedDate && dureeIncompatible(dayAvailabilities, serviceDuration)

  // Si le créneau sélectionné est devenu infaisable (contraintes de trajet chargées après),
  // on le désélectionne pour éviter qu'un client valide un RDV physiquement impossible.
  useEffect(() => {
    if (selectedTime && !fetchingSmarts && !slotsForDay.includes(selectedTime)) {
      setSelectedTime(null)
    }
  }, [slotsForDay]) // eslint-disable-line react-hooks/exhaustive-deps

  const smartSlotsInDay = selectedDate ? slotsForDay.filter(s => isSlotInWindows(s, selectedDate, smartWindows)) : []
  // Montrer les premières heures et jusqu'à deux créneaux avantageux sans
  // imposer une longue grille ; toutes les autres heures restent accessibles.
  const shownSlots = [...new Set([...smartSlotsInDay.slice(0, 2), ...slotsForDay])].slice(0, visibleSlots).sort()
  const addressReady = address.trim().length > 5 && address === debouncedAddress
  const busy = fetchingZone || fetchingTravelFee || fetchingSmarts || !addressReady
  const isSmart = !!(selectedDate && selectedTime && isSlotInWindows(selectedTime, selectedDate, smartWindows))
  const discount = isSmart ? smartDiscountAmount(servicePrice, { type: smartDiscountType, value: smartDiscountValue }) : 0
  const fee = hasTravelFee ? travelFeeEstimate ?? undefined : 0
  const canContinue = !!(selectedDate && selectedTime && slotsForDay.includes(selectedTime) && addressReady && zoneAllowed && !busy && !requestError && fee !== undefined)
  const scheduledAt = selectedDate && selectedTime ? (() => {
    const dt = new Date(selectedDate); const [h, m] = selectedTime.split(':').map(Number); dt.setHours(h, m, 0, 0); return dt.toISOString()
  })() : undefined
  useEffect(() => {
    if (active) onDraft({ address, scheduled_at: canContinue ? scheduledAt : undefined, travel_fee: addressReady ? fee : undefined,
      is_smart_slot: addressReady && isSmart, smart_discount: addressReady ? discount : 0 })
  }, [active, address, addressReady, scheduledAt, canContinue, fee, isSmart, discount, onDraft])

  const days: Date[] = []
  for (let d = new Date(premierJour); d <= dernierJour; d.setDate(d.getDate() + 1)) {
    if (estReservable(d)) days.push(new Date(d))
  }
  const hourLabel = (time: string) => time.replace(':00', ' h').replace(':', ' h ')
  const actionLabel = !addressReady ? 'Indiquez votre adresse' : busy ? 'Vérification en cours…' : !zoneAllowed ? 'Vérifiez votre adresse' : !selectedDate ? 'Choisissez un jour' : !selectedTime ? 'Choisissez une heure' : canContinue ? 'Continuer' : 'Vérifiez le créneau'
  return <div>
    <h2 className="wb-booking-title">Où et quand ?</h2>
    <label htmlFor="booking-address" className="block text-sm font-medium mb-2">Adresse du lavage</label>
    <AddressAutocomplete id="booking-address" value={address} onChange={value => { setAddress(value); setSelectedTime(null) }}
      placeholder="Numéro, rue, ville" allowGeolocation
      className="w-full min-h-12 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-3 bg-white dark:bg-zinc-900 outline-none focus:border-zinc-500" />
    {!addressReady && <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mt-6 mb-3">Les créneaux et le prix exact s’affichent dès que l’adresse est indiquée : les frais de déplacement en dépendent.</p>}
    {addressReady && <>
      {fetchingZone ? <p role="status" className="text-sm text-zinc-500 mt-3">Vérification de votre adresse…</p>
        : zoneMessage ? <p role="alert" className="text-sm text-red-600 mt-3">{zoneMessage} <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>Réessayer</button></p>
        : zoneAllowed && <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3">● Dans le secteur du laveur{fee === 0 ? ' : déplacement compris' : fee !== undefined ? ' · déplacement ' + fee + ' €' : ''}</p>}
      {zoneAllowed && <>
        <div className="flex items-center justify-between mt-6 mb-2"><h3 className="text-sm font-medium">Jour</h3><button type="button" className="text-xs underline min-h-8" onClick={() => setChoixDateOuvert(v => !v)}>{choixDateOuvert ? 'Fermer le calendrier' : 'Calendrier'}</button></div>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x" aria-label="Jours disponibles">
          {days.map(day => <button key={toDateStr(day)} type="button" aria-label={day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} aria-pressed={!!selectedDate && memeJour(day, selectedDate)}
            onClick={() => choisirJour(day)} className={'shrink-0 snap-start w-[58px] min-h-[64px] rounded-xl border text-center ' + (selectedDate && memeJour(day, selectedDate) ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700')}>
            <span className="block text-xs">{day.toLocaleDateString('fr-FR', { weekday: 'short' })}</span><span className="block text-xl leading-tight font-bold">{day.getDate()}</span><span className="block text-[10px] opacity-60">{MONTH_NAMES[day.getMonth()]}</span>
          </button>)}
        </div>
        {!days.length && <p className="text-sm text-zinc-500">Aucun jour disponible pour le moment.</p>}
        {choixDateOuvert && <div className="my-3 p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl">
          <div className="flex justify-between items-center mb-2"><button type="button" aria-label="Mois précédent" disabled={!moisPrecedentPossible} onClick={() => setMoisAffiche(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="w-11 h-11 disabled:opacity-30">←</button>
            <span className="text-sm font-semibold">{MOIS_LONGS[moisAffiche.getMonth()]} {moisAffiche.getFullYear()}</span><button type="button" aria-label="Mois suivant" disabled={!moisSuivantPossible} onClick={() => setMoisAffiche(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="w-11 h-11 disabled:opacity-30">→</button></div>
          <div className="grid grid-cols-7 gap-1">{ENTETES_SEMAINE.map((d, i) => <span key={i} className="text-center text-xs text-zinc-500">{d}</span>)}
            {grilleDuMois(moisAffiche).map((d, i) => d ? <button key={i} type="button" disabled={!estReservable(d)} onClick={() => choisirJour(d)} className="aspect-square rounded-lg text-sm disabled:opacity-25 hover:bg-zinc-100 dark:hover:bg-zinc-800">{d.getDate()}</button> : <span key={i} />)}
          </div>
        </div>}
        {selectedDate && <div className="mt-5">
          <h3 className="text-sm font-medium mb-3">Heure d’arrivée</h3>
          {fetchingSmarts ? <p role="status" className="text-sm text-zinc-500">Recherche des créneaux disponibles…</p> : requestError ? <p role="alert" className="text-sm text-red-600">{requestError} <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>Réessayer</button></p> : <>
            <div className="grid grid-cols-3 gap-2">{shownSlots.map(slot => {
              const smart = isSlotInWindows(slot, selectedDate, smartWindows)
              const amount = smart ? smartDiscountAmount(servicePrice, { type: smartDiscountType, value: smartDiscountValue }) : 0
              const chosen = selectedTime === slot
              return <button key={slot} type="button" aria-pressed={chosen} onClick={() => setSelectedTime(slot)} className={'min-h-[52px] rounded-xl border text-sm font-medium ' + (chosen ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : amount > 0 ? 'border-emerald-600/60 text-zinc-900 dark:text-zinc-100' : 'border-zinc-300 dark:border-zinc-700')}>
                <span className="block">{hourLabel(slot)}</span>{amount > 0 && <span className={'block text-[11px] ' + (chosen ? '' : 'text-emerald-700 dark:text-emerald-400')}>−{amount} €</span>}
              </button>
            })}</div>
            {slotsForDay.length > visibleSlots && <button type="button" onClick={() => setVisibleSlots(v => v + 12)} className="w-full text-sm underline min-h-11 mt-2">Voir plus d’horaires</button>}
            {!slotsForDay.length && <p className="text-sm text-zinc-500">{dureeTropLongue ? 'La prestation de ' + formatDureeFr(serviceDuration) + ' ne tient pas dans les horaires de ce jour. Choisissez une autre date.' : 'Aucun créneau disponible ce jour. Choisissez une autre date.'}</p>}
            {smartSlotsInDay.length > 0 && smartDiscountValue > 0 && <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 mt-4"><span className="text-emerald-700 dark:text-emerald-400 font-semibold">−{smartDiscountType === 'percent' ? smartDiscountValue + ' %' : smartDiscountValue + ' €'}</span> : ce jour-là, le laveur a déjà un rendez-vous tout près de chez vous. Moins de route pour lui, moins cher pour vous.</p>}
            {hasTravelFee && selectedTime && !fetchingTravelFee && fee === undefined && <p role="alert" className="text-sm text-red-600 mt-3">Impossible de calculer le déplacement. <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>Réessayer</button></p>}
          </>}
        </div>}
      </>}
    </>}
    <BookingAction target={actionTarget} accent={accent} disabled={!canContinue} onClick={() => { if (canContinue && scheduledAt) onNext({ scheduled_at: scheduledAt, address, is_smart_slot: isSmart, smart_discount: discount, travel_fee: fee }) }}>{actionLabel}</BookingAction>
  </div>
}
