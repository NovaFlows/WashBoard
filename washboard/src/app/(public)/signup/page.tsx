'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
import Image from 'next/image'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError("Le nom de votre entreprise est requis"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return }
    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Une erreur est survenue'); setLoading(false); return }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) { setLoading(false); router.push('/login'); return }
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

      <div aria-hidden className="fixed inset-x-0 top-0 h-[500px] pointer-events-none overflow-hidden">
        <div className="wb-auth-glow absolute inset-0" />
      </div>

      <nav className="relative z-50 flex items-center justify-between px-5 sm:px-8 h-14">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </Link>
        <ThemeToggle nav />
      </nav>

      <main className="relative flex-1 flex items-center justify-center px-4 pb-12 -mt-2">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={56} height={56} className="rounded-2xl object-contain mx-auto mb-3 shadow-sm" />
            <p className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-2">
              Espace laveur
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Créer un compte
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/45 mt-1.5">
              1 mois gratuit · Sans carte bancaire
            </p>
          </div>

          <div className="wb-auth-card rounded-2xl p-7">
            <form onSubmit={handleSignup} noValidate className="space-y-4">
              <div>
                <label htmlFor="name" className="wb-label">Nom de votre entreprise</label>
                <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="CleanCar" autoComplete="organization" className="wb-input" />
              </div>
              <div>
                <label htmlFor="email" className="wb-label">Email</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vous@exemple.com" autoComplete="email" className="wb-input" />
              </div>
              <div>
                <label htmlFor="password" className="wb-label">Mot de passe</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 caractères" autoComplete="new-password" className="wb-input" />
              </div>
              <div>
                <label htmlFor="confirm" className="wb-label">Confirmer le mot de passe</label>
                <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" autoComplete="new-password" className="wb-input" />
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
                  <span className="flex items-center justify-center gap-2"><Spinner />Création du compte…</span>
                ) : 'Lancer mon mois gratuit'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-white/40 mt-5">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#1651E8] dark:text-[#6A9FFF] font-semibold hover:underline underline-offset-2">
              Se connecter
            </Link>
          </p>

        </div>
      </main>
    </div>
  )
}
