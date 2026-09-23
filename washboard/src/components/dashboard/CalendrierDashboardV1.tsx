'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { effectiveDuration, addonsDuration, formatPrice } from '@/lib/pricing'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'
import { openGmail, openWhatsapp } from '@/lib/contact'
import {
  getWeekStart, buildGrid, layoutDayBookings, isSameDay, dayKey, formatHeure, formatHeureCompacte, cleStatut,
} from '@/lib/calendarLayout'
import ConfirmerCloture from '@/components/dashboard/ConfirmerCloture'
import { doitDemanderConfirmation } from '@/lib/cloture'
import { useRendezVousFiche } from '@/hooks/useRendezVousFiche'
import { useRendezVousManuel, VEHICLE_TYPES } from '@/hooks/useRendezVousManuel'
import { useConges } from '@/hooks/useConges'

// Calendrier, présentation v1 — c'est ce que voit tout visiteur du SITE,
// mobile ou ordinateur : la refonte 2026 (agenda du jour, temps de route
// entre deux jobs) ne s'applique qu'à la PWA installée (décision
// d'Alexandre, 2026-09-22 — voir CalendrierDashboard.tsx, le point de
// branchement). Contenu identique au dernier commit avant la passe 7, à
// deux extractions de LOGIQUE PURE près qui ne changent aucun comportement
// (vérifié par les tests de `calendarLayout.test.ts` / `geo.test.ts`) :
// `cleStatut` et le calcul « km → minutes de trajet à 60 km/h » vivent
// maintenant dans `@/lib/calendarLayout` et `@/lib/geo`, pour que l'agenda
// v2 les réutilise au lieu d'en avoir sa propre copie — seule la
// présentation diverge entre v1 et v2, jamais le calcul.
//
// Sous-lot 3 (passe 7) : le RDV manuel et les congés/indisponibilités sont
// à leur tour extraits en logique pure partagée — `useRendezVousManuel`
// (`src/hooks/useRendezVousManuel.ts`) et `useConges`
// (`src/hooks/useConges.ts`), même principe que `useRendezVousFiche` au
// sous-lot 2. Comportement inchangé (vérifié à l'identique), seule la
// présentation de ce fichier reste v1 ; l'agenda v2
// (CalendrierDashboardV2.tsx) réutilise ces deux hooks pour sa propre
// présentation (feuilles v2), voir son commentaire d'en-tête.

// Types exportés : l'agenda v2 (CalendrierDashboardV2.tsx) les réutilise tels
// quels pour ses props plutôt que d'en garder une copie qui pourrait diverger
// silencieusement de la forme réelle envoyée par `calendrier/page.tsx`.
export type Service = { name: string; price: number; duration_minutes: number }
export type ServiceFull = { id: string; name: string; price: number; duration_minutes: number; vehicle_price_overrides: Record<string, number>; category_id: string | null; vehicle_types: string[] }
export type Category = { id: string; name: string; types: { id: string; name: string }[] }
export type Booking = {
  id: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  lat: number | null
  lng: number | null
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  is_smart_slot: boolean
  smart_discount: number
  booked_price: number | null
  selected_addons: { id: string; label: string; price: number; category: string; duration_minutes?: number }[] | null
  travel_fee: number | null
  vehicle_count: number | null
  vehicles_detail: { type: string; count: number; unit_price: number; label?: string; models?: string[] }[] | null
  // Catégorie jointe : « Lavage complet » ne dit pas si c'est une voiture ou
  // un canapé, alors que ça change le matériel à emporter.
  services: (Service & { service_categories?: { name: string } | null }) | null
  facture_numero?: string | null
  // Clôture tardive et type de client : la fenêtre de confirmation en a besoin
  // pour dire ce qui va se passer, et le badge « Délai dépassé » pour s'afficher.
  closed_late?: boolean | null
  is_professional?: boolean | null
}

const STATUS = {
  pending:     { label: 'En attente',    bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-300',   pill: 'bg-amber-400' },
  confirmed:   { label: 'Confirmé',      bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', pill: 'bg-emerald-400' },
  done:        { label: 'Terminé',       bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-300',     pill: 'bg-blue-400' },
  closed_late: { label: 'Délai dépassé', bg: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-600 dark:text-orange-400', pill: 'bg-orange-400' },
  cancelled:   { label: 'Annulé',        bg: 'bg-red-100 dark:bg-red-900/40',         text: 'text-red-700 dark:text-red-300',       pill: 'bg-red-400' },
}

const DAYS   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const HOUR_START  = 7
const HOUR_END    = 20
const HOUR_H      = 64 // px per hour slot


export type Unavailability = { id: string; start_date: string; end_date: string; label: string | null; team_members_off: number }

// VEHICLE_TYPES (repli de type de véhicule quand une prestation n'a pas de
// catégorie) et ManualBooking (forme du formulaire d'ajout manuel) vivent
// maintenant dans `@/hooks/useRendezVousManuel` — sous-lot 3, voir plus haut.

export type CalendrierProps = { bookings: Booking[]; unavailabilities: Unavailability[]; teamSize: number; services: ServiceFull[]; categories: Category[]; washerId: string; facturationPrete: boolean }

export default function CalendrierDashboardV1({ bookings: initial, unavailabilities: initialUnavail, teamSize, services, categories, washerId, facturationPrete }: CalendrierProps) {
  // serviceTypes/typeName viennent maintenant de useRendezVousManuel (plus bas).
  const today = new Date()
  const [view,        setView]        = useState<'month' | 'week' | 'day'>('month')
  const [current,     setCurrent]     = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [weekStart,   setWeekStart]   = useState(getWeekStart(today))
  const [dayDate,     setDayDate]     = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [bookings,    setBookings]    = useState(initial)
  // La liste du jour se retient par sa DATE, pas par un instantané de ses
  // réservations : dérivée de `byDate` à chaque rendu, elle reste à jour si
  // une réservation change pendant qu'elle est ouverte, et permet de
  // naviguer vers un jour voisin même vide (voir les flèches du modal).
  const [dayListDate, setDayListDate] = useState<Date | null>(null)

  // Congés / indisponibilités — extraits dans `useConges` pendant la passe 7,
  // sous-lot 3, pour que l'agenda v2 les partage au lieu d'en garder une
  // copie. Comportement inchangé.
  const {
    unavails,
    addModal, setAddModal,
    delModal, setDelModal,
    uSaving,
    getUnavail, openAddModal, isFullyUnavailable, saveUnavail, deleteUnavail,
  } = useConges({ initialUnavailabilities: initialUnavail, teamSize })

  // Fiche de rendez-vous actionnable (statut, reprogrammation, note,
  // facture) — extraite dans `useRendezVousFiche` pendant la passe 7,
  // sous-lot 2, pour que l'agenda v2 (CalendrierDashboardV2.tsx) la partage
  // au lieu d'en garder une copie. Comportement inchangé.
  const {
    selected, setSelected, openBooking,
    updating,
    editNotes, setEditNotes, notesSaving, saveNotes,
    rescheduling, setRescheduling, startReschedule,
    editDate, setEditDate, editTime, setEditTime, rescheduleSaving, rescheduleErr, saveReschedule,
    updateStatus,
    clotureDemandee, setClotureDemandee,
    factureEnCours, factureMsg, emettreFactureManuelle,
  } = useRendezVousFiche({ bookings, setBookings, unavailabilities: unavails, teamSize })

  // Arrivée depuis une notification : `?rdv=<id>` ouvre la fiche tout de suite.
  //
  // Sans ça, le laveur qui touchait « 🚗 Nouvelle réservation » atterrissait
  // sur le mois en cours et devait retrouver le rendez-vous lui-même — souvent
  // le téléphone à la main, entre deux voitures.
  //
  // Le mois, la semaine et le jour se calent aussi sur la date du rendez-vous :
  // en refermant la fiche, on doit retomber là où il se trouve, pas sur
  // aujourd'hui. `applique` garantit qu'on ne le fait qu'une fois : sinon,
  // refermer la fiche la rouvrirait aussitôt. Volontairement `setSelected(rdv)`
  // plutôt que `openBooking(rdv)` (identique à avant l'extraction) : ce
  // chemin ne pré-remplit donc pas `editNotes` avec la note existante tant
  // que la fiche n'est pas rouverte manuellement — comportement préexistant,
  // pas corrigé ici pour ne rien changer côté site (voir CalendrierDashboardV2
  // pour la version corrigée de ce même chemin).
  const searchParams = useSearchParams()
  const rdvParam = searchParams.get('rdv')
  const rdvApplique = useRef(false)

  useEffect(() => {
    if (rdvApplique.current || !rdvParam) return
    const rdv = bookings.find(b => b.id === rdvParam)
    if (!rdv) return
    rdvApplique.current = true
    const d = new Date(rdv.scheduled_at)
    setCurrent(new Date(d.getFullYear(), d.getMonth(), 1))
    setWeekStart(getWeekStart(d))
    setDayDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    setSelected(rdv)
  }, [rdvParam, bookings, setSelected])

  // Ajout manuel de réservation — extrait dans `useRendezVousManuel` pendant
  // la passe 7, sous-lot 3, pour que l'agenda v2 le partage au lieu d'en
  // garder une copie. Comportement inchangé (mêmes requêtes, mêmes
  // conditions, mêmes messages d'erreur).
  const {
    manualModal, setManualModal,
    manualSaving, manualErr,
    feasibilityWarn, setFeasibilityWarn,
    setOverrideFeasibility,
    openManualModal, updateManual, submitManualBooking,
    serviceTypes,
  } = useRendezVousManuel({ bookings, setBookings, unavailabilities: unavails, teamSize, services, categories, washerId })

  const grid     = buildGrid(current.getFullYear(), current.getMonth())
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })

  const byDate = new Map<string, Booking[]>()
  bookings.forEach(b => {
    const k = dayKey(new Date(b.scheduled_at))
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k)!.push(b)
  })
  const dayList = dayListDate ? (byDate.get(dayKey(dayListDate)) ?? []) : null

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

  // openBooking, startReschedule, saveReschedule, updateStatus,
  // emettreFactureManuelle, saveNotes, et les états qui les entourent
  // (selected, updating, editNotes, notesSaving, rescheduling, editDate,
  // editTime, rescheduleSaving, rescheduleErr, clotureDemandee,
  // factureEnCours, factureMsg) viennent maintenant de `useRendezVousFiche`
  // (voir plus haut) — extraits pendant la passe 7, sous-lot 2, pour être
  // partagés avec l'agenda v2. Comportement inchangé.

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
      <div className="mb-4 space-y-3">
        {/* Ligne 1 : titre + bouton ajouter */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Calendrier</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {monthBookings.length} réservation{monthBookings.length !== 1 ? 's' : ''} ce mois
              {pendingCount > 0 && <span className="ml-2 text-amber-500 font-medium">· {pendingCount} en attente</span>}
            </p>
          </div>
          <button
            onClick={() => openManualModal()}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Ajouter un RDV</span>
            <span className="sm:hidden">RDV</span>
          </button>
        </div>

        {/* Ligne 2 : navigation + toggle vue */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navigation < Mois Année > */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <button onClick={goBack} className="px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-2 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 text-center select-none capitalize whitespace-nowrap">
              {view === 'month' ? `${MONTHS[current.getMonth()]} ${current.getFullYear()}` : view === 'week' ? weekLabel : dayLabel}
            </span>
            <button onClick={goForward} className="px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={goToday}
            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Aujourd&apos;hui
          </button>

          {/* Toggle vue */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-sm ml-auto">
            {([['month', 'Mois'], ['week', 'Sem'], ['day', 'Jour']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  view === v
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
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
                  onClick={() => { setDayDate(day); setView('day') }}
                  className={`group min-h-[88px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800/50 cursor-pointer transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/25 ${
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
                      onClick={e => { e.stopPropagation(); setDelModal(unavail) }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                    >
                      {unavail.label ?? 'Indisponible'}
                      {teamSize > 1 && <span className="ml-1 opacity-70">{unavail.team_members_off}/{teamSize}</span>}
                    </button>
                  ) : (
                    <div className="space-y-0.5">
                      {unavail && (
                        <button
                          onClick={e => { e.stopPropagation(); setDelModal(unavail) }}
                          className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                        >
                          {unavail.label ?? 'Partiel'} {unavail.team_members_off}/{teamSize}
                        </button>
                      )}
                      {visible.map(b => (
                        <button
                          key={b.id}
                          onClick={e => { e.stopPropagation(); openBooking(b) }}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate transition-opacity hover:opacity-75 ${STATUS[cleStatut(b)].bg} ${STATUS[cleStatut(b)].text}`}
                        >
                          {b.is_smart_slot && '★ '}
                          {/* Sur téléphone la case est trop étroite pour « 08:00 Prénom » :
                              le texte se coupait en « 08:… ». On y garde l'heure seule,
                              en format court, et le prénom revient dès qu'il y a la place. */}
                          <span className="sm:hidden">{formatHeureCompacte(new Date(b.scheduled_at))}</span>
                          <span className="hidden sm:inline">{formatHeure(new Date(b.scheduled_at))} {b.client_name.split(' ')[0]}</span>
                        </button>
                      ))}
                      {overflow > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setDayListDate(day) }}
                          className="w-full text-left px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          +{overflow} autre{overflow > 1 ? 's' : ''}
                        </button>
                      )}
                      {!unavail && (
                        <button
                          onClick={e => { e.stopPropagation(); openAddModal(day) }}
                          className="w-full text-center py-0.5 text-[9px] text-slate-300 dark:text-slate-700 opacity-0 group-hover:opacity-100 hover:text-orange-400 dark:hover:text-orange-500 transition-all"
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
                  <button
                    onClick={() => { setDayDate(d); setView('day') }}
                    className={`text-sm font-bold mt-0.5 transition-all hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 rounded-full ${isToday ? 'w-7 h-7 bg-blue-600 text-white flex items-center justify-center mx-auto' : 'w-7 h-7 flex items-center justify-center mx-auto text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  >
                    {d.getDate()}
                  </button>
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
                      const height   = Math.max(effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count) * (HOUR_H / 60), 28)
                      const widthPct = 100 / b.totalCols
                      const leftPct  = b.col * widthPct
                      return (
                        <button
                          key={b.id}
                          onClick={() => openBooking(b)}
                          className={`absolute rounded-md px-1.5 py-1 text-left overflow-hidden hover:opacity-80 transition-opacity ${STATUS[cleStatut(b)].bg} ${STATUS[cleStatut(b)].text}`}
                          style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 2px)` }}
                        >
                          <p className="text-[10px] font-bold leading-tight truncate">{b.is_smart_slot && '★ '}{formatHeure(d)}</p>
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
                  const height   = Math.max(effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count) * (HOUR_H / 60), 28)
                  const widthPct = 100 / b.totalCols
                  const leftPct  = b.col * widthPct
                  return (
                    <button
                      key={b.id}
                      onClick={() => openBooking(b)}
                      className={`absolute rounded-md px-2 py-1 text-left overflow-hidden hover:opacity-80 transition-opacity ${STATUS[cleStatut(b)].bg} ${STATUS[cleStatut(b)].text}`}
                      style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 3px)` }}
                    >
                      <p className="text-xs font-bold leading-tight truncate">{b.is_smart_slot && '★ '}{formatHeure(d)} — {b.client_name}</p>
                      {b.services && <p className="text-[10px] leading-tight truncate opacity-80">{b.services.name} · {effectiveDuration((b.services.duration_minutes) + addonsDuration(b.selected_addons), b.vehicle_count)} min</p>}
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
      {dayList && dayListDate && !selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDayListDate(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs border border-slate-200 dark:border-slate-700 p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 gap-2">
              {/* Flèches vers le jour voisin : avant, il fallait refermer la
                  fenêtre et recliquer sur le jour suivant dans la grille du
                  mois. Elles marchent même si le jour voisin n'a aucun
                  rendez-vous — la liste dérivée de `dayListDate` gère ce cas. */}
              <button
                onClick={() => setDayListDate(d => { const n = new Date(d!); n.setDate(n.getDate() - 1); return n })}
                aria-label="Jour précédent"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-center flex-1 truncate">
                {dayListDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button
                onClick={() => setDayListDate(d => { const n = new Date(d!); n.setDate(n.getDate() + 1); return n })}
                aria-label="Jour suivant"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setDayListDate(null)} className="shrink-0 text-slate-400 hover:text-slate-600 ml-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {dayList.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Aucun rendez-vous ce jour.</p>
            ) : (
              <div className="space-y-2">
                {dayList.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { openBooking(b); setDayListDate(null) }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 ${STATUS[cleStatut(b)].bg} ${STATUS[cleStatut(b)].text} hover:opacity-80 transition-opacity`}
                  >
                    <span className="text-sm font-semibold">{b.client_name}</span>
                    <span className="text-xs opacity-80">{formatHeure(new Date(b.scheduled_at))}</span>
                  </button>
                ))}
              </div>
            )}
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
                      ? 'Toute l\'équipe — les créneaux seront bloqués'
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
                  {isFullyUnavailable(delModal) ? 'Toute l\'équipe' : `${delModal.team_members_off} / ${teamSize} laveurs`}
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
                      <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Type</label>
                      {(() => {
                        const opts = serviceTypes(manualModal.service_id)
                        const list = opts.length > 0 ? opts.map(t => ({ value: t.id, label: t.name })) : VEHICLE_TYPES
                        return (
                          <select value={manualModal.vehicle_type} onChange={e => updateManual('vehicle_type', e.target.value)}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {list.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                          </select>
                        )
                      })()}
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
                    <AddressAutocomplete
                      value={manualModal.address}
                      onChange={v => updateManual('address', v)}
                      onSelectWithCoords={(label, lat, lng) => setManualModal(m => m ? { ...m, address: label, lat, lng } : m)}
                      placeholder="12 rue de la Paix, 75001 Paris"
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
                      <input type="text" placeholder="Ma Société SAS" value={manualModal.company_name}
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

              {/* Avertissement faisabilité */}
              {feasibilityWarn && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Problème de faisabilité détecté</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed mb-3">{feasibilityWarn}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 font-medium mb-3">Êtes-vous sûr de vouloir créer ce rendez-vous ?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setFeasibilityWarn(null); setOverrideFeasibility(false) }}
                      className="flex-1 py-2 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOverrideFeasibility(true); submitManualBooking(true) }}
                      disabled={manualSaving}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-colors">
                      {manualSaving ? 'Création...' : 'Confirmer quand même'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!feasibilityWarn && (
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setManualModal(null)}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => submitManualBooking()} disabled={manualSaving}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors">
                    {manualSaving ? 'Création...' : 'Créer le RDV'}
                  </button>
                </div>
              )}
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
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[cleStatut(selected)].bg} ${STATUS[cleStatut(selected)].text}`}>
                {STATUS[cleStatut(selected)].label}
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
                  {selected.services.service_categories?.name
                    ? `${selected.services.service_categories.name} · ${selected.services.name}`
                    : selected.services.name} · {effectiveDuration((selected.services.duration_minutes) + addonsDuration(selected.selected_addons), selected.vehicle_count)} min ·{' '}
                  {selected.is_smart_slot && Number(selected.smart_discount) > 0 ? (
                    <>
                      <span className="line-through opacity-50">{(selected.booked_price ?? selected.services.price) - (selected.travel_fee ?? 0)}€</span>
                      {' '}
                      <span className="font-semibold">{formatPrice((selected.booked_price ?? selected.services.price) - (selected.travel_fee ?? 0) - Number(selected.smart_discount))}</span>
                      {' '}
                      <span className="text-amber-500 font-bold">★ smart</span>
                    </>
                  ) : `${(selected.booked_price ?? selected.services.price) - (selected.travel_fee ?? 0)}€`}
                </Row>
              )}
              {selected.vehicles_detail && selected.vehicles_detail.length > 0 && (
                <Row icon="car">
                  {selected.vehicles_detail.flatMap(v => {
                    const label = v.label ?? VEHICLE_LABELS[v.type] ?? v.type
                    const mdls = (v.models ?? []).map(m => m.trim()).filter(Boolean)
                    if (mdls.length === 0) return [`${label} × ${v.count}`]
                    const lines = mdls.map(m => `${label} — ${m}`)
                    if (mdls.length < v.count) lines.push(`${label} × ${v.count - mdls.length}`)
                    return lines
                  }).map((line, i) => <span key={i} className="block">{line}</span>)}
                </Row>
              )}
              {rescheduling ? (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 text-blue-500 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                        className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                        className="w-24 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {rescheduleErr && <p className="text-xs text-red-600 dark:text-red-400">{rescheduleErr}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={saveReschedule}
                        disabled={rescheduleSaving}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {rescheduleSaving ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                      <button
                        onClick={() => setRescheduling(false)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 group/resched">
                  <svg className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span className="flex-1">
                    {new Date(selected.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' '}à {formatHeure(new Date(selected.scheduled_at))}
                  </span>
                  {selected.status !== 'cancelled' && selected.status !== 'done' && (
                    <button
                      onClick={() => startReschedule(selected)}
                      className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              )}
              <Row icon="pin">{selected.address}</Row>
            </div>

            {/* Options supplémentaires + frais de déplacement + total */}
            {((selected.selected_addons && selected.selected_addons.length > 0) || (selected.travel_fee != null && selected.travel_fee > 0)) && (
              <div className="mb-4 space-y-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Détail du prix</p>
                {selected.selected_addons?.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{a.label}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">+{a.price}€</span>
                  </div>
                ))}
                {selected.travel_fee != null && selected.travel_fee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Frais de déplacement</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">+{selected.travel_fee}€</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Total</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {selected.is_smart_slot && Number(selected.smart_discount) > 0
                      ? formatPrice((selected.booked_price ?? selected.services?.price ?? 0) - Number(selected.smart_discount))
                      : `${selected.booked_price ?? selected.services?.price ?? 0}€`}
                  </span>
                </div>
              </div>
            )}

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
                {/* Aussi sur un rendez-vous resté « en attente » : certains
                    laveurs vont chez le client sans avoir confirmé dans l'app,
                    et devaient confirmer puis terminer — deux gestes pour un. */}
                {(selected.status === 'confirmed' || selected.status === 'pending') && (
                  <button
                    // Créneau déjà passé : on demande d'abord si le rendez-vous a
                    // eu lieu — « Terminé » émet la facture. À l'heure ou en
                    // avance, la clôture reste d'un seul clic.
                    onClick={() => doitDemanderConfirmation(selected, new Date())
                      ? setClotureDemandee(true)
                      : updateStatus(selected.id, 'done')}
                    disabled={updating}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {selected.status === 'pending' ? 'Terminé' : 'Marquer terminé'}
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

            {clotureDemandee && (
              <ConfirmerCloture
                clientName={selected.client_name}
                quand={`${new Date(selected.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${formatHeure(new Date(selected.scheduled_at))}`}
                professionnel={!!selected.is_professional}
                facturationPrete={facturationPrete}
                onFait={() => { setClotureDemandee(false); updateStatus(selected.id, 'done', true) }}
                onPasFait={() => { setClotureDemandee(false); updateStatus(selected.id, 'cancelled') }}
                onClose={() => setClotureDemandee(false)}
              />
            )}

            {/* Facture : émise au passage en « Terminé », ou à la demande */}
            {selected.status === 'done' && (
              <div className="mb-3">
                {selected.facture_numero ? (
                  <a
                    href={`/api/bookings/${selected.id}/pdf`}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Télécharger la facture {selected.facture_numero}
                  </a>
                ) : (
                  <button
                    onClick={() => emettreFactureManuelle(selected.id)}
                    disabled={factureEnCours}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {factureEnCours ? 'Émission...' : 'Émettre la facture'}
                  </button>
                )}
                {factureMsg?.id === selected.id && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    {factureMsg.texte}{' '}
                    {factureMsg.completer && (
                      <Link href="/dashboard/parametres#facturation" className="font-semibold underline">
                        Compléter mes informations
                      </Link>
                    )}
                  </p>
                )}
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
    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
      <svg className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {icons[icon]}
      </svg>
      <span>{children}</span>
    </div>
  )
}
