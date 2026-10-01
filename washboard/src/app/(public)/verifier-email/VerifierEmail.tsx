'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'

type Message = { type: 'ok' | 'erreur'; texte: string } | null

async function appeler(url: string, corps: Record<string, string>): Promise<{ ok: boolean; erreur: string | null }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    if (res.ok) return { ok: true, erreur: null }
    const json = await res.json().catch(() => null)
    return { ok: false, erreur: json?.error ?? 'Une erreur est survenue. Réessaie dans un instant.' }
  } catch {
    return { ok: false, erreur: 'Connexion impossible. Vérifie ta connexion internet et réessaie.' }
  }
}

// « Un email vient de partir, attends X s » n'est pas une erreur : l'inscrit
// n'a rien fait de mal, il a juste redemandé un peu tôt. Un cadre rouge lui
// ferait croire à un problème de sa part — traitement neutre à la place, avec
// une icône horloge plutôt qu'une icône d'alerte.
function estPatience(texte: string) {
  return texte.startsWith('Un email vient de partir')
}

function Alerte({ message }: { message: NonNullable<Message> }) {
  const ok = message.type === 'ok'
  const patience = !ok && estPatience(message.texte)

  if (patience) {
    return (
      <div role="status" className="flex items-start gap-2 p-3 rounded-xl border text-sm bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70">
        <svg className="w-4 h-4 mt-0.5 shrink-0 text-slate-400 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
        </svg>
        <span>{message.texte}</span>
      </div>
    )
  }

  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`p-3 rounded-xl border text-sm ${ok
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400'}`}
    >
      {message.texte}
    </div>
  )
}

export default function VerifierEmail({ email, lienInvalide }: {
  email: string | null
  lienInvalide: boolean
}) {
  const router = useRouter()
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [confirmerRecommencer, setConfirmerRecommencer] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const etat = email ? 'attente' : 'sans-inscription'

  async function renvoyer() {
    if (!email) return
    setEnvoi(true)
    setMessage(null)
    const { ok, erreur } = await appeler('/api/auth/resend-confirmation', { email })
    setMessage(ok
      ? { type: 'ok', texte: 'Email renvoyé. Il peut mettre une minute à arriver.' }
      : { type: 'erreur', texte: erreur! })
    setEnvoi(false)
  }

  async function recommencer(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !motDePasse) return
    setSuppression(true)
    setMessage(null)
    const { ok, erreur } = await appeler('/api/auth/restart-signup', { email, password: motDePasse })
    if (ok) { router.push('/signup'); return }
    setMessage({ type: 'erreur', texte: erreur! })
    setSuppression(false)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans wb-auth-bg">

      <div aria-hidden className="fixed inset-x-0 top-0 h-[500px] pointer-events-none overflow-hidden">
        <div className="wb-auth-glow absolute inset-0" />
      </div>

      <nav className="relative z-50 flex items-center justify-end px-5 sm:px-8 h-14">
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
              Confirme ton email
            </h1>
          </div>

          <div className="wb-auth-card rounded-2xl p-7 space-y-4">
            {lienInvalide && (
              <Alerte message={{
                type: 'erreur',
                texte: etat === 'attente'
                  ? 'Ce lien de confirmation n\'est plus valable : il a déjà servi ou il a expiré. Demande-en un nouveau ci-dessous.'
                  : 'Ce lien de confirmation n\'est plus valable : il a déjà servi ou il a expiré. Si ton email est déjà confirmé, connecte-toi.',
              }} />
            )}

            {etat === 'attente' && (
              <>
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#1651E8]/10 dark:bg-[#1651E8]/15 flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#1651E8] dark:text-[#6A9FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-white/70 leading-relaxed text-center">
                  Un email de confirmation a été envoyé à{' '}
                  <strong className="text-slate-900 dark:text-white break-all">{email}</strong>.
                  Clique sur le lien qu&apos;il contient pour activer ton compte.
                </p>
                <p className="text-xs text-slate-400 dark:text-white/40 text-center">
                  Rien reçu ? Regarde dans tes courriers indésirables avant de le renvoyer.
                </p>

                {message && <Alerte message={message} />}

                <button
                  type="button"
                  onClick={renvoyer}
                  disabled={envoi || suppression}
                  className="w-full py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors shadow-lg shadow-[#1651E8]/20"
                >
                  {envoi ? (
                    <span className="flex items-center justify-center gap-2"><Spinner />Envoi…</span>
                  ) : 'Renvoyer l\'email'}
                </button>

                {!confirmerRecommencer ? (
                  // Volontairement discret : contrairement à « Renvoyer l'email »,
                  // cette action supprime le compte. Petit texte centré, sans le
                  // bleu de marque (qui appelle au clic) et sans pleine largeur,
                  // pour qu'il ne se lise pas comme une deuxième option au même
                  // niveau que le bouton principal.
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => { setConfirmerRecommencer(true); setMessage(null) }}
                      disabled={envoi || suppression}
                      className="text-xs text-slate-400 dark:text-white/35 hover:text-slate-600 dark:hover:text-white/60 underline-offset-2 hover:underline transition-colors disabled:opacity-40"
                    >
                      Mauvaise adresse ? Recommence l&apos;inscription
                    </button>
                  </div>
                ) : (
                  <form onSubmit={recommencer} noValidate className="p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-white/70">
                      Ton inscription en attente sera supprimée, et tu pourras t&apos;inscrire à nouveau avec la bonne adresse.
                    </p>
                    <div>
                      <label htmlFor="mot-de-passe-recommencer" className="wb-label">
                        Confirme ton mot de passe pour supprimer ce compte
                      </label>
                      <input
                        id="mot-de-passe-recommencer"
                        type="password"
                        value={motDePasse}
                        onChange={e => setMotDePasse(e.target.value)}
                        required
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={suppression}
                        className="wb-input"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={suppression || !motDePasse}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                      >
                        {suppression ? (
                          <span className="flex items-center justify-center gap-2"><Spinner />Suppression…</span>
                        ) : 'Recommencer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmerRecommencer(false); setMotDePasse('') }}
                        disabled={suppression}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 disabled:opacity-40"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {etat === 'sans-inscription' && (
              <>
                <p className="text-sm text-slate-600 dark:text-white/70 leading-relaxed">
                  Aucune inscription en attente à afficher. Connecte-toi avec ton email et ton mot de passe :
                  si ton adresse reste à confirmer, tu reviendras sur cette page.
                </p>
                <Link
                  href="/login"
                  className="block w-full py-3.5 text-center bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/20"
                >
                  Se connecter
                </Link>
              </>
            )}

          </div>

          {etat === 'sans-inscription' && (
            <p className="text-center text-sm text-slate-500 dark:text-white/40 mt-5">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="text-[#1651E8] dark:text-[#6A9FFF] font-semibold hover:underline underline-offset-2">
                S&apos;inscrire
              </Link>
            </p>
          )}

        </div>
      </main>
    </div>
  )
}
