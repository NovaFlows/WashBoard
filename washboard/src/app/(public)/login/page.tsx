'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
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

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative">

      {/* Bouton retour landing */}
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </Link>
      </div>

      {/* ThemeToggle en haut à droite */}
      <div className="absolute top-4 right-4">
        <ThemeToggle large />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-sm">

          {/* Espace Laveur en haut */}
          <p className="text-center text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Espace Laveur
          </p>

          {/* Logo + WashBoard au centre */}
          <div className="text-center mb-4">
            <Link href="/">
              <img
                src="/LogoWashBoard.png"
                alt="WashBoard"
                className="w-40 h-40 object-contain mx-auto mb-1 hover:opacity-80 transition-opacity cursor-pointer"
              />
            </Link>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              WashBoard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Connectez-vous</p>
          </div>

          {/* Formulaire */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="vous@exemple.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Connexion...
                  </span>
                ) : 'Se connecter'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm mt-4">
            <Link href="/forgot-password" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Mot de passe oublié ?
            </Link>
          </p>

          {/* Lien inscription */}
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3">
            Pas de compte ?{' '}
            <Link href="/signup" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Inscrivez-vous
            </Link>
          </p>

        </div>
      </main>
    </div>
  )
}
