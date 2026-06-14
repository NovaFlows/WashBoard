'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Props = {
  washerName: string
  children: React.ReactNode
  trialEndsAt?: string | null
  subscriptionStatus?: string | null
}

function TrialBanner({ trialEndsAt, subscriptionStatus }: { trialEndsAt?: string | null; subscriptionStatus?: string | null }) {
  if (!subscriptionStatus || subscriptionStatus === 'active') return null

  if (subscriptionStatus === 'expired') {
    return (
      <div className="bg-red-600 text-white text-center text-sm font-semibold py-2.5 px-4 flex items-center justify-center gap-3">
        <span>Votre période d'essai a expiré. Activez votre abonnement pour continuer à utiliser WashBoard.</span>
        <Link href="/dashboard/abonnement" className="underline font-bold hover:text-red-100 whitespace-nowrap">
          Voir les offres →
        </Link>
      </div>
    )
  }

  if (subscriptionStatus === 'trial' && trialEndsAt) {
    const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const isUrgent = daysLeft <= 7

    if (daysLeft <= 0) {
      return (
        <div className="bg-red-600 text-white text-center text-sm font-semibold py-2.5 px-4 flex items-center justify-center gap-3">
          <span>Votre période d'essai a expiré.</span>
          <Link href="/dashboard/abonnement" className="underline font-bold hover:text-red-100 whitespace-nowrap">
            Activer mon abonnement →
          </Link>
        </div>
      )
    }

    return (
      <div className={`text-center text-sm font-semibold py-2.5 px-4 flex items-center justify-center gap-3 ${
        isUrgent
          ? 'bg-orange-500 text-white'
          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800'
      }`}>
        <span>
          {isUrgent ? '⚠ ' : ''}Essai gratuit — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
        </span>
        <Link
          href="/dashboard/abonnement"
          className={`underline font-bold whitespace-nowrap ${isUrgent ? 'hover:text-orange-100' : 'hover:opacity-70'}`}
        >
          Voir l'abonnement →
        </Link>
      </div>
    )
  }

  return null
}

export function DashboardShell({ washerName, children, trialEndsAt, subscriptionStatus }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <TrialBanner trialEndsAt={trialEndsAt} subscriptionStatus={subscriptionStatus} />
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <img src="/LogoWashBoard.png" alt="WashBoard" className="w-12 h-12 object-contain" />
            <div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 leading-none tracking-tight">WashBoard</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-none">Espace laveur · {washerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <form action="/api/auth/logout" method="POST">
              <button className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold border border-slate-200 dark:border-slate-700">
                Déconnexion
              </button>
            </form>
            <ThemeToggle large />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
