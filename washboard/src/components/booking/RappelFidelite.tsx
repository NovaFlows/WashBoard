'use client'

import { useEffect, useState } from 'react'
import { cleStockageCarte } from '@/lib/fidelite'

// Rappel de fidélité en haut de la page de réservation, pour un client qui revient : « 7 sur
// 10 · plus que 3 prestations avant… ». Il ne s'affiche que si cet appareil connaît déjà la
// carte du client chez ce laveur (jeton gardé après une réservation ou une visite de la page
// carte) : sans compte, c'est la seule façon de savoir qui est là sans lui demander.

type Etat = { progression: number; requis: number; disponibles: number; phrase: string; jeton: string }

export default function RappelFidelite({ washerId }: { washerId: string }) {
  const [etat, setEtat] = useState<Etat | null>(null)
  useEffect(() => {
    let jeton: string | null = null
    try { jeton = window.localStorage.getItem(cleStockageCarte(washerId)) } catch { /* stockage refusé */ }
    if (!jeton) return
    let annule = false
    fetch(`/api/fidelite/${jeton}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (annule || !j?.active || j.washerId !== washerId) return
        setEtat({ progression: j.progression, requis: j.requis, disponibles: j.disponibles, phrase: j.phrase, jeton: jeton! })
      })
      .catch(() => { /* sans rappel, la page reste utilisable */ })
    return () => { annule = true }
  }, [washerId])

  if (!etat) return null
  return (
    <a href={`/fidelite/${etat.jeton}`} className="mx-auto mb-3 flex max-w-lg items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[13px] font-bold text-white tabular-nums">
        {etat.disponibles > 0 ? '★' : `${etat.progression}/${etat.requis}`}
      </span>
      <span className="min-w-0 leading-snug">
        <span className="font-semibold">Votre carte de fidélité</span> · {etat.phrase}
      </span>
    </a>
  )
}
