'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import GuideV2 from '@/components/dashboard/GuideV2'

// Point de branchement v1/v2 du guide — même schéma que `ClientsView.tsx` : la refonte 2026
// ne s'applique QU'À la PWA installée (décision d'Alexandre, 2026-09-22), le site garde son
// écran mot pour mot. D'où le v1 passé en enfant plutôt que réécrit ici : il reste ce qu'il
// était, rendu par la page.
//
// Le CONTENU, lui, est le même des deux côtés (`lib/guide.ts`) : seule la façon de le lire
// change — questions repliées, liens traduits vers les écrans v2 (voir `GuideV2`).
export default function Guide({ v1 }: { v1: React.ReactNode }) {
  const isPwa = usePwaStandalone()
  return isPwa ? <GuideV2 /> : <>{v1}</>
}
