'use client'

import { useState } from 'react'
import { toDateStr } from '@/lib/dateUtils'
import type { Unavailability } from '@/components/dashboard/CalendrierDashboardV1'

export type AjoutConge = { start: string; end: string; label: string; team_members_off: number }

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
  const [addModal, setAddModal] = useState<AjoutConge | null>(null)
  const [delModal, setDelModal] = useState<Unavailability | null>(null)
  const [uSaving,  setUSaving]  = useState(false)

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

  return {
    unavails, setUnavails,
    addModal, setAddModal,
    delModal, setDelModal,
    uSaving,
    getUnavail, openAddModal, isFullyUnavailable, saveUnavail, deleteUnavail,
  }
}
