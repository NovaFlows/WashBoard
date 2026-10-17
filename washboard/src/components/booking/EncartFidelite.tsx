'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatPrice } from '@/lib/pricing'

// La carte de fidélité du client, montrée une fois ses coordonnées tapées, juste avant de
// confirmer (demande d'Alexandre, 2026-10-17 : « seulement quand il a mis les coordonnées »).
// Avec une récompense : le nouveau prix — 0 € pour la prestation si elle est offerte.

export type ApercuFidelite = { progression: number; requis: number; disponibles: number; remise: number; offerte: boolean; phrase: string }

/** Demande l'aperçu au serveur ~0,6 s après la dernière frappe, quand l'email ou le
 *  téléphone est complet. Ne fait rien si le laveur n'a pas de carte de fidélité. */
export function useApercuFidelite(washerId: string, actif: boolean) {
  const [apercu, setApercu] = useState<ApercuFidelite | null>(null)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  const derniere = useRef('')
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current) }, [])

  const verifier = useCallback((email: string, telephone: string, prix: number) => {
    if (!actif) return
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    const telOk = telephone.replace(/\D/g, '').length >= 10
    if (!emailOk && !telOk) { setApercu(null); derniere.current = ''; return }
    const signature = `${email.trim().toLowerCase()}|${telephone.replace(/\D/g, '')}|${prix}`
    if (signature === derniere.current) return
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = setTimeout(async () => {
      derniere.current = signature
      try {
        const res = await fetch('/api/fidelite/apercu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ washerId, email: emailOk ? email.trim() : '', telephone: telOk ? telephone : '', prix }),
        })
        const j = res.ok ? await res.json() : null
        setApercu(j?.active ? j : null)
      } catch { setApercu(null) }
    }, 600)
  }, [actif, washerId])

  return { apercu, verifier }
}

export default function EncartFidelite({ apercu, prixPrestation }: { apercu: ApercuFidelite; prixPrestation: number }) {
  if (apercu.disponibles > 0 && apercu.remise > 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
        <p className="font-semibold">Carte de fidélité complète : récompense appliquée</p>
        <p className="mt-1 flex items-baseline justify-between gap-3">
          <span>{apercu.offerte ? 'Votre prestation est offerte' : 'Votre prestation'}</span>
          <span className="whitespace-nowrap">
            <s className="mr-1.5 opacity-60">{formatPrice(prixPrestation)}</s>
            <strong>{formatPrice(Math.max(0, prixPrestation - apercu.remise))}</strong>
          </span>
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold">Votre carte de fidélité · {apercu.progression} / {apercu.requis}</p>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: apercu.requis }, (_, i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-2 ${i < apercu.progression ? 'border-emerald-600 bg-emerald-600' : 'border-dashed border-zinc-300 dark:border-zinc-600'}`} />
        ))}
      </div>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">{apercu.phrase} Cette réservation comptera une fois la prestation terminée.</p>
    </div>
  )
}
