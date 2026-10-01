'use client'

import { type Dispatch, type SetStateAction, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toDateStr } from '@/lib/dateUtils'
import { effectiveDuration, addonsDuration } from '@/lib/pricing'
import type { Booking, Unavailability } from '@/components/dashboard/CalendrierDashboardV1'

export type FactureMessage = { id: string; texte: string; completer: boolean }

/**
 * Fiche de rendez-vous ACTIONNABLE : changer de statut, reprogrammer, écrire
 * une note, émettre une facture.
 *
 * Extrait de `CalendrierDashboardV1.tsx` pendant le sous-lot 2 de la passe 7
 * (Agenda) de la refonte 2026, pour que v1 ET v2 la partagent au lieu d'en
 * dupliquer ~400 lignes fortement couplées à la liste complète des
 * rendez-vous et des congés (chevauchement, capacité d'équipe restante).
 *
 * Comportement INCHANGÉ par rapport à l'original — même requêtes, mêmes
 * conditions, mêmes messages d'erreur. Seule la présentation (le JSX qui
 * affiche ces états et appelle ces fonctions) diverge entre
 * `CalendrierDashboardV1.tsx` et `CalendrierDashboardV2.tsx`.
 *
 * Ne gère PAS l'ouverture depuis `?rdv=<id>` (lien de notification) : cette
 * partie reste propre à chaque écran, parce qu'elle doit aussi positionner
 * la navigation du calendrier (mois/semaine/jour en v1, jour seul en v2) —
 * seul « ouvrir la fiche » une fois le bon rendez-vous trouvé passe par ce
 * hook, via `openBooking`.
 */
export function useRendezVousFiche({
  bookings,
  setBookings,
  unavailabilities,
  teamSize,
}: {
  bookings: Booking[]
  setBookings: Dispatch<SetStateAction<Booking[]>>
  unavailabilities: Unavailability[]
  teamSize: number
}) {
  const router = useRouter()

  const [selected, setSelected] = useState<Booking | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  // Reprogrammation (modifier date/heure d'un RDV existant)
  const [rescheduling, setRescheduling] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [rescheduleSaving, setRescheduleSaving] = useState(false)
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null)

  // Fenêtre « Avez-vous fait ce rendez-vous ? », pour un créneau déjà passé.
  const [clotureDemandee, setClotureDemandee] = useState(false)
  const [factureEnCours, setFactureEnCours] = useState(false)
  const [factureMsg, setFactureMsg] = useState<FactureMessage | null>(null)

  function openBooking(b: Booking) {
    setSelected(b)
    setEditNotes(b.notes ?? '')
    setRescheduling(false)
    setRescheduleErr(null)
  }

  function startReschedule(b: Booking) {
    const d = new Date(b.scheduled_at)
    setEditDate(toDateStr(d))
    setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    setRescheduleErr(null)
    setRescheduling(true)
  }

  async function saveReschedule() {
    if (!selected) return
    setRescheduleErr(null)
    const newStart = new Date(`${editDate}T${editTime}:00`)
    if (isNaN(newStart.getTime())) { setRescheduleErr('Date ou heure invalide'); return }

    const durationMin = effectiveDuration((selected.services?.duration_minutes ?? 60) + addonsDuration(selected.selected_addons), selected.vehicle_count)
    const newEnd      = new Date(newStart.getTime() + durationMin * 60_000)
    const dayStr      = editDate

    // Capacité de l'équipe ce jour-là (congés partiels)
    const dayUnavail    = unavailabilities.find(u => u.start_date <= dayStr && dayStr <= u.end_date)
    const effectiveTeam = Math.max(0, teamSize - (dayUnavail?.team_members_off ?? 0))
    if (effectiveTeam === 0) { setRescheduleErr("Toute l'équipe est en congés ce jour-là"); return }

    // RDV qui se chevauchent (hors le RDV courant et les annulés)
    const overlapping = bookings.filter(b => {
      if (b.id === selected.id || b.status === 'cancelled') return false
      const bStart = new Date(b.scheduled_at).getTime()
      const bEnd   = bStart + effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count) * 60_000
      return bStart < newEnd.getTime() && bEnd > newStart.getTime()
    })
    if (overlapping.length >= effectiveTeam) {
      setRescheduleErr(`Créneau complet — ${overlapping.length}/${effectiveTeam} laveur${effectiveTeam > 1 ? 's' : ''} déjà occupé${effectiveTeam > 1 ? 's' : ''} à cet horaire`)
      return
    }

    const scheduled_at = newStart.toISOString()
    setRescheduleSaving(true)
    try {
      const res = await fetch(`/api/bookings/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setRescheduleErr(json.error ?? 'Erreur lors de la modification')
        return
      }
      setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, scheduled_at } : b)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
      setSelected(prev => prev ? { ...prev, scheduled_at } : prev)
      setRescheduling(false)
    } finally {
      setRescheduleSaving(false)
    }
  }

  // `closedLate` : clôturé après coup, comme sur l'accueil — le rendez-vous
  // porte alors « Délai dépassé » plutôt que « Terminé ».
  async function updateStatus(id: string, status: string, closedLate?: boolean) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(closedLate !== undefined ? { closed_late: closedLate } : {}) }),
      })
      if (res.ok) {
        // Passer en « Terminé » émet la facture : on récupère son numéro pour
        // proposer le téléchargement sans recharger la page.
        const maj = await res.json().catch(() => null) as { facture_numero?: string | null } | null
        const facture = maj?.facture_numero ? { facture_numero: maj.facture_numero } : {}
        // `closed_late` suit le statut en mémoire : sans lui, le badge
        // « Délai dépassé » n'apparaissait qu'après rechargement de la page.
        const champs = {
          status: status as Booking['status'],
          ...facture,
          ...(closedLate !== undefined ? { closed_late: closedLate } : {}),
        }
        setBookings(prev => prev.map(b => b.id === id ? { ...b, ...champs } : b))
        setSelected(prev => prev?.id === id ? { ...prev, ...champs } : prev)
        // La grille/liste de CET écran est déjà à jour via `setBookings`, mais
        // sans ceci l'accueil, lui, resterait périmé tant qu'on ne le
        // rechargerait pas — les deux écrans ont chacun leur propre état,
        // `router.refresh()` invalide le cache pour la suite.
        router.refresh()
      }
    } finally {
      setUpdating(false)
    }
  }

  /** Émission à la demande, pour un rendez-vous terminé avant que les
   *  informations de facturation soient remplies. */
  async function emettreFactureManuelle(id: string) {
    setFactureEnCours(true)
    setFactureMsg(null)
    try {
      const res = await fetch(`/api/bookings/${id}/facture`, { method: 'POST' })
      const json = await res.json().catch(() => ({})) as { numero?: string; error?: string }
      if (res.ok && json.numero) {
        const facture = { facture_numero: json.numero }
        setBookings(prev => prev.map(b => b.id === id ? { ...b, ...facture } : b))
        setSelected(prev => prev?.id === id ? { ...prev, ...facture } : prev)
      } else {
        setFactureMsg({ id, texte: json.error ?? 'L\'émission de la facture a échoué.', completer: res.status === 422 })
      }
    } finally {
      setFactureEnCours(false)
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

  return {
    selected, setSelected, openBooking,
    updating,
    editNotes, setEditNotes, notesSaving, saveNotes,
    rescheduling, setRescheduling, startReschedule,
    editDate, setEditDate, editTime, setEditTime, rescheduleSaving, rescheduleErr, saveReschedule,
    updateStatus,
    clotureDemandee, setClotureDemandee,
    factureEnCours, factureMsg, emettreFactureManuelle,
  }
}
