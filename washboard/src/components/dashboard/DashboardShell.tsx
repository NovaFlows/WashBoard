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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <TrialBanner trialEndsAt={trialEndsAt} subscriptionStatus={subscriptionStatus} />
        <div className="w-full px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <img src="/LogoWashBoard.png" alt="WashBoard" className="w-9 h-9 sm:w-14 sm:h-14 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 leading-none tracking-tight truncate">WashBoard</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-none truncate hidden sm:block">{washerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <form action="/api/auth/logout" method="POST">
              <button className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 sm:px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sm:hidden">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                </span>
              </button>
            </form>
            <ThemeToggle large />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6 overflow-x-hidden">
        {children}
      </main>

      {/* Bouton WhatsApp flottant */}
      <a
        href="https://wa.me/33684140438"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:scale-105"
        aria-label="Contacter le support WhatsApp"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Support
      </a>
    </div>
  )
}
