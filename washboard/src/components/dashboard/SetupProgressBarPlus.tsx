'use client'

import { useDesignV2 } from '@/components/dashboard/DesignV2Context'
import { SetupProgressBar } from '@/components/dashboard/SetupProgressBar'
import type { SetupProgress } from '@/lib/setupProgress'

// Sur le site, « Configuration de votre compte » reste sur l'écran Paramètres
// (pas d'écran Réglages séparé). Dans la PWA, elle vit désormais UNIQUEMENT
// dans Réglages (demande explicite d'Alexandre, 2026-10-04 : le bouton qui la
// masque/affiche vivait déjà là-bas, la carte elle-même devait le rejoindre
// plutôt que de rester affichée ailleurs) — ce wrapper évite de la montrer
// deux fois en la masquant ici quand l'app tourne en PWA.
export function SetupProgressBarPlus({ progress }: { progress: SetupProgress }) {
  const v2 = useDesignV2()
  if (v2) return null
  return <SetupProgressBar progress={progress} />
}
