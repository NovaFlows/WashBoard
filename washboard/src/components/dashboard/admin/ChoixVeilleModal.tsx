'use client'

import { useState } from 'react'
import type { Service } from '@/types'

/** Fenêtre qui fait choisir au laveur les prestations à mettre en veille
 *  quand il en a plus que son offre n'en affiche.
 *
 *  Pourquoi une fenêtre plutôt qu'un bandeau : un bandeau se referme et
 *  s'oublie, et le laveur continue de croire que ses quatre prestations sont
 *  en ligne alors que sa page n'en montre que trois. Ici la question est posée,
 *  et tant qu'il n'a pas répondu c'est le système qui tranche à sa place — ce
 *  qui est exactement ce qu'on veut lui éviter.
 *
 *  Et pourquoi le laisser choisir plutôt que désactiver les plus récentes :
 *  sa prestation la plus rentable peut être la dernière ajoutée. Éteindre au
 *  hasard lui coûterait de l'argent sans qu'il comprenne pourquoi. */
export function ChoixVeilleModal({ actives, plafond, aRanger, onValider, onFermer, loading, error }: {
  actives: Service[]
  plafond: number
  aRanger: number
  onValider: (ids: string[]) => void
  onFermer: () => void
  loading: boolean
  error: string | null
}) {
  const [choisies, setChoisies] = useState<string[]>([])

  function basculer(id: string) {
    setChoisies(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const compte = choisies.length
  const pret = compte === aRanger

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Choisissez {aRanger > 1 ? `les ${aRanger} prestations` : 'la prestation'} à mettre en veille
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Votre offre en affiche <strong>{plafond}</strong> sur votre page de réservation,
            vous en avez <strong>{actives.length}</strong>.
          </p>
        </div>

        <div className="px-6 space-y-2">
          {actives.map(svc => {
            const prise = choisies.includes(svc.id)
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
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{svc.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {svc.price}€ · {svc.duration_minutes} min
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="p-6 pt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            {/* Dit AVANT de cliquer, pas après : c'est la crainte d'effacer qui
                fait qu'on n'ose pas trancher, et donc qu'on repousse. */}
            Rien n’est effacé. Vos rendez-vous passés, vos factures et l’historique de vos clients
            restent intacts — la prestation disparaît seulement de votre page de réservation, et
            vous pourrez la réactiver en changeant d’offre.
          </p>

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-3">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {compte} sur {aRanger} {aRanger > 1 ? 'choisies' : 'choisie'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onFermer}
                disabled={loading}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={() => onValider(choisies)}
                disabled={!pret || loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Enregistrement…' : 'Mettre en veille'}
              </button>
            </div>
          </div>

          {/* « Plus tard » n'est pas une échappatoire silencieuse : on dit ce
              qui se passe si on ne choisit pas, sinon le laveur croit que ses
              quatre prestations restent en ligne. */}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
            Sans choix de votre part, votre page affiche les {plafond} premières par ordre de
            création — les autres sont déjà invisibles pour vos clients.
          </p>
        </div>
      </div>
    </div>
  )
}
