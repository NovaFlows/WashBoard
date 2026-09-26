'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChoixVeilleModal } from '@/components/dashboard/admin/ChoixVeilleModal'
import type { Plan } from '@/lib/plan'

/** Pose la question dès l'arrivée sur le tableau de bord, et pas seulement
 *  dans l'onglet Prestations.
 *
 *  Un laveur qui vient de rétrograder n'a aucune raison d'aller fouiller dans
 *  ses réglages : il ouvre son agenda, voit ses rendez-vous, et ignore que sa
 *  page de réservation n'affiche plus qu'une partie de son catalogue. La
 *  question doit venir à lui.
 *
 *  `repousse` ne vit que le temps de la visite : son « Plus tard » n'est pas
 *  retenu d'une connexion à l'autre. Tant qu'il n'a pas choisi, c'est le
 *  système qui tranche à sa place — le lui rappeler à chaque passage vaut
 *  mieux que de le laisser croire que tout est en ligne. */
export function RappelPrestationsEnVeille({ actives, plafond, aRanger, offre }: {
  actives: { id: string; name: string; price: number; duration_minutes: number }[]
  plafond: number
  aRanger: number
  offre: Plan
}) {
  const router = useRouter()
  const [repousse, setRepousse] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (repousse || aRanger <= 0) return null

  async function mettreEnVeille(ids: string[]) {
    setError(null)
    setLoading(true)
    // En série : le serveur compte les prestations actives à chaque appel,
    // deux requêtes simultanées liraient le même compte et passeraient toutes
    // les deux.
    for (const id of ids) {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_veille: true }),
      })
      if (!res.ok) {
        const corps = await res.json().catch(() => ({}))
        setError(corps.error ?? 'Impossible de mettre cette prestation en veille')
        setLoading(false)
        return
      }
    }
    setLoading(false)
    setRepousse(true)
    // La page est rendue côté serveur : sans ça, le compteur et les jauges
    // garderaient l'ancien chiffre jusqu'au prochain rechargement complet.
    router.refresh()
  }

  return (
    <ChoixVeilleModal
      actives={actives}
      plafond={plafond}
      aRanger={aRanger}
      offre={offre}
      loading={loading}
      error={error}
      onFermer={() => setRepousse(true)}
      onValider={mettreEnVeille}
    />
  )
}
