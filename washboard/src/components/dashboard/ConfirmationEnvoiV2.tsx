'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { abonnerConfirmation, fermerConfirmation, lireConfirmation } from '@/lib/confirmationEnvoi'
import { corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'

// « Bien envoyé » : la fenêtre qui confirme un SMS, un message WhatsApp ou un PDF parti depuis
// l'app (Alexandre, 2026-09-30). Elle se ferme seule après 2,4 s, ou d'un tap n'importe où.
// Alimentée par `lib/confirmationEnvoi` ; montée une seule fois dans le châssis de la PWA.
//
// Au-dessus des feuilles du bas (z-50) : le SMS test part depuis l'une d'elles.

const DUREE_MS = 2400

export default function ConfirmationEnvoiV2() {
  const c = useSyncExternalStore(abonnerConfirmation, lireConfirmation, () => null)

  useEffect(() => {
    if (!c) return
    try { navigator.vibrate?.(12) } catch { /* pas de vibration : sans importance */ }
    const id = setTimeout(fermerConfirmation, DUREE_MS)
    return () => clearTimeout(id)
  }, [c])

  if (!c) return null

  return (
    <div
      key={c.id}
      role="status"
      aria-live="polite"
      onClick={fermerConfirmation}
      className="wb-envoi-fond fixed inset-0 z-[70] flex items-center justify-center bg-[color:var(--v2-color-encre)]/25 px-8 backdrop-blur-[2px]"
    >
      <div className="wb-envoi-carte flex w-full max-w-[280px] flex-col items-center rounded-[var(--v2-radius-feuille)] bg-[color:var(--v2-color-surface)] px-6 pb-6 pt-7 text-center text-[color:var(--v2-color-encre)] shadow-[0_18px_50px_rgba(0,0,0,.22)] [font-family:var(--font-archivo)]">
        <span
          className="wb-envoi-pastille flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'color-mix(in srgb, var(--v2-color-vert) 14%, transparent)', color: 'var(--v2-color-vert)' }}
          aria-hidden
        >
          <Check size={30} strokeWidth={2.6} />
        </span>
        <p className={`mt-4 text-[20px] leading-tight ${titre}`}>{c.titre}</p>
        {c.detail && (
          <p className={`mt-1.5 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{c.detail}</p>
        )}
        <span className={`mt-4 text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Toucher pour fermer</span>
      </div>
    </div>
  )
}
