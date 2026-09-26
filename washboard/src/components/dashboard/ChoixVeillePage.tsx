'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PLAN_LABELS, PLAN_PRICES, SERVICE_QUOTA, type Plan } from '@/lib/plan'

type PrestationChoisissable = {
  id: string
  name: string
  price: number
  duration_minutes: number
}

// ── Identité WashBoard ──────────────────────────────────────────────────────
// Les mêmes valeurs que la page d'accueil publique. Un écran qui invente ses
// propres couleurs se reconnaît immédiatement comme une pièce rapportée.
const BLEU = '#1651E8'
const BLEU_SOMBRE = '#0F4ACC'
const FOND_SOMBRE = 'linear-gradient(135deg, #0B1828 0%, #0D2248 55%, #0B1828 100%)'
const CYAN = '#00C4D4'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Première offre qui lève le plafond du catalogue. Calculée plutôt qu'écrite
 *  en dur : déplacer le catalogue illimité d'un palier à l'autre ne doit pas
 *  laisser cet écran proposer la mauvaise offre. */
const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const OFFRE_SANS_PLAFOND = OFFRES.find(p => SERVICE_QUOTA[p] === null) ?? 'starter'

/** Aperçu de la page de réservation telle que les clients la voient.
 *
 *  La pièce qui fait comprendre en une seconde ce que trois paragraphes
 *  peinaient à expliquer : le laveur n'imagine pas sa page, il la regarde. */
function ApercuPage({ actives, plafond }: { actives: PrestationChoisissable[]; plafond: number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3.5">
      <p className={`${SURTITRE} text-white/40 mb-3`}>Votre page de réservation</p>
      <div className="space-y-1.5">
        {actives.map((svc, i) => {
          const masquee = i >= plafond
          return (
            <div
              key={svc.id}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${
                masquee ? 'bg-white/[0.03] border border-dashed border-white/15' : 'bg-white/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: masquee ? 'rgba(255,255,255,0.2)' : CYAN }} />
              <span className={`flex-1 truncate text-sm font-medium ${
                masquee ? 'text-white/30 line-through' : 'text-white/90'
              }`}>
                {svc.name}
              </span>
              <span className={`text-xs font-semibold shrink-0 ${masquee ? 'text-white/25' : 'text-white/50'}`}>
                {masquee ? 'masquée' : `${svc.price}€`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Point({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BLEU }} />
      <div>
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{titre}</p>
        <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{children}</p>
      </div>
    </div>
  )
}

/** Écran plein, en deux temps : on explique, puis on propose.
 *
 *  Une PAGE et non une fenêtre : la question mérite qu'on s'arrête dessus, et
 *  une boîte posée au milieu d'un tableau de bord se referme d'un réflexe. Rien
 *  ne défile à l'intérieur d'un cadre — c'est la page entière qui défile, comme
 *  partout ailleurs dans le produit.
 *
 *  Mélanger explication et liste à cocher faisait qu'on ne lisait ni l'une ni
 *  l'autre : l'œil tombe sur les cases, coche, et passe. Le laveur doit d'abord
 *  comprendre que sa page a DÉJÀ changé, sans qu'il l'ait décidé. Le bouton
 *  « Suivant » devient l'accusé de réception.
 *
 *  Et pourquoi le laisser choisir plutôt que d'éteindre les plus récentes : sa
 *  prestation la plus rentable peut être la dernière ajoutée. Choisir au hasard
 *  lui coûterait de l'argent sans qu'il comprenne pourquoi. */
export function ChoixVeillePage({ actives, plafond, aRanger, offre }: {
  actives: PrestationChoisissable[]
  plafond: number
  aRanger: number
  offre: Plan
}) {
  const router = useRouter()
  const [etape, setEtape] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Au-delà du plafond, ce sont les dernières de la liste que la page masque
  // déjà (voir `prestationsAffichees`). On part donc de l'état RÉEL : le laveur
  // n'a rien à faire s'il est d'accord, et tout à changer sinon.
  const masqueesAujourdhui = actives.slice(plafond)
  const [choisies, setChoisies] = useState<string[]>(masqueesAujourdhui.map(s => s.id))

  const basculer = (id: string) =>
    setChoisies(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const pret = choisies.length === aRanger
  const pluriel = aRanger > 1

  async function reporter() {
    setLoading(true)
    await fetch('/api/prestations/reporter', { method: 'POST' }).catch(() => {})
    router.push('/dashboard')
  }

  async function confirmer() {
    setError(null)
    setLoading(true)
    // En série : le serveur compte les prestations actives à chaque appel, deux
    // requêtes simultanées liraient le même compte et passeraient toutes les deux.
    for (const id of choisies) {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_veille: true }),
      })
      if (!res.ok) {
        const corps = await res.json().catch(() => ({}))
        setError(corps.error ?? 'Impossible de mettre cette prestation en veille')
        setLoading(false)
        return
      }
    }
    router.push('/dashboard')
    router.refresh()
  }

  const principal = 'px-6 py-3.5 text-white text-base font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const secondaire = 'px-5 py-3.5 text-base font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40'

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">

        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: FOND_SOMBRE }}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className={SURTITRE} style={{ color: CYAN }}>Offre {PLAN_LABELS[offre]}</span>
            <span className="flex items-center gap-1.5" aria-label={`Étape ${etape} sur 2`}>
              <span className="w-7 h-1 rounded-full" style={{ backgroundColor: etape === 1 ? CYAN : 'rgba(255,255,255,0.2)' }} />
              <span className="w-7 h-1 rounded-full" style={{ backgroundColor: etape === 2 ? CYAN : 'rgba(255,255,255,0.2)' }} />
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-[1.1]">
            {etape === 1
              ? `${plafond} prestation${plafond > 1 ? 's' : ''} sur ${actives.length} seulement sont en ligne`
              : pluriel ? 'Lesquelles retirer de votre page ?' : 'Laquelle retirer de votre page ?'}
          </h1>

          {etape === 1 && (
            <div className="mt-6">
              <ApercuPage actives={actives} plafond={plafond} />
            </div>
          )}
        </div>

        {/* ── Écran 1 : ce qui se passe, et pourquoi ───────────────────── */}
        {etape === 1 && (
          <>
            <div className="mt-8 space-y-6">
              <Point titre="Pourquoi ?">
                L’offre {PLAN_LABELS[offre]} affiche {plafond} prestation{plafond > 1 ? 's' : ''} au
                maximum sur votre page. Vous en avez {actives.length}.
              </Point>
              <Point titre="Ce n’est pas vous qui avez choisi">
                Faute de décision de votre part,{' '}
                {masqueesAujourdhui.length > 0 && (
                  <strong className="text-slate-700 dark:text-slate-200">
                    {masqueesAujourdhui.map(s => `« ${s.name} »`).join(', ')}
                  </strong>
                )}{' '}
                {pluriel ? 'ont été masquées' : 'a été masquée'} par défaut. Vous pouvez reprendre la main.
              </Point>
              <Point titre="Rien n’est effacé">
                {/* Dit avant toute décision : c'est la crainte d'effacer qui
                    fait qu'on n'ose pas trancher, et donc qu'on repousse. */}
                Vos rendez-vous, vos factures et l’historique de vos clients restent intacts. Une
                prestation en veille revient dès que vous changez d’offre.
              </Point>
            </div>

            <div className="flex items-center justify-end gap-2 mt-8">
              <button type="button" onClick={reporter} disabled={loading} className={secondaire}>
                Plus tard
              </button>
              <button
                type="button"
                onClick={() => setEtape(2)}
                className={principal}
                style={{ backgroundColor: BLEU }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BLEU_SOMBRE)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = BLEU)}
              >
                Suivant →
              </button>
            </div>

            {/* L'autre issue, offerte dès l'explication : c'est là que la
                question « et si je payais ? » se pose naturellement. */}
            <div className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Vous préférez garder vos {actives.length} prestations en ligne ?
              </p>
              <Link
                href="/dashboard/abonnement"
                className="inline-block mt-1 text-base font-bold hover:underline"
                style={{ color: BLEU }}
              >
                Passer à l’offre {PLAN_LABELS[OFFRE_SANS_PLAFOND]} — {PLAN_PRICES[OFFRE_SANS_PLAFOND]}€/mois →
              </Link>
            </div>
          </>
        )}

        {/* ── Écran 2 : le choix ───────────────────────────────────────── */}
        {etape === 2 && (
          <>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed mt-8">
              {pluriel ? 'Les prestations déjà masquées sont cochées' : 'La prestation déjà masquée est cochée'}
              {' '}d’avance. Touchez une autre carte pour changer.
            </p>

            <div className="space-y-3 mt-5">
              {actives.map(svc => {
                const retiree = choisies.includes(svc.id)
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => basculer(svc.id)}
                    aria-pressed={retiree}
                    className={`w-full text-left flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all ${
                      retiree
                        ? 'border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/40'
                        : 'bg-white dark:bg-slate-900'
                    }`}
                    style={retiree ? undefined : { borderColor: BLEU }}
                  >
                    {/* La sélection ne « coche » pas, elle ÉTEINT : la carte
                        choisie se grise et son nom se barre. Le laveur voit le
                        résultat de son clic, pas une case de plus à interpréter. */}
                    <span
                      className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-2 ${
                        retiree ? 'border-slate-300 dark:border-slate-600' : 'border-transparent'
                      }`}
                      style={retiree ? undefined : { backgroundColor: BLEU }}
                    >
                      {!retiree && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-base font-bold truncate ${
                        retiree ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'
                      }`}>
                        {svc.name}
                      </span>
                      <span className="block text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                        {svc.price}€ · {svc.duration_minutes} min
                      </span>
                    </span>
                    <span
                      className={`shrink-0 ${SURTITRE} ${retiree ? 'text-slate-400 dark:text-slate-500' : ''}`}
                      style={retiree ? undefined : { color: BLEU }}
                    >
                      {retiree ? 'retirée' : 'en ligne'}
                    </span>
                  </button>
                )
              })}
            </div>

            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-5">{error}</p>}

            <div className="flex items-center justify-between gap-3 mt-8">
              <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                {choisies.length} / {aRanger} {pluriel ? 'retirées' : 'retirée'}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEtape(1)} disabled={loading} className={secondaire}>
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={confirmer}
                  disabled={!pret || loading}
                  className={principal}
                  style={{ backgroundColor: pret && !loading ? BLEU : '#94a3b8' }}
                >
                  {loading ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
