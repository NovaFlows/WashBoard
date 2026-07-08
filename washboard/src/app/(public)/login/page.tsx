'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    if (!password) { setError('Mot de passe requis'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col font-sans wb-auth-bg">
      <style>{`
        .wb-auth-bg {
          background: linear-gradient(140deg, #EBF5FF 0%, #F4F9FF 45%, #FFFFFF 100%);
        }
        .dark .wb-auth-bg {
          background: linear-gradient(150deg, #09111E 0%, #0C1D38 65%, #09111E 100%);
        }
        .wb-auth-glow {
          background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,196,212,0.13), transparent);
        }
        .dark .wb-auth-glow { background: none; }
        .wb-auth-card {
          background: rgba(255,255,255,0.97);
          border: 1px solid rgba(22,81,232,0.10);
          box-shadow: 0 4px 32px rgba(22,81,232,0.07);
        }
        .dark .wb-auth-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: none;
        }
        .wb-input {
          width: 100%;
          border: 1px solid rgba(22,81,232,0.15);
          border-radius: 0.75rem;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          background: white;
          color: #0f172a;
          outline: none;
          transition: box-shadow 0.15s, border-color 0.15s;
        }
        .dark .wb-input {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.9);
        }
        .wb-input::placeholder { color: #94a3b8; }
        .dark .wb-input::placeholder { color: rgba(255,255,255,0.3); }
        .wb-input:focus {
          border-color: #1651E8;
          box-shadow: 0 0 0 3px rgba(22,81,232,0.12);
        }
        .dark .wb-input:focus {
          border-color: #4A81FF;
          box-shadow: 0 0 0 3px rgba(74,129,255,0.15);
        }
        .wb-label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 0.375rem;
          color: #475569;
        }
        .dark .wb-label { color: rgba(255,255,255,0.6); }
      `}</style>

      {/* Halo aqua */}
      <div aria-hidden className="fixed inset-x-0 top-0 h-[500px] pointer-events-none overflow-hidden">
        <div className="wb-auth-glow absolute inset-0" />
      </div>

      {/* Nav — transparent, juste les contrôles */}
      <nav className="relative z-50 flex items-center justify-between px-5 sm:px-8 h-14">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </Link>
        <ThemeToggle nav />
      </nav>

      {/* Contenu centré */}
      <main className="relative flex-1 flex items-center justify-center px-4 pb-12 -mt-6">
        <div className="w-full max-w-sm">

          {/* Logo + nom — dans la page, pas dans le header */}
          <div className="text-center mb-8">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={52} height={52} className="rounded-2xl object-contain mx-auto mb-2 shadow-sm" />
            <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-4">WashBoard</p>
            <p className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-2">
              Espace laveur
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Connexion
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/45 mt-1.5">
              Accède à ton tableau de bord
            </p>
          </div>

          {/* Carte formulaire */}
          <div className="wb-auth-card rounded-2xl p-7">
            <form onSubmit={handleLogin} noValidate className="space-y-5">
              <div>
                <label htmlFor="email" className="wb-label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  className="wb-input"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="wb-label" style={{ marginBottom: 0 }}>Mot de passe</label>
                  <Link href="/forgot-password" className="text-xs text-slate-400 dark:text-white/30 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors">
                    Oublié ?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="wb-input"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors shadow-lg shadow-[#1651E8]/20 mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Connexion…
                  </span>
                ) : 'Se connecter'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-white/40 mt-5">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="text-[#1651E8] dark:text-[#6A9FFF] font-semibold hover:underline underline-offset-2">
              Essai gratuit →
            </Link>
          </p>

        </div>
      </main>
    </div>
  )
}
