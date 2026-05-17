'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Props = {
  washerName: string
  children: React.ReactNode
}

export function DashboardShell({ washerName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
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
