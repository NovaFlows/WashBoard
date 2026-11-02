'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { toDateStr } from '@/lib/dateUtils'
import type { Booking, Unavailability } from '@/components/dashboard/calendrierTypes'
import { estJourneeEntiere, minutesDepuisMinuit } from '@/lib/slots'
import { effectiveDuration, addonsDuration } from '@/lib/pricing'

/** `journee` faux : un seul jour (`start`), de `debut` à `fin` ("HH:MM", heure de Paris). */
export type AjoutConge = { start: string; end: string; label: string; team_members_off: number; journee: boolean; debut: string; fin: string }

/** Corps de `POST /api/unavailabilities`. Une plage horaire ne couvre qu'un jour. */
export function corpsBlocage(f: AjoutConge) {
  return {
    start_date: f.start,
    end_date: f.journee ? f.end : f.start,
    label: f.label,
    team_members_off: f.team_members_off,
    ...(f.journee ? {} : { start_time: f.debut, end_time: f.fin }),
  }
}

type RendezVousAgenda = Pick<Booking, 'scheduled_at' | 'status' | 'services' | 'selected_addons' | 'vehicle_count'>

/** Rendez-vous déjà pris que ce blocage recouvre. Ils restent maintenus : la
 *  feuille prévient seulement le laveur. */
export function rendezVousTouches(f: AjoutConge, bookings: RendezVousAgenda[]): number {
  const fin = f.journee ? f.end : f.start
  return bookings.filter(b => {
    if (b.status === 'cancelled') return false
    const debutRdv = new Date(b.scheduled_at)
    const jour = toDateStr(debutRdv)
    if (jour < f.start || jour > fin) return false
    if (f.journee) return true
    const d = debutRdv.getHours() * 60 + debutRdv.getMinutes()
    const duree = effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count)
    return d < minutesDepuisMinuit(f.fin) && d + duree > minutesDepuisMinuit(f.debut)
  }).length
}

/** « Tu as déjà 1 rendez-vous sur cette plage. Il reste maintenu. » */
export function avisRendezVousTouches(n: number, journee: boolean): string | null {
  if (n === 0) return null
  return `Tu as déjà ${n} rendez-vous sur ${journee ? 'ces jours' : 'cette plage'}. ${n > 1 ? 'Ils restent maintenus' : 'Il reste maintenu'}.`
}

/**
 * Congés / indisponibilités : lister, bloquer une période, la supprimer.
 *
 * Extrait de `CalendrierDashboardV1.tsx` pendant le sous-lot 3 de la passe 7
 * (Agenda) de la refonte 2026, pour que v1 ET v2 la partagent au lieu d'en
 * dupliquer sa logique. Comportement INCHANGÉ par rapport à l'original —
 * mêmes requêtes (`/api/unavailabilities`), mêmes conditions, même tri.
 * Seule la présentation diverge entre `CalendrierDashboardV1.tsx` et
 * `CalendrierDashboardV2.tsx`.
 *
 * Possède son propre état `unavails` (contrairement à `useRendezVousFiche`
 * et `useRendezVousManuel`, qui reçoivent `bookings`/`setBookings` de
 * l'écran appelant) : les congés ne sont utiles qu'ici et dans ces deux
 * autres hooks pour un calcul de capacité en lecture seule — leur donner un
 * propriétaire unique évite de faire remonter encore un état de plus dans
 * chaque écran.
 */
export function useConges({
  initialUnavailabilities,
  teamSize,
}: {
  initialUnavailabilities: Unavailability[]
  teamSize: number
}) {
  const [unavails, setUnavails] = useState(initialUnavailabilities)
  const [addModal, setAddModalBrut] = useState<AjoutConge | null>(null)
  const [delModal, setDelModal] = useState<Unavailability | null>(null)
  const [uSaving,  setUSaving]  = useState(false)
  const [uErreur,  setUErreur]  = useState<string | null>(null)

  /** Toute modification de la feuille efface le dernier refus du serveur. */
  const setAddModal: Dispatch<SetStateAction<AjoutConge | null>> = valeur => {
    setUErreur(null)
    setAddModalBrut(valeur)
  }

  /** Le blocage du jour ; une journée entière passe avant une plage horaire. */
  function getUnavail(date: Date): Unavailability | null {
    const s = toDateStr(date)
    const duJour = unavails.filter(u => u.start_date <= s && s <= u.end_date)
    return duJour.find(estJourneeEntiere) ?? duJour[0] ?? null
  }

  function openAddModal(date: Date) {
    const s = toDateStr(date)
    setUErreur(null)
    setAddModal({ start: s, end: s, label: '', team_members_off: teamSize, journee: false, debut: '08:00', fin: '12:00' })
  }

  /** Journée fermée : toute l'équipe absente toute la journée. Une plage horaire ne ferme jamais le jour. */
  function isFullyUnavailable(u: Unavailability): boolean {
    return estJourneeEntiere(u) && (u.team_members_off ?? 1) >= teamSize
  }

  async function saveUnavail() {
    if (!addModal) return
    setUSaving(true)
    setUErreur(null)
    try {
      const res = await fetch('/api/unavailabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpsBlocage(addModal)),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setUnavails(u => [...u, json.data].sort((a, b) => a.start_date.localeCompare(b.start_date)))
        setAddModal(null)
      } else {
        setUErreur(json.error ?? 'Enregistrement impossible. Réessayez.')
      }
    } catch {
      setUErreur('Connexion impossible. Réessayez.')
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

  return {
    unavails, setUnavails,
    addModal, setAddModal,
    delModal, setDelModal,
    uSaving, uErreur,
    getUnavail, openAddModal, isFullyUnavailable, saveUnavail, deleteUnavail,
  }
}
