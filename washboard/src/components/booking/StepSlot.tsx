'use client'

import { useState, useEffect } from 'react'
import { BOOKING_HORIZON_DAYS } from '@/lib/bookingWindow'
import type { Availability } from '@/types'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { generateSlots, countOverlaps, isSlotInWindows, isSlotFeasible, effectiveTeamSize as computeEffectiveTeamSize, dureeIncompatible } from '@/lib/slots'
import { effectiveDuration, addonsDuration, smartPrice as computeSmartPrice, smartDiscountAmount, formatDureeFr } from '@/lib/pricing'
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
  onNext: (data: { scheduled_at: string; address: string; is_smart_slot?: boolean; smart_discount?: number; travel_fee?: number }) => void
  onBack: () => void
  accent?: string
}

const DAY_NAMES   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
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
  hasTravelFee = false, travelFeeMode = 'base', onNext, onBack, accent = '#2563eb',
}: Props) {
  const [selectedDate,      setSelectedDate]      = useState<Date | null>(null)
  const [selectedTime,      setSelectedTime]      = useState<string | null>(null)
  const [address,           setAddress]           = useState('')
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
  const [morningVisible,     setMorningVisible]     = useState(6)
  const [afternoonVisible,   setAfternoonVisible]   = useState(6)
  // Fenêtre réservable : de demain à l'horizon que le serveur accepte.
  const [premierJour] = useState(() => {
    const d = aMinuit(new Date())
    d.setDate(d.getDate() + 1)
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

  const SLOTS_PER_PAGE = 6

  // Debounce address changes (800 ms) to avoid spamming the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAddress(address), 800)
    return () => clearTimeout(t)
  }, [address])

  // Vérification de zone dès que l'adresse change (sans attendre la date)
  useEffect(() => {
    if (debouncedAddress.trim().length <= 5) {
      setZoneAllowed(true)
      setZoneMessage(null)
      setTravelFeeEstimate(null)
      return
    }
    fetch(`/api/zone/check?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}`)
      .then(r => r.json())
      .then((data: { allowed: boolean; distance_km?: number; radius_km?: number; department?: string; department_name?: string }) => {
        setZoneAllowed(data.allowed)
        if (!data.allowed) {
          setZoneMessage("Adresse hors zone d'intervention")
        } else {
          setZoneMessage(null)
        }
      })
      .catch(() => { setZoneAllowed(true); setZoneMessage(null) })
  }, [debouncedAddress, washerId])

  // Calcul des frais de déplacement estimés
  // Mode 'base'     → dès que l'adresse est saisie
  // Mode 'previous' → attend que date+heure soient sélectionnées pour trouver le bon RDV précédent
  useEffect(() => {
    const addressReady = debouncedAddress.trim().length > 5
    const needsSlot    = travelFeeMode === 'previous'
    const slotReady    = !!(selectedDate && selectedTime)

    if (!hasTravelFee || !addressReady || (needsSlot && !slotReady)) {
      setTravelFeeEstimate(null)
      return
    }

    let scheduledAtParam = ''
    if (selectedDate && selectedTime) {
      const [h, m] = selectedTime.split(':').map(Number)
      const dt = new Date(selectedDate)
      dt.setHours(h, m, 0, 0)
      scheduledAtParam = `&scheduled_at=${encodeURIComponent(dt.toISOString())}`
    }

    setFetchingTravelFee(true)
    fetch(`/api/travel-fee?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}${scheduledAtParam}`)
      .then(r => r.json())
      .then((data: { fee: number }) => setTravelFeeEstimate(data.fee))
      .catch(() => setTravelFeeEstimate(null))
      .finally(() => setFetchingTravelFee(false))
  }, [debouncedAddress, selectedDate, selectedTime, washerId, hasTravelFee, travelFeeMode])

  useEffect(() => {
    if (!selectedDate || debouncedAddress.trim().length <= 5) {
      setSmartWindows([])
      setBookingConstraints([])
      return
    }
    // Utiliser la date locale (pas UTC) pour éviter le décalage horaire
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
    setFetchingSmarts(true)
    fetch(`/api/slots/smart?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}&date=${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setSmartWindows(data.smartWindows ?? [])
        setBookingConstraints(data.bookingConstraints ?? [])
        setSmartDiscountType(data.discountType ?? 'fixed')
        setSmartDiscountValue(data.discountValue ?? 0)
      })
      .catch(() => { setSmartWindows([]); setBookingConstraints([]) })
      .finally(() => setFetchingSmarts(false))
  }, [selectedDate, debouncedAddress, washerId])

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

  /** Jour réservable suivant (1) ou précédent (-1), en sautant les jours
   *  fermés : une flèche doit faire avancer, pas tomber sur « aucun créneau ». */
  function jourVoisin(sens: 1 | -1): Date | null {
    if (!selectedDate) return null
    const d = new Date(selectedDate)
    for (let i = 0; i <= BOOKING_HORIZON_DAYS; i++) {
      d.setDate(d.getDate() + sens)
      if (d < premierJour || d > dernierJour) return null
      if (estReservable(d)) return new Date(d)
    }
    return null
  }

  function choisirJour(d: Date) {
    setSelectedDate(d)
    setSelectedTime(null)
    setMorningVisible(6)
    setAfternoonVisible(6)
    setChoixDateOuvert(false)
  }

  const moisMin = new Date(premierJour.getFullYear(), premierJour.getMonth(), 1)
  const moisMax = new Date(dernierJour.getFullYear(), dernierJour.getMonth(), 1)
  const moisPrecedentPossible = moisAffiche > moisMin
  const moisSuivantPossible   = moisAffiche < moisMax
  const montrerCalendrier = !selectedDate || choixDateOuvert
  // Calculés une fois : `jourVoisin` parcourt le calendrier jour par jour.
  const jourPrecedent = montrerCalendrier ? null : jourVoisin(-1)
  const jourSuivant   = montrerCalendrier ? null : jourVoisin(1)

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
        .filter(slot => countOverlaps(slot, selectedDate, serviceDuration, overlapBookings) < effectiveTeamSize)
        .filter(slot => isSlotFeasible(slot, selectedDate, serviceDuration, bookingConstraints))
    : []

  // Distingue « la prestation ne rentre nulle part ce jour-là » de « tout est
  // déjà réservé » : deux causes différentes derrière le même écran vide.
  const dureeTropLongue = selectedDate && dureeIncompatible(dayAvailabilities, serviceDuration)

  // Si le créneau sélectionné est devenu infaisable (contraintes de trajet chargées après),
  // on le désélectionne pour éviter qu'un client valide un RDV physiquement impossible.
  useEffect(() => {
    if (selectedTime && slotsForDay.length > 0 && !slotsForDay.includes(selectedTime)) {
      setSelectedTime(null)
    }
  }, [slotsForDay]) // eslint-disable-line react-hooks/exhaustive-deps

  const smartSlotsInDay = selectedDate ? slotsForDay.filter(s => isSlotInWindows(s, selectedDate, smartWindows)) : []
  const regularSlots    = selectedDate ? slotsForDay.filter(s => !isSlotInWindows(s, selectedDate, smartWindows)) : slotsForDay

  const smartPrice = computeSmartPrice(servicePrice, { type: smartDiscountType, value: smartDiscountValue })
  const smartPriceStr = Number.isInteger(smartPrice) ? String(smartPrice) : smartPrice.toFixed(2)

  const canContinue = selectedDate && selectedTime && address.trim().length > 5 && zoneAllowed

  function handleNext() {
    if (!selectedDate || !selectedTime || !address) return
    const [h, m] = selectedTime.split(':').map(Number)
    const dt = new Date(selectedDate)
    dt.setHours(h, m, 0, 0)
    const isSmart = isSlotInWindows(selectedTime, dt, smartWindows)
    const discount = isSmart ? smartDiscountAmount(servicePrice, { type: smartDiscountType, value: smartDiscountValue }) : 0
    onNext({
      scheduled_at: dt.toISOString(),
      address,
      is_smart_slot: isSmart,
      smart_discount: discount,
      travel_fee: travelFeeEstimate ?? undefined,
    })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Choisissez un créneau</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Où et quand souhaitez-vous être lavé ?</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Adresse du véhicule</label>
        <AddressAutocomplete
          value={address}
          onChange={setAddress}
          placeholder="12 rue de la Paix, 75001 Paris"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-shadow"
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
        />
        {hasTravelFee && address.trim().length > 5 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            {travelFeeMode === 'previous' && !(selectedDate && selectedTime) ? (
              <span>Les frais de déplacement seront calculés depuis votre RDV précédent une fois le créneau sélectionné.</span>
            ) : fetchingTravelFee ? (
              <span className="animate-pulse">Calcul des frais de déplacement...</span>
            ) : travelFeeEstimate != null && travelFeeEstimate > 0 ? (
              <span>Frais de déplacement estimés : <strong className="text-slate-700 dark:text-slate-200">{travelFeeEstimate}€</strong></span>
            ) : travelFeeEstimate === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">Pas de frais de déplacement pour cette adresse</span>
            ) : null}
          </div>
        )}
      </div>

      {zoneMessage && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>{zoneMessage}</span>
        </div>
      )}

      {/* Le calendrier occupe toute la largeur tant qu'aucun jour n'est choisi,
          puis s'efface au profit des horaires — ce sont deux moments distincts,
          pas deux listes à faire tenir ensemble sur un téléphone. */}
      {montrerCalendrier ? (
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Sélectionnez un jour</p>

          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMoisAffiche(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              disabled={!moisPrecedentPossible}
              aria-label="Mois précédent"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {MOIS_LONGS[moisAffiche.getMonth()]} {moisAffiche.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setMoisAffiche(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              disabled={!moisSuivantPossible}
              aria-label="Mois suivant"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
            {ENTETES_SEMAINE.map((jour, i) => (
              <span key={i} className="text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 py-1">{jour}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grilleDuMois(moisAffiche).map((jour, i) => {
              if (!jour) return <span key={`vide-${i}`} aria-hidden="true" />
              const libre  = estReservable(jour)
              const choisi = !!selectedDate && memeJour(selectedDate, jour)
              // Un congé se distingue d'un jour de fermeture habituel : le
              // client voit que le laveur travaille ce jour-là d'ordinaire.
              const conge  = jour >= premierJour && jour <= dernierJour
                && availableDaysOfWeek.includes(jour.getDay()) && isDateUnavailable(jour)
              return (
                <button
                  key={jour.toISOString()}
                  type="button"
                  onClick={() => choisirJour(jour)}
                  disabled={!libre}
                  aria-label={`${jour.getDate()} ${MOIS_LONGS[jour.getMonth()]}${libre ? '' : ' — indisponible'}`}
                  aria-current={choisi ? 'date' : undefined}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-semibold border-2 transition-all ${
                    choisi ? 'text-white shadow-md' :
                    conge  ? 'border-transparent bg-orange-50/60 dark:bg-orange-950/20 text-orange-300 dark:text-orange-700 cursor-not-allowed' :
                    libre  ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800' :
                    'border-transparent text-slate-300 dark:text-slate-700 cursor-not-allowed'
                  }`}
                  style={choisi ? { backgroundColor: accent, borderColor: accent } : undefined}
                >
                  {jour.getDate()}
                </button>
              )
            })}
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={() => setChoixDateOuvert(false)}
              className="mt-3 text-xs font-bold hover:opacity-70 transition-opacity"
              style={{ color: accent }}
            >
              ← Revenir aux horaires du {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]}
            </button>
          )}
        </div>
      ) : selectedDate && (
        /* Date choisie : une barre compacte suffit. Les flèches sautent au jour
           OUVERT suivant ou précédent — avancer d'un jour fermé ne servirait
           qu'à afficher « aucun créneau ». Le libellé central rouvre le
           calendrier, pour changer de semaine sans enchaîner les flèches. */
        <div className="mb-4 flex items-center gap-1 p-1 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            type="button"
            onClick={() => jourPrecedent && choisirJour(jourPrecedent)}
            disabled={!jourPrecedent}
            aria-label="Jour disponible précédent"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          <button
            type="button"
            onClick={() => {
              setMoisAffiche(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
              setChoixDateOuvert(true)
            }}
            className="flex-1 min-w-0 py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
          >
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {DAY_NAMES[selectedDate.getDay()]} {selectedDate.getDate()} {MOIS_LONGS[selectedDate.getMonth()]}
            </span>
            <span className="block text-[11px] font-medium" style={{ color: accent }}>Changer de date</span>
          </button>

          <button
            type="button"
            onClick={() => jourSuivant && choisirJour(jourSuivant)}
            disabled={!jourSuivant}
            aria-label="Jour disponible suivant"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      )}

      {selectedDate && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2.5">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Heure</p>
            {fetchingSmarts && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">Recherche des créneaux optimisés...</span>
            )}
          </div>

          {slotsForDay.length === 0 ? (
            <div className={`flex items-center gap-2 py-3 px-4 rounded-xl ${dureeTropLongue ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
              <svg className={`w-4 h-4 shrink-0 ${dureeTropLongue ? 'text-amber-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <p className={`text-sm ${dureeTropLongue ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {dureeTropLongue
                  ? `Avec les options choisies, la prestation dure ${formatDureeFr(serviceDuration)} et ne rentre dans aucun de vos horaires disponibles ce jour-là.`
                  : 'Aucun créneau disponible ce jour'}
              </p>
            </div>
          ) : (
            <>
              {/* Smart slots — shown first */}
              {smartSlotsInDay.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">★ Créneaux optimisés pour votre tournée</span>
                    {smartDiscountValue > 0 && (
                      <span className="text-[10px] bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                        -{smartDiscountType === 'percent' ? `${smartDiscountValue}%` : `${smartDiscountValue}€`}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {smartSlotsInDay.map(slot => {
                      const isSelected = selectedTime === slot
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 rounded-xl border-2 font-semibold transition-all flex flex-col items-center gap-0.5 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                              : 'border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-white dark:bg-amber-950/30 hover:border-amber-400'
                          }`}
                        >
                          <span className="text-sm">{slot}</span>
                          {servicePrice > 0 && smartDiscountValue > 0 && (
                            <span className={`text-[10px] font-bold ${isSelected ? 'opacity-90' : 'text-amber-600 dark:text-amber-400'}`}>
                              {smartPriceStr}€
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Regular slots — Matin / Après-midi */}
              {regularSlots.length > 0 && (() => {
                const morning   = regularSlots.filter(s => parseInt(s) < 12)
                const afternoon = regularSlots.filter(s => parseInt(s) >= 12)

                const SlotButton = ({ slot }: { slot: string }) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selectedTime === slot
                        ? 'text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                    style={selectedTime === slot ? { backgroundColor: accent, borderColor: accent } : undefined}
                  >
                    {slot}
                  </button>
                )

                const Section = ({ label, slots, visible, onMore }: { label: string; slots: string[]; visible: number; onMore: () => void }) => {
                  if (slots.length === 0) return null
                  const shown = slots.slice(0, visible)
                  const hasMore = slots.length > visible
                  return (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">{label}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {shown.map(slot => <SlotButton key={slot} slot={slot} />)}
                      </div>
                      {hasMore && (
                        <button
                          onClick={onMore}
                          className="mt-2.5 w-full py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          Voir plus ({slots.length - visible} créneaux)
                        </button>
                      )}
                    </div>
                  )
                }

                return (
                  <div>
                    {smartSlotsInDay.length > 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Autres créneaux disponibles</p>
                    )}
                    <Section label="Matin" slots={morning} visible={morningVisible} onMore={() => setMorningVisible(v => v + SLOTS_PER_PAGE)} />
                    <Section label="Après-midi" slots={afternoon} visible={afternoonVisible} onMore={() => setAfternoonVisible(v => v + SLOTS_PER_PAGE)} />
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
        >
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 py-3 px-4 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90 text-sm"
          style={{ backgroundColor: accent }}
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
