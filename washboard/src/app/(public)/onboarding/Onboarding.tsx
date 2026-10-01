'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
import { SITE_URL_FALLBACK } from '@/lib/plan'
import { PHRASE_SLUG_INVALIDE, generateSlug, slugValide } from '@/lib/slug'
import { enregistrerSlug } from '@/lib/lienReservation'
import { appeler } from '@/lib/prestationsApi'
import { SOURCES_ACQUISITION, type SourceAcquisition } from '@/lib/onboarding'

const DOMAINE = SITE_URL_FALLBACK.replace(/^https?:\/\/(www\.)?/, '')

type Verification = { slug: string; etat: 'libre' | 'pris' | 'erreur'; message?: string }
type Disponibilite = 'actuel' | 'invalide' | 'verification' | Verification['etat']

async function verifier(slug: string, signal: AbortSignal): Promise<Verification> {
  try {
    const res = await fetch(`/api/washer/slug?slug=${encodeURIComponent(slug)}`, { signal })
    const json = await res.json().catch(() => null)
    if (res.ok) return { slug, etat: json?.disponible ? 'libre' : 'pris' }
    if (res.status === 401) return { slug, etat: 'erreur', message: 'Ta session a expiré. Reconnecte-toi.' }
    return { slug, etat: 'erreur', message: json?.error ?? 'Vérification impossible. Réessaie dans un instant.' }
  } catch {
    return { slug, etat: 'erreur', message: 'Vérification impossible. Vérifie ta connexion internet.' }
  }
}

function Erreur({ texte }: { texte: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl">
      <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      <p className="text-sm text-red-600 dark:text-red-400">{texte}</p>
    </div>
  )
}

const BOUTON_PRINCIPAL = 'w-full py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors shadow-lg shadow-[#1651E8]/20'
const LIEN_DISCRET = 'text-xs text-slate-400 dark:text-white/35 hover:text-slate-600 dark:hover:text-white/60 underline-offset-2 hover:underline transition-colors disabled:opacity-40'

export default function Onboarding({ slug }: { slug: string }) {
  const router = useRouter()
  const [etape, setEtape] = useState<1 | 2>(1)
  const [slugEnregistre, setSlugEnregistre] = useState(slug)
  const [saisie, setSaisie] = useState(slug)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [source, setSource] = useState<SourceAcquisition | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Le lien actuel est repris tel quel : un lien généré à l'inscription peut
  // dépasser 40 caractères (nom tronqué à 40 + suffixe), et le repasser dans
  // `generateSlug` le raccourcirait — le laveur ne pourrait plus le garder.
  const candidat = saisie.trim() === slugEnregistre ? slugEnregistre : generateSlug(saisie)

  let disponibilite: Disponibilite
  if (candidat === slugEnregistre) disponibilite = 'actuel'
  else if (!slugValide(candidat)) disponibilite = 'invalide'
  else if (verification?.slug === candidat) disponibilite = verification.etat
  else disponibilite = 'verification'

  useEffect(() => {
    if (disponibilite !== 'verification') return
    const controleur = new AbortController()
    const minuteur = setTimeout(async () => {
      const resultat = await verifier(candidat, controleur.signal)
      if (!controleur.signal.aborted) setVerification(resultat)
    }, 400)
    return () => { clearTimeout(minuteur); controleur.abort() }
  }, [candidat, disponibilite])

  async function validerLien(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (disponibilite === 'actuel') { setEtape(2); return }
    if (disponibilite !== 'libre') return
    setEnvoi(true)
    const r = await enregistrerSlug(candidat)
    setEnvoi(false)
    if (!r.ok) { setErreur(r.message); return }
    setSlugEnregistre(candidat)
    setSaisie(candidat)
    setEtape(2)
  }

  async function terminer(e: React.FormEvent) {
    e.preventDefault()
    if (!source) return
    setErreur(null)
    setEnvoi(true)
    const r = await appeler('enregistrer', 'POST', '/api/washer/onboarding', { acquisition_source: source })
    if (!r.ok) { setErreur(r.message); setEnvoi(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  const couleurEtat = disponibilite === 'libre'
    ? 'text-emerald-600 dark:text-emerald-400'
    : disponibilite === 'invalide' || disponibilite === 'pris' || disponibilite === 'erreur'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-400 dark:text-white/40'

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
              Étape {etape} sur 2
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {etape === 1 ? 'Ton lien de réservation' : 'Une dernière question'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/45 mt-1.5">
              {etape === 1
                ? 'C’est l’adresse que tes clients utiliseront pour réserver.'
                : 'Comment as-tu connu WashBoard ?'}
            </p>
          </div>

          <div className="wb-auth-card rounded-2xl p-7">
            {etape === 1 ? (
              <form onSubmit={validerLien} noValidate className="space-y-4">
                <div>
                  <label htmlFor="slug" className="wb-label">Personnalise ton lien</label>
                  <input
                    id="slug"
                    type="text"
                    value={saisie}
                    onChange={e => { setSaisie(e.target.value); setErreur(null) }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={60}
                    disabled={envoi}
                    aria-describedby="apercu-lien etat-lien"
                    className="wb-input"
                  />
                </div>

                <div id="apercu-lien" className="p-3 rounded-xl border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
                  <p className="text-xs text-slate-400 dark:text-white/40 mb-0.5">Aperçu</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                    {DOMAINE}/book/<span className="text-[#1651E8] dark:text-[#6A9FFF]">{candidat || '…'}</span>
                  </p>
                </div>

                <p id="etat-lien" role="status" aria-live="polite" className={`text-xs min-h-4 ${couleurEtat}`}>
                  {disponibilite === 'actuel' && 'C’est ton lien actuel. Tu pourras le changer plus tard dans tes réglages.'}
                  {disponibilite === 'invalide' && PHRASE_SLUG_INVALIDE}
                  {disponibilite === 'verification' && (
                    <span className="inline-flex items-center gap-1.5"><Spinner />Vérification…</span>
                  )}
                  {disponibilite === 'libre' && 'Disponible.'}
                  {disponibilite === 'pris' && 'Ce lien est déjà utilisé. Choisis-en un autre.'}
                  {disponibilite === 'erreur' && verification?.message}
                </p>

                {erreur && <Erreur texte={erreur} />}

                <button
                  type="submit"
                  disabled={envoi || (disponibilite !== 'actuel' && disponibilite !== 'libre')}
                  className={BOUTON_PRINCIPAL}
                >
                  {envoi ? (
                    <span className="flex items-center justify-center gap-2"><Spinner />Enregistrement…</span>
                  ) : 'Continuer'}
                </button>
              </form>
            ) : (
              <form onSubmit={terminer} noValidate className="space-y-4">
                <fieldset>
                  <legend className="sr-only">Comment as-tu connu WashBoard ?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCES_ACQUISITION.map(s => {
                      const choisi = source === s.valeur
                      return (
                        <button
                          key={s.valeur}
                          type="button"
                          aria-pressed={choisi}
                          onClick={() => { setSource(s.valeur); setErreur(null) }}
                          disabled={envoi}
                          className={`py-2.5 px-3 text-sm font-semibold rounded-xl border transition-colors disabled:opacity-40 last:odd:col-span-2 ${choisi
                            ? 'border-[#1651E8] bg-[#1651E8]/10 text-[#1651E8] dark:border-[#6A9FFF] dark:bg-[#1651E8]/20 dark:text-[#6A9FFF]'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:border-slate-300 dark:hover:border-white/20'}`}
                        >
                          {s.libelle}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                {erreur && (
                  <>
                    <Erreur texte={erreur} />
                    {/* Une réponse qui ne s'enregistre pas ne doit pas fermer l'accès au compte. */}
                    <p className="text-center">
                      <Link href="/dashboard" className={LIEN_DISCRET}>Aller au tableau de bord</Link>
                    </p>
                  </>
                )}

                <button type="submit" disabled={envoi || !source} className={BOUTON_PRINCIPAL}>
                  {envoi ? (
                    <span className="flex items-center justify-center gap-2"><Spinner />Enregistrement…</span>
                  ) : 'Accéder à mon tableau de bord'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setEtape(1); setErreur(null) }}
                    disabled={envoi}
                    className={LIEN_DISCRET}
                  >
                    Revenir au lien
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
