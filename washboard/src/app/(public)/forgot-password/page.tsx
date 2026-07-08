'use client'

import { useState } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
import Image from 'next/image'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Une erreur est survenue.'); return }
    setSent(true)
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
        <Link href="/login" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </Link>
        <ThemeToggle nav />
      </nav>

      <main className="relative flex-1 flex items-center justify-center px-4 pb-12 -mt-6">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={56} height={56} className="rounded-2xl object-contain mx-auto mb-3 shadow-sm" />
            <p className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-2">
              Espace laveur
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {sent ? 'Email envoyé' : 'Mot de passe oublié'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/45 mt-1.5 max-w-[260px] mx-auto">
              {sent
                ? `Lien envoyé à ${email}`
                : 'Saisis ton email pour recevoir un lien de réinitialisation'
              }
            </p>
          </div>

          <div className="wb-auth-card rounded-2xl p-7">
            {sent ? (
              <div className="text-center space-y-5">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <p className="text-sm text-slate-600 dark:text-white/55 leading-relaxed">
                  Clique sur le lien dans l&apos;email pour créer un nouveau mot de passe.
                  <span className="block text-xs text-slate-400 dark:text-white/25 mt-1">Pense à vérifier tes spams.</span>
                </p>
                <Link href="/login" className="block w-full py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/20 text-center">
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label htmlFor="email" className="wb-label">Email</label>
                  <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vous@exemple.com" autoComplete="email" className="wb-input" />
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
                  disabled={loading || !email.trim()}
                  className="w-full py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors shadow-lg shadow-[#1651E8]/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2"><Spinner />Envoi…</span>
                  ) : 'Envoyer le lien'}
                </button>
              </form>
            )}
          </div>

          {!sent && (
            <p className="text-center text-sm text-slate-500 dark:text-white/40 mt-5">
              Tu te souviens ?{' '}
              <Link href="/login" className="text-[#1651E8] dark:text-[#6A9FFF] font-semibold hover:underline underline-offset-2">
                Se connecter
              </Link>
            </p>
          )}

        </div>
      </main>
    </div>
  )
}
