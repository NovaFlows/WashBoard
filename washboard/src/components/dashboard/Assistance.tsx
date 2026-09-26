'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import AssistanceContent from '@/components/dashboard/AssistanceContent'
import AssistanceV2 from '@/components/dashboard/AssistanceV2'

// Point de branchement v1 / v2 de « Aide et assistance » (refonte 2026, même schéma que
// `CalendrierDashboard.tsx`). La v2 — l'écran redessiné, avec la carte « Aide à la
// configuration » — n'existe que dans la PWA installée ET en bêta : le site, et une PWA dont le
// compte n'est pas en bêta (elle garde l'en-tête et le menu de la v1), gardent l'écran d'avant,
// à l'identique. Même adresse (`/dashboard/assistance`), donc les liens `?fil=` des
// notifications continuent d'arriver au bon endroit dans les deux cas.
export default function Assistance({ beta }: { beta: boolean }) {
  const isPwa = usePwaStandalone()

  if (isPwa && beta) {
    // useSearchParams (lecture de ?fil=) exige une limite Suspense.
    return <Suspense fallback={null}><AssistanceV2 /></Suspense>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Assistance</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Vos questions à l&apos;équipe, et les réponses reçues. Pour chercher une réponse par
          vous-même, direction le{' '}
          <Link href="/dashboard/guide" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
            Guide
          </Link>.
        </p>
      </div>

      {/* useSearchParams (lecture de ?fil=) exige une limite Suspense :
          sans elle, Next refuse de construire cette route. */}
      <Suspense fallback={null}>
        <AssistanceContent />
      </Suspense>
    </div>
  )
}
