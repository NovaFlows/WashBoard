'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLAN_LABELS, PLAN_PRICES, SERVICE_QUOTA, type Plan } from '@/lib/plan'

/** Ce dont la fenêtre a besoin, et rien de plus : elle affiche un nom, un prix
 *  et une durée. Exiger un `Service` complet obligeait les appelants à charger
 *  des colonnes inutiles, ou à forcer le type — ce qui revient à désactiver la
 *  vérification à l'endroit même où elle sert. */
type PrestationChoisissable = {
  id: string
  name: string
  price: number
  duration_minutes: number
}

/** Première offre qui lève le plafond du catalogue. Calculée plutôt qu'écrite
 *  en dur : déplacer le catalogue illimité d'un palier à l'autre ne doit pas
 *  laisser cette fenêtre proposer la mauvaise offre. */
const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const OFFRE_SANS_PLAFOND = OFFRES.find(p => SERVICE_QUOTA[p] === null) ?? 'starter'

function Etape({ n }: { n: 1 | 2 }) {
  return (
    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap">
      Étape {n} sur 2
    </span>
  )
}

/** Fenêtre en deux temps : on explique, puis on propose.
 *
 *  Mélanger les deux — l'explication au-dessus d'une liste à cocher — faisait
 *  qu'on ne lisait ni l'une ni l'autre : l'œil tombe sur les cases, coche, et
 *  passe. Or le laveur doit d'abord comprendre que sa page a DÉJÀ changé, sans
 *  qu'il l'ait décidé. Séparer en deux écrans force ce temps de lecture, et le
 *  bouton « Suivant » devient l'accusé de réception de l'explication.
 *
 *  L'écran 1 donne aussi les DEUX issues : retirer une prestation, ou changer
 *  d'offre. N'en présenter qu'une revient à faire croire qu'il faut forcément
 *  renoncer à quelque chose.
 *
 *  Et pourquoi le laisser choisir plutôt que d'éteindre les plus récentes : sa
 *  prestation la plus rentable peut être la dernière ajoutée. Choisir au hasard
 *  lui coûterait de l'argent sans qu'il comprenne pourquoi. */
export function ChoixVeilleModal({ actives, plafond, aRanger, offre, onValider, onFermer, loading, error }: {
  actives: PrestationChoisissable[]
  plafond: number
  aRanger: number
  /** Offre en cours, pour la nommer au lieu de dire « votre offre ». */
  offre: Plan
  onValider: (ids: string[]) => void
  onFermer: () => void
  loading: boolean
  error: string | null
}) {
  const [etape, setEtape] = useState<1 | 2>(1)

  // Au-delà du plafond, ce sont les dernières de la liste que la page masque
  // déjà (voir `prestationsAffichees`). On part donc de l'état RÉEL : le laveur
  // n'a rien à faire s'il est d'accord, et tout à changer sinon. Une liste vide
  // l'obligerait à reconstituer lui-même ce qui se passe aujourd'hui.
  const masqueesAujourdhui = actives.slice(plafond)
  const [choisies, setChoisies] = useState<string[]>(masqueesAujourdhui.map(s => s.id))

  function basculer(id: string) {
    setChoisies(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const pret = choisies.length === aRanger
  const nomOffreSup = PLAN_LABELS[OFFRE_SANS_PLAFOND]
  const pluriel = aRanger > 1

  const cadre = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm'
  const boite = 'w-full max-w-lg max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl'

  // ── Écran 1 : ce qui se passe, et pourquoi ────────────────────────────────
  if (etape === 1) {
    return (
      <div className={cadre}>
        <div className={boite}>
          <div className="p-6 pb-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                Offre {PLAN_LABELS[offre]}
              </span>
              <Etape n={1} />
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              Votre page de réservation n’affiche que {plafond} prestation{plafond > 1 ? 's' : ''} sur {actives.length}
            </h2>

            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pourquoi ?</dt>
                <dd className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  L’offre {PLAN_LABELS[offre]} affiche {plafond} prestation{plafond > 1 ? 's' : ''} au
                  maximum sur votre page de réservation. Vous en avez {actives.length}.
                </dd>
              </div>

              <div>
                <dt className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Ce qui se passe aujourd’hui
                </dt>
                <dd className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  Faute de choix de votre part,{' '}
                  {masqueesAujourdhui.length > 0 && (
                    <>
                      <strong className="text-slate-700 dark:text-slate-200">
                        {masqueesAujourdhui.map(s => `« ${s.name} »`).join(', ')}
                      </strong>{' '}
                    </>
                  )}
                  {pluriel ? 'sont déjà invisibles' : 'est déjà invisible'} pour vos clients.
                  Ce n’est pas vous qui l’avez décidé : c’est ce qui se passe par défaut.
                </dd>
              </div>

              <div>
                <dt className="text-sm font-semibold text-slate-800 dark:text-slate-200">Rien n’est effacé</dt>
                <dd className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  {/* Dit avant toute décision : c'est la crainte d'effacer qui
                      fait qu'on n'ose pas trancher, et donc qu'on repousse. */}
                  Vos rendez-vous passés, vos factures et l’historique de vos clients restent intacts.
                  Une prestation mise en veille revient dès que vous changez d’offre.
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onFermer}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={() => setEtape(2)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Suivant →
              </button>
            </div>
          </div>

          {/* L'autre issue, offerte dès l'explication : c'est là que la
              question « et si je payais ? » se pose naturellement. */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vous préférez garder vos {actives.length} prestations en ligne ?
            </p>
            <Link
              href="/dashboard/abonnement"
              className="inline-block mt-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Passer à l’offre {nomOffreSup} — {PLAN_PRICES[OFFRE_SANS_PLAFOND]}€/mois →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Écran 2 : le choix ────────────────────────────────────────────────────
  return (
    <div className={cadre}>
      <div className={boite}>
        <div className="p-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
              Offre {PLAN_LABELS[offre]}
            </span>
            <Etape n={2} />
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {pluriel ? `Choisissez les ${aRanger} prestations à retirer` : 'Choisissez la prestation à retirer'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            {pluriel ? 'Celles' : 'Celle'} qui {pluriel ? 'sont' : 'est'} déjà masquée{pluriel ? 's' : ''}
            {' '}{pluriel ? 'sont' : 'est'} cochée{pluriel ? 's' : ''} d’avance. Changez si vous préférez en garder
            {' '}{pluriel ? 'd’autres' : 'une autre'}.
          </p>

          <div className="space-y-2 mt-5">
            {actives.map((svc, i) => {
              const prise = choisies.includes(svc.id)
              const masqueeAujourdhui = i >= plafond
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => basculer(svc.id)}
                  aria-pressed={prise}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                    prise
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${
                    prise ? 'bg-amber-500 border-amber-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {prise && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{svc.name}</span>
                      {/* L'étiquette dit l'état ACTUEL, pas le résultat du clic :
                          c'est ce qui rend l'explication vérifiable d'un coup d'œil. */}
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        masqueeAujourdhui
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {masqueeAujourdhui ? 'masquée' : 'en ligne'}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {svc.price}€ · {svc.duration_minutes} min
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-4">{error}</p>}

          <div className="flex items-center justify-between gap-3 mt-6">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {choisies.length} sur {aRanger} {pluriel ? 'cochées' : 'cochée'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEtape(1)}
                disabled={loading}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40"
              >
                ← Retour
              </button>
              <button
                type="button"
                onClick={() => onValider(choisies)}
                disabled={!pret || loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
