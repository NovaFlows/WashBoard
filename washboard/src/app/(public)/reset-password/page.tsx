'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [ready, setReady]         = useState(false)
  const [done, setDone]           = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Deux formats possibles selon la config Supabase :
  //  - implicit flow : tokens dans le hash (#access_token=...&refresh_token=...)
  //  - PKCE flow      : code dans la query (?code=xxx)
  // On établit explicitement la session pour que updateUser fonctionne.
  useEffect(() => {
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const params = new URLSearchParams(window.location.search)
    const accessToken  = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const code         = params.get('code')

    async function init() {
      // Implicit flow : on pose la session à partir des tokens du hash
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) { setReady(true); return }
      }

      // PKCE flow : échange du code contre une session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { setReady(true); return }
      }

      // Session déjà active ?
      const { data } = await supabase.auth.getSession()
      if (data.session) { setReady(true); return }

      setError('Lien invalide ou expiré. Recommencez la procédure.')
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError('Erreur lors de la mise à jour. Le lien a peut-être expiré.'); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative">
      <div className="absolute top-4 left-4">
        <Link href="/login" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Retour
        </Link>
      </div>
      <div className="absolute top-4 right-4"><ThemeToggle large /></div>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <Link href="/">
              <img src="/LogoWashBoard.png" alt="WashBoard" className="w-16 h-16 object-contain mx-auto mb-3" />
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Nouveau mot de passe</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Choisissez un nouveau mot de passe</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            {done ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Mot de passe mis à jour !</p>
                <p className="text-xs text-slate-400">Redirection vers la connexion...</p>
              </div>
            ) : !ready ? (
              error ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  <Link href="/forgot-password" className="block w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm text-center transition-colors">
                    Renvoyer un lien
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <Spinner className="w-6 h-6 text-blue-500 mx-auto" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Vérification du lien...</p>
                </div>
              )
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="6 caractères minimum"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
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
                      Mise à jour...
                    </span>
                  ) : 'Mettre à jour le mot de passe'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
