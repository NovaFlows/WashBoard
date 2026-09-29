'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'

// Dans la PWA installée, la page de réservation ouverte depuis l'application (« Voir »)
// n'a ni barre d'adresse ni bouton retour : sans ceci, le laveur n'a aucun moyen de
// revenir. Un client, lui, ouvre la page dans son navigateur : jamais en mode installé,
// il ne voit donc jamais ce bouton.
export default function RetourApercu() {
  const router = useRouter()
  const isPwa = usePwaStandalone()
  if (!isPwa) return null
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push('/dashboard/parametres')
      }}
      className="fixed left-3 z-40 inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
    >
      <ArrowLeft size={16} strokeWidth={2.4} aria-hidden />
      Retour
    </button>
  )
}
