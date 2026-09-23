'use client'

import type { ReactNode } from 'react'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import AccueilV2 from '@/components/dashboard/AccueilV2'
import type { RdvAccueil } from '@/components/dashboard/AccueilV2'
import type { WidgetKey } from '@/lib/dashboardWidgets'
import type { ZoneConfig } from '@/types'

// Point de branchement v1/v2 de l'écran d'accueil — passe 8 de la refonte
// 2026, même règle que ClientsView.tsx, ParametresForm.tsx ou
// CalendrierDashboard.tsx : la v2 ne s'applique QU'à la PWA installée en mode
// standalone, le site reste v1 sans exception (décision d'Alexandre,
// 2026-09-22). `usePwaStandalone()` plutôt que la classe CSS `wb-pwa` : ce
// n'est pas un changement de couleurs, c'est un écran entièrement différent.
//
// Une différence de forme avec les passes précédentes, et une seule : il n'y a
// pas de fichier `AccueilV1.tsx`. L'accueil v1 n'est pas un composant — c'est
// l'assemblage fait par `dashboard/page.tsx` lui-même (carte de démarrage,
// raccourcis, configurateur de widgets, `BookingList` et ses widgets enfants),
// dont plusieurs morceaux sont des composants SERVEUR. Le recopier dans un
// `AccueilV1.tsx` client aurait déplacé tout ce travail dans le navigateur et
// changé le rendu du site — exactement ce que la règle interdit. Il arrive
// donc ici tel quel, déjà rendu, dans la prop `v1` : le site reçoit le même
// arbre qu'avant, au même endroit, aux mêmes composants serveur.
type Props = {
  /** L'accueil v1 complet, rendu par `dashboard/page.tsx`. Affiché tel quel
   *  hors PWA — et tant que le composant n'est pas monté, comme partout
   *  ailleurs dans la refonte (voir usePwaStandalone). */
  v1: ReactNode
  /** La carte de démarrage, rendue une seule fois côté serveur et placée par
   *  chaque version là où elle doit l'être. */
  demarrage: ReactNode
  rdvAujourdhui: RdvAccueil[]
  rdvProchains: RdvAccueil[]
  aConfirmer: RdvAccueil[]
  journeeCommencee: boolean
  dateDuJour: string
  widgets: WidgetKey[]
  stats: { terminesCeMois: number; caCeMois: number | null } | null
  clients: { total: number; nouveauxCetteSemaine: number } | null
  trafic: { visiteurs: number; conversions: number } | null
  prestationTop: { nom: string; nombre: number } | null
  zone: ZoneConfig
}

export default function Accueil({ v1, ...v2 }: Props) {
  const isPwa = usePwaStandalone()
  return isPwa ? <AccueilV2 {...v2} /> : <>{v1}</>
}
