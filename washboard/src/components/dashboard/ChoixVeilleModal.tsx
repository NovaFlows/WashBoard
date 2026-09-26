'use client'

import { useEffect, useState } from 'react'
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
// Reprises de la page d'accueil publique. Une fenêtre qui invente ses propres
// couleurs se reconnaît immédiatement comme une pièce rapportée.
const BLEU = '#1651E8'
const BLEU_SOMBRE = '#0F4ACC'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Première offre qui lève le plafond du catalogue. Calculée plutôt qu'écrite
 *  en dur : déplacer le catalogue illimité d'un palier à l'autre ne doit pas
 *  laisser cette fenêtre proposer la mauvaise offre. */
const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const OFFRE_SANS_PLAFOND = OFFRES.find(p => SERVICE_QUOTA[p] === null) ?? 'starter'

/** Aperçu de la page de réservation telle que les clients la voient.
 *
 *  Il fait comprendre en une seconde ce que trois paragraphes peinaient à
 *  expliquer : le laveur n'imagine pas sa page, il la regarde.
 *
 *  Sur fond clair, et volontairement. La version précédente le posait à
 *  l'intérieur d'un bandeau sombre, donc une boîte dans une boîte dans une
 *  carte : trois surfaces empilées, du texte translucide sur du bleu nuit, et
 *  plus rien de net. Ici il n'y a qu'un seul encadré, et il porte le message. */
function ApercuPage({ actives, plafond }: { actives: PrestationChoisissable[]; plafond: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <p className={`${SURTITRE} text-slate-400 dark:text-slate-500 px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800`}>
        Votre page de réservation
      </p>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {actives.map((svc, i) => {
          const masquee = i >= plafond
          return (
            <div
              key={svc.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 ${
                masquee ? 'bg-slate-50 dark:bg-slate-800/40' : ''
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${masquee ? 'bg-slate-300 dark:bg-slate-600' : ''}`}
                style={masquee ? undefined : { backgroundColor: BLEU }}
              />
              <span className={`flex-1 truncate text-sm ${
                masquee
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : 'font-medium text-slate-800 dark:text-slate-200'
              }`}>
                {svc.name}
              </span>
              <span className={`text-xs shrink-0 ${
                masquee
                  ? `${SURTITRE} text-slate-400 dark:text-slate-500`
                  : 'font-semibold text-slate-400 dark:text-slate-500'
              }`}>
                {masquee ? 'masquée' : `${svc.price}€`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Fenêtre en deux temps : on explique, puis on propose.
 *
 *  Une seule surface blanche, un seul encadré à l'intérieur. La version
 *  précédente empilait un bandeau bleu nuit haut d'une demi-carte, un encadré
 *  translucide dedans, puis un bloc blanc avec des puces — quatre niveaux de
 *  fond pour trois phrases.
 *
 *  Le bleu de marque ne sert plus de décor : il ne colore que ce qui est actif
 *  ou cliquable. Ce qui est éteint est gris. On lit l'état d'un coup d'œil sans
 *  avoir à déchiffrer une nuance.
 *
 *  Le laveur doit d'abord comprendre que sa page a DÉJÀ changé, sans qu'il
 *  l'ait décidé : « Suivant » devient l'accusé de réception de l'explication.
 *  Mélanger explication et liste à cocher faisait qu'on ne lisait ni l'une ni
 *  l'autre — l'œil tombe sur les cases, coche, et passe.
 *
 *  Et pourquoi le laisser choisir plutôt que d'éteindre les plus récentes : sa
 *  prestation la plus rentable peut être la dernière ajoutée. Choisir au hasard
 *  lui coûterait de l'argent sans qu'il comprenne pourquoi. */
export function ChoixVeilleModal({ actives, plafond, aRanger, offre }: {
  actives: PrestationChoisissable[]
  plafond: number
  aRanger: number
  /** Offre en cours, pour la nommer au lieu de dire « votre offre ». */
  offre: Plan
}) {
  const router = useRouter()
  // La fenêtre gère sa propre disparition : le layout la rend sur chaque page,
  // il ne peut pas savoir qu'on vient de la fermer.
  const [ferme, setFerme] = useState(false)
  const [etape, setEtape] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Au-delà du plafond, ce sont les dernières de la liste que la page masque
  // déjà (voir `prestationsAffichees`). On part donc de l'état RÉEL : le laveur
  // n'a rien à faire s'il est d'accord, et tout à changer sinon.
  const masqueesAujourdhui = actives.slice(plafond)
  const [choisies, setChoisies] = useState<string[]>(masqueesAujourdhui.map(s => s.id))

  // Tant que la fenêtre est là, la page derrière ne bouge plus. Sans ça, on
  // croit faire défiler la fenêtre et c'est le tableau de bord qui glisse
  // dessous — la sensation exacte d'une interface qui ne répond pas.
  useEffect(() => {
    if (ferme) return
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = avant }
  }, [ferme])

  const basculer = (id: string) =>
    setChoisies(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const pret = choisies.length === aRanger
  const pluriel = aRanger > 1

  async function reporter() {
    setLoading(true)
    // Le cookie évite qu'elle resurgisse à chaque changement de page : sans
    // lui, « Plus tard » ne durerait que jusqu'au prochain clic dans le menu.
    await fetch('/api/prestations/reporter', { method: 'POST' }).catch(() => {})
    setFerme(true)
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
    setFerme(true)
    // Les pages sont rendues côté serveur : sans ça, les compteurs et la liste
    // des prestations garderaient leur ancienne valeur jusqu'au rechargement.
    router.refresh()
  }

  if (ferme) return null

  // `:active` sur les boutons : un bouton qui ne bouge pas sous le doigt donne
  // l'impression que le clic n'est pas passé. Seuls `transform` et les couleurs
  // sont animés — jamais la géométrie, qui ferait sauter la mise en page.
  const principal = 'px-5 py-3 text-white text-[15px] font-semibold rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
  const secondaire = 'px-4 py-3 text-[15px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-40'

  return (
    // `overflow-y-auto` sur le VOILE, pas sur la carte : si le contenu dépasse
    // l'écran, c'est l'arrière-plan qui défile et la carte garde un seul bloc.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1828]/60 backdrop-blur-[2px]">
      <div className="mx-auto max-w-md px-4 py-4 sm:py-8 min-h-full flex flex-col justify-center">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 p-6">

          {/* ── Bandeau : offre + avancement ─────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className={SURTITRE} style={{ color: BLEU }}>Offre {PLAN_LABELS[offre]}</span>
            <span className="flex items-center gap-1.5" aria-label={`Étape ${etape} sur 2`}>
              <span
                className="w-6 h-[3px] rounded-full transition-colors duration-200 ease-out"
                style={{ backgroundColor: etape === 1 ? BLEU : '#e2e8f0' }}
              />
              <span
                className="w-6 h-[3px] rounded-full transition-colors duration-200 ease-out"
                style={{ backgroundColor: etape === 2 ? BLEU : '#e2e8f0' }}
              />
            </span>
          </div>

          {/* ── Écran 1 : ce qui se passe, et pourquoi ───────────────────── */}
          {etape === 1 && (
            <>
              <h2 className="text-[22px] font-black tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15]">
                {plafond} prestation{plafond > 1 ? 's' : ''} sur {actives.length} seulement
                <br />sont en ligne
              </h2>

              <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed mt-3">
                L’offre <strong className="text-slate-700 dark:text-slate-200">{PLAN_LABELS[offre]}</strong> en
                affiche {plafond} au maximum. Faute de décision de votre part,{' '}
                {masqueesAujourdhui.length > 0 && (
                  <strong className="text-slate-700 dark:text-slate-200">
                    {masqueesAujourdhui.map(s => `« ${s.name} »`).join(', ')}
                  </strong>
                )}{' '}
                {pluriel ? 'ont été masquées' : 'a été masquée'} par défaut.
              </p>

              <div className="mt-5">
                <ApercuPage actives={actives} plafond={plafond} />
              </div>

              {/* Dit avant toute décision : c'est la crainte d'effacer qui fait
                  qu'on n'ose pas trancher, et donc qu'on repousse. */}
              <p className="text-[13px] text-slate-400 dark:text-slate-500 leading-relaxed mt-4">
                Rien n’est effacé : vos rendez-vous, vos factures et votre historique restent intacts,
                et une prestation en veille revient dès que vous changez d’offre.
              </p>

              <div className="flex items-center justify-end gap-1 mt-6">
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
                  Choisir
                </button>
              </div>

              {/* L'autre issue. N'offrir que la mise en veille reviendrait à
                  faire croire qu'il faut forcément renoncer à quelque chose. */}
              <div className="-mx-6 -mb-6 mt-5 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl bg-slate-50/60 dark:bg-slate-950/30">
                <Link
                  href="/dashboard/abonnement"
                  className="block text-sm font-bold hover:underline"
                  style={{ color: BLEU }}
                >
                  Tout garder — offre {PLAN_LABELS[OFFRE_SANS_PLAFOND]} à {PLAN_PRICES[OFFRE_SANS_PLAFOND]}€/mois →
                </Link>
              </div>
            </>
          )}

          {/* ── Écran 2 : le choix ───────────────────────────────────────── */}
          {etape === 2 && (
            <>
              <h2 className="text-[22px] font-black tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15]">
                {pluriel ? 'Lesquelles retirer' : 'Laquelle retirer'} de votre page ?
              </h2>
              <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                {pluriel ? 'Les prestations déjà masquées sont sélectionnées' : 'La prestation déjà masquée est sélectionnée'}.
                Touchez une autre carte pour changer.
              </p>

              <div className="space-y-2 mt-5">
                {actives.map(svc => {
                  const retiree = choisies.includes(svc.id)
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => basculer(svc.id)}
                      aria-pressed={retiree}
                      className={`w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.99] ${
                        retiree
                          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* La sélection ÉTEINT au lieu de cocher : la carte
                          choisie se grise et son nom se barre. Le laveur voit le
                          résultat de son clic, pas une case de plus à décoder. */}
                      <span
                        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors duration-150 ease-out ${
                          retiree ? 'border-slate-300 dark:border-slate-600' : 'border-transparent'
                        }`}
                        style={retiree ? undefined : { backgroundColor: BLEU }}
                      >
                        {!retiree && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[15px] font-semibold truncate ${
                          retiree ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {svc.name}
                        </span>
                        <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {svc.price}€ · {svc.duration_minutes} min
                        </span>
                      </span>
                      <span className={`shrink-0 ${SURTITRE} text-slate-400 dark:text-slate-500`}>
                        {retiree ? 'retirée' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>

              {error && <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-4">{error}</p>}

              <div className="flex items-center justify-between gap-3 mt-6">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  {choisies.length} / {aRanger} {pluriel ? 'retirées' : 'retirée'}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setEtape(1)} disabled={loading} className={secondaire}>
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={confirmer}
                    disabled={!pret || loading}
                    className={principal}
                    style={{ backgroundColor: pret && !loading ? BLEU : '#cbd5e1' }}
                  >
                    {loading ? 'Enregistrement…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
