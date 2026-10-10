'use client'

import { useDesignV2 } from '@/components/dashboard/DesignV2Context'

// En-tête de l'écran des réglages — deux versions, comme le reste.
//
// Le site garde « Paramètres · Gérez vos informations et votre page client ». L'application,
// elle, porte le nom de son onglet : « Plus » (Alexandre, 2026-09-27 — « en haut de Plus ne
// mets pas Paramètres »). Deux mots pour la même destination, c'est un mot de trop.
//
// Rendu ici plutôt que dans ParametresFormV2 : l'en-tête précède la carte de configuration,
// qui est posée par la page. Le mettre dans le formulaire l'aurait fait passer dessous.
export function EnteteParametres() {
  const v2 = useDesignV2()

  if (v2) {
    return (
      <h1 className="text-[24px] leading-none pb-1 [font-family:var(--font-archivo)] [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)] text-[color:var(--v2-color-encre)]">
        Plus
      </h1>
    )
  }

  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Paramètres</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gérez vos informations et votre page client</p>
    </div>
  )
}
