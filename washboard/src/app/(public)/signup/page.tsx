'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
import { isValidPhone } from '@/lib/phone'
import Image from 'next/image'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [cgvAcceptees, setCgvAcceptees] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError("Le nom de votre entreprise est requis"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    if (!isValidPhone(phone)) { setError('Numéro de téléphone invalide (ex. 06 12 34 56 78)'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return }
    if (!cgvAcceptees) { setError('Merci d\'accepter les CGV pour continuer'); return }
    setLoading(true)
    // Sans ce try, un serveur injoignable faisait rejeter le fetch en silence :
    // le bouton restait sur « Création du compte… » pour toujours.
    let res: Response
    try {
      res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone, cgv_acceptees: cgvAcceptees }),
      })
    } catch {
      setError('Connexion impossible. Vérifie ta connexion internet et réessaie.')
      setLoading(false)
      return
    }
    if (!res.ok) {
      // Une erreur renvoyée par l'hébergeur plutôt que par la route n'est pas
      // du JSON : ne pas laisser `res.json()` lever à son tour.
      const json = await res.json().catch(() => null)
      setError(json?.error ?? 'Une erreur est survenue. Réessaie dans un instant.')
      setLoading(false)
      return
    }
    // Pas de connexion ici : Supabase la refuse tant que l'email n'est pas
    // confirmé.
    router.push(`/verifier-email?email=${encodeURIComponent(email.trim())}`)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans wb-auth-bg">

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
                <label htmlFor="phone" className="wb-label">Téléphone</label>
                <input id="phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="06 12 34 56 78" autoComplete="tel" className="wb-input" />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Sert à sécuriser votre compte et à vous joindre en cas de souci.
                </p>
              </div>
              <div>
                <label htmlFor="password" className="wb-label">Mot de passe</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 caractères" autoComplete="new-password" className="wb-input" />
              </div>
              <div>
                <label htmlFor="confirm" className="wb-label">Confirmer le mot de passe</label>
                <input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" autoComplete="new-password" className="wb-input" />
              </div>

              <label htmlFor="cgv" className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-white/60 cursor-pointer">
                <input
                  id="cgv"
                  type="checkbox"
                  checked={cgvAcceptees}
                  onChange={e => setCgvAcceptees(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-white/20 text-[#1651E8] focus:ring-[#1651E8] shrink-0"
                />
                <span>
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <Link href="/cgv" target="_blank" className="text-[#1651E8] dark:text-[#6A9FFF] font-semibold hover:underline underline-offset-2">
                    conditions générales de vente
                  </Link>
                </span>
              </label>

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
