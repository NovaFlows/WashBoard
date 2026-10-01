'use client'

import { type Dispatch, type SetStateAction, useState } from 'react'
import { effectiveDuration, addonsDuration } from '@/lib/pricing'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'
import { haversineKm, estimateTravelMinutes } from '@/lib/geo'
import { toDateStr } from '@/lib/dateUtils'
import type { Booking, Unavailability, ServiceFull, Category } from '@/components/dashboard/CalendrierDashboardV1'

export const VEHICLE_TYPES = [
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

export type ManualBooking = {
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
  lat: number | null
  lng: number | null
  is_professional: boolean
  company_name: string
  siret: string
  billing_address: string
  notes: string
  status: 'pending' | 'confirmed'
}

/**
 * Ajout manuel de rendez-vous (le bouton « Ajouter un RDV » de v1, le « + »
 * de la maquette v2) : validation, contrôle de disponibilité (capacité
 * d'équipe restante compte tenu des congés), avertissement de faisabilité
 * (trajet trop court entre deux jobs) non bloquant, puis création.
 *
 * Extrait de `CalendrierDashboardV1.tsx` pendant le sous-lot 3 de la passe 7
 * (Agenda) de la refonte 2026, pour que v1 ET v2 la partagent au lieu d'en
 * dupliquer ~220 lignes fortement couplées à la liste complète des
 * rendez-vous, des services et des congés.
 *
 * Comportement INCHANGÉ par rapport à l'original — mêmes requêtes, mêmes
 * conditions, mêmes messages d'erreur. Seule la présentation (le formulaire
 * qui affiche ces états et appelle ces fonctions) diverge entre
 * `CalendrierDashboardV1.tsx` et `CalendrierDashboardV2.tsx`.
 */
export function useRendezVousManuel({
  bookings,
  setBookings,
  unavailabilities,
  teamSize,
  services,
  categories,
  washerId,
  onCree,
}: {
  bookings: Booking[]
  setBookings: Dispatch<SetStateAction<Booking[]>>
  unavailabilities: Unavailability[]
  teamSize: number
  services: ServiceFull[]
  categories: Category[]
  washerId: string
  /** Appelé une fois, après l'ajout du rendez-vous à la liste (jamais en cas
   *  d'erreur ni d'avertissement de faisabilité en attente). Facultatif : v1
   *  ne le passe pas, son comportement reste donc strictement celui d'avant.
   *  Sert à l'agenda v2 pour se placer sur le jour du rendez-vous créé. */
  onCree?: (booking: Booking) => void
}) {
  // Types disponibles pour une prestation = types de sa catégorie qu'elle propose
  function serviceTypes(serviceId: string): { id: string; name: string }[] {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return []
    const cat = categories.find(c => c.id === svc.category_id)
    const catTypes = cat?.types ?? []
    const filtered = catTypes.filter(t => svc.vehicle_types.includes(t.id))
    return filtered.length > 0 ? filtered : catTypes
  }
  function typeName(serviceId: string, typeId: string): string {
    return serviceTypes(serviceId).find(t => t.id === typeId)?.name ?? VEHICLE_LABELS[typeId] ?? typeId
  }

  const emptyManual = (): ManualBooking => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    const firstService = services[0]?.id ?? ''
    return {
      service_id: firstService,
      vehicle_type: serviceTypes(firstService)[0]?.id ?? 'citadine',
      vehicle_count: 1,
      booked_price: services[0]?.price ?? 0,
      date: toDateStr(now),
      time: `${String(now.getHours()).padStart(2, '0')}:00`,
      client_name: '', client_email: '', client_phone: '', address: '', lat: null, lng: null,
      is_professional: false, company_name: '', siret: '', billing_address: '',
      notes: '', status: 'confirmed',
    }
  }

  const [manualModal,       setManualModal]       = useState<ManualBooking | null>(null)
  const [manualSaving,      setManualSaving]      = useState(false)
  const [manualErr,         setManualErr]         = useState<string | null>(null)
  const [feasibilityWarn,   setFeasibilityWarn]   = useState<string | null>(null)
  const [overrideFeasibility, setOverrideFeasibility] = useState(false)

  function openManualModal(date?: Date) {
    const m = emptyManual()
    if (date) m.date = toDateStr(date)
    setManualModal(m)
    setManualErr(null)
    setFeasibilityWarn(null)
    setOverrideFeasibility(false)
  }

  function updateManual<K extends keyof ManualBooking>(key: K, value: ManualBooking[K]) {
    setManualModal(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      // Changement de prestation : réinitialise le type sur le 1er type de sa catégorie
      if (key === 'service_id') {
        next.vehicle_type = serviceTypes(next.service_id)[0]?.id ?? ''
      }
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

  async function submitManualBooking(forceOverride = false) {
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
    const durationMs    = (svcCheck?.duration_minutes ?? 60) * Math.max(1, manualModal.vehicle_count) * 60_000
    const selectedEnd   = new Date(selectedStart.getTime() + durationMs)
    const dayStr        = manualModal.date

    // Taille d'équipe effective en tenant compte des congés partiels
    const dayUnavail    = unavailabilities.find(u => u.start_date <= dayStr && dayStr <= u.end_date)
    const effectiveTeam = Math.max(0, teamSize - (dayUnavail?.team_members_off ?? 0))

    if (effectiveTeam === 0) {
      setManualErr("Impossible — toute l'équipe est en congés ce jour-là")
      return
    }

    // Compter les RDV non-annulés qui se chevauchent avec ce créneau
    const overlapping = bookings.filter(b => {
      if (b.status === 'cancelled') return false
      const bStart = new Date(b.scheduled_at).getTime()
      const bEnd   = bStart + effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count) * 60_000
      return bStart < selectedEnd.getTime() && bEnd > selectedStart.getTime()
    })

    if (overlapping.length >= effectiveTeam) {
      setManualErr(
        `Créneau complet — ${overlapping.length}/${effectiveTeam} laveur${effectiveTeam > 1 ? 's' : ''} déjà occupé${effectiveTeam > 1 ? 's' : ''} à cet horaire`
      )
      return
    }

    // ── Vérification de faisabilité (avertissement non bloquant) ───────────
    if (!overrideFeasibility && !forceOverride) {
      const WINDOW_MS = 75 * 60_000 // RDV dans la fenêtre ±75 min
      const sameDayActive = bookings.filter(b => b.status !== 'cancelled' && b.scheduled_at.startsWith(manualModal.date))
      let warning: string | null = null

      for (const b of sameDayActive) {
        const bStart  = new Date(b.scheduled_at).getTime()
        const bEnd    = bStart + effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count) * 60_000
        const newStart = selectedStart.getTime()
        const newEnd   = selectedEnd.getTime()

        // RDV qui finit juste avant le nouveau
        if (bEnd <= newStart && newStart - bEnd < WINDOW_MS) {
          const gapMin = Math.round((newStart - bEnd) / 60_000)
          if (manualModal.lat && b.lat && b.lng) {
            const km      = haversineKm(b.lat, b.lng, manualModal.lat, manualModal.lng!)
            const travelMin = estimateTravelMinutes(km)
            if (travelMin > gapMin) {
              warning = `RDV précédent se termine à ${new Date(bEnd).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à "${b.address.split(',')[0]}" — trajet estimé ~${travelMin} min pour ~${Math.round(km)} km, mais seulement ${gapMin} min disponibles.`
              break
            }
          } else if (gapMin < 15) {
            warning = `RDV précédent se termine à ${new Date(bEnd).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — seulement ${gapMin} min d'écart, vérifiez que le trajet est faisable.`
            break
          }
        }

        // RDV qui commence juste après le nouveau
        if (bStart >= newEnd && bStart - newEnd < WINDOW_MS) {
          const gapMin = Math.round((bStart - newEnd) / 60_000)
          if (manualModal.lat && b.lat && b.lng) {
            const km      = haversineKm(manualModal.lat, manualModal.lng!, b.lat, b.lng)
            const travelMin = estimateTravelMinutes(km)
            if (travelMin > gapMin) {
              warning = `RDV suivant débute à ${new Date(bStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à "${b.address.split(',')[0]}" — trajet estimé ~${travelMin} min pour ~${Math.round(km)} km, mais seulement ${gapMin} min disponibles.`
              break
            }
          } else if (gapMin < 15) {
            warning = `RDV suivant démarre à ${new Date(bStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — seulement ${gapMin} min d'écart, vérifiez que le trajet est faisable.`
            break
          }
        }
      }

      if (warning) {
        setFeasibilityWarn(warning)
        setManualSaving(false)
        return
      }
    }
    setFeasibilityWarn(null)
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
        vehicles_detail: [{
          type:       manualModal.vehicle_type,
          count:      manualModal.vehicle_count,
          unit_price: (() => { const s = services.find(s => s.id === manualModal.service_id); return s ? (s.vehicle_price_overrides?.[manualModal.vehicle_type] ?? s.price) : 0 })(),
          label:      typeName(manualModal.service_id, manualModal.vehicle_type),
        }],
        booked_price:    manualModal.booked_price,
        address:         manualModal.address,
        scheduled_at,
        client_name:     manualModal.client_name,
        client_email:    manualModal.client_email,
        client_phone:    manualModal.client_phone,
        lat:             manualModal.lat ?? undefined,
        lng:             manualModal.lng ?? undefined,
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
      lat:          manualModal.lat,
      lng:          manualModal.lng,
      scheduled_at,
      status:       manualModal.status,
      notes:        manualModal.notes || null,
      is_smart_slot: false,
      smart_discount: 0,
      booked_price:    manualModal.booked_price,
      selected_addons: null,
      travel_fee:      null,
      vehicle_count:   manualModal.vehicle_count,
      vehicles_detail: [{ type: manualModal.vehicle_type, count: manualModal.vehicle_count, unit_price: svc ? (svc.vehicle_price_overrides?.[manualModal.vehicle_type] ?? svc.price) : 0, label: typeName(manualModal.service_id, manualModal.vehicle_type) }],
      // La catégorie est reconstituée ici : ce rendez-vous est ajouté à la liste
      // sans repasser par le serveur, il n'a donc pas la jointure. Sans ça, un
      // rendez-vous créé à la main serait le seul à ne pas afficher son type.
      services:        svc ? {
        name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes,
        service_categories: categories.find(c => c.id === svc.category_id)
          ? { name: categories.find(c => c.id === svc.category_id)!.name }
          : null,
      } : null,
    }
    // Applique toujours le statut choisi (l'API crée en 'pending' par défaut)
    await fetch(`/api/bookings/${json.data.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: manualModal.status }),
    })
    setBookings(prev => [...prev, newBooking].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    setManualModal(null)
    setManualSaving(false)
    onCree?.(newBooking)
  }

  return {
    manualModal, setManualModal,
    manualSaving, manualErr, setManualErr,
    feasibilityWarn, setFeasibilityWarn,
    overrideFeasibility, setOverrideFeasibility,
    openManualModal, updateManual, submitManualBooking,
    serviceTypes, typeName,
  }
}
