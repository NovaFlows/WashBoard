'use client'

import type { ReactNode } from 'react'
import { useDashboardV2 } from '@/hooks/useDashboardV2'
import AccueilV2 from '@/components/dashboard/AccueilV2'
import type { RdvAccueil } from '@/components/dashboard/AccueilV2'
import type { WidgetKey } from '@/lib/dashboardWidgets'
import type { ZoneConfig } from '@/types'
import type { Plan } from '@/lib/plan'
import type { ReservationMasquee } from '@/components/dashboard/ReservationVerrouilleeV2'
import type { JourSemaine } from '@/lib/semaineAccueil'

// Point de branchement v1/v2 de l'écran d'accueil — passe 8 de la refonte
// 2026, même règle que ClientsView.tsx, ParametresForm.tsx ou
// CalendrierDashboard.tsx : la v2 s'applique à la PWA installée en mode
// standalone (décision d'Alexandre, 2026-09-22), et depuis la passe « bureau »
// (2026-10-03) AUSSI au site sur grand écran, derrière le garde-fou temporaire
// `washer.beta_refonte` — voir `useDashboardV2.ts`, repris ici plutôt
// qu'inventé en double (même changement que `ClientsView.tsx`, passe
// « bureau »). `usePwaStandalone()` nu ne suffit plus : il resterait aveugle au
// cas « site, grand écran, drapeau actif ».
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
   *  hors v2 — et tant que le composant n'est pas monté, comme partout
   *  ailleurs dans la refonte (voir usePwaStandalone/useDashboardV2). */
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
  /** Quota de réservations du mois et clients masqués par le plafond (fusionné le 2026-09-28) —
   *  ignorés côté v1, qui rend déjà `JaugeReservations`/`BandeauBloquees` dans `v1`. */
  jauge: { utilisees: number; quota: number | null; offre: Plan; remiseAZero?: string }
  verrouillees: ReservationMasquee[]
  offreDeblocage: string
  /** « Cette semaine » (colonne de droite, bureau uniquement) — un jour par
   *  entrée, lundi → dimanche, voir `lib/semaineAccueil.ts`. Ignoré côté v1
   *  et côté téléphone (v2 à une colonne) : la section ne s'y affiche pas. */
  semaine: JourSemaine[]
  /** « Demain » (même colonne, juste au-dessus) — déjà filtré et démasqué
   *  par `dashboard/page.tsx`, pas de traitement de plus ici. */
  rdvDemain: RdvAccueil[]
  /** Le jour de demain, `AAAA-MM-JJ` à l'heure de Paris — pour l'intitulé de
   *  la section (« Demain, vendredi 4 »). */
  demainStr: string
  /** Au moins une étape BLOQUANTE de `computeSetupProgress` manque encore (prestations,
   *  horaires, adresse — `etapeDemarrage(progress) !== null`, voir `dashboard/page.tsx`) —
   *  passe « bureau » : décide, en v2 grand écran, de montrer la carte de configuration +
   *  l'aperçu de la page publique à la place du héros (écran 45 de la maquette bureau). Pas
   *  `!progress.essentialsDone` : ce calcul compte aussi le logo et le téléphone, non bloquants —
   *  un compte opérationnel mais sans logo verrait alors cette carte à la place de son agenda dès
   *  un jour sans rendez-vous. Et pas deviné depuis des listes de rendez-vous vides non plus : ça
   *  se produit aussi un jour calme chez un compte déjà configuré. */
  configurationIncomplete: boolean
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran » (voir
   *  `useDashboardV2.ts`). Sans effet dans la PWA, où v2 s'affiche sans condition. */
  betaRefonte?: boolean | null
}

export default function Accueil({ v1, betaRefonte, ...v2 }: Props) {
  const estV2 = useDashboardV2(betaRefonte)
  return estV2 ? <AccueilV2 {...v2} /> : <>{v1}</>
}
