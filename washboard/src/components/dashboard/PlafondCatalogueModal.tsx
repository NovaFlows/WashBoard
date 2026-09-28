'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Identité WashBoard ──────────────────────────────────────────────────────
// Mêmes valeurs que ChoixVeilleModal, et pour la même raison : une fenêtre qui
// invente ses propres couleurs se reconnaît immédiatement comme une pièce
// rapportée.
const BLEU = '#1651E8'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

export type PrestationEchangeable = { id: string; name: string }

/** Le plafond du catalogue, annoncé en fenêtre plutôt qu'en encadré.
 *
 *  L'encadré vivait au milieu de la liste des prestations, sous le pouce, dans
 *  le flux : on cliquait « Réactiver », rien ne semblait se produire, et le
 *  message apparaissait hors écran. Une fenêtre se voit — c'est tout ce qu'on
 *  lui demande.
 *
 *  Elle propose TROIS sorties, et la première est gratuite : échanger avec une
 *  prestation déjà en ligne. Sans elle, le laveur n'avait que « payer » ou
 *  « abandonner » — et quand les deux seules portes d'une fenêtre mènent à la
 *  caisse ou dehors, on la referme sans lire. L'échange fait ce qu'il voulait
 *  faire, tout de suite, et il verra plus tard si le plafond le gêne vraiment.
 *  C'est aussi comme ça qu'il découvre ce que l'offre supérieure lui
 *  épargnerait : en le vivant, pas en le lisant. */
export function PlafondCatalogueModal({ message, cible, actives, onEchanger, onFermer }: {
  /** Le texte du serveur, qui nomme déjà l'offre et le plafond. On ne le
   *  réécrit pas ici : deux formulations du même refus finiraient par diverger,
   *  et c'est celle du serveur qui fait foi. */
  message: string
  /** La prestation que le laveur voulait remettre en ligne. */
  cible: PrestationEchangeable
  /** Celles qui y sont déjà, et qui peuvent lui céder la place. */
  actives: PrestationEchangeable[]
  /** Endort celle choisie, puis réactive la cible. Rend `true` si les deux ont
   *  abouti — sinon la fenêtre reste ouverte, il n'y a rien à célébrer. */
  onEchanger: (idAEndormir: string) => Promise<boolean>
  onFermer: () => void
}) {
  const [choisie, setChoisie] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  // Tant que la fenêtre est là, la page derrière ne bouge plus. Sans ça, on
  // croit faire défiler la fenêtre et c'est le catalogue qui glisse dessous —
  // la sensation exacte d'une interface qui ne répond pas.
  useEffect(() => {
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = avant }
  }, [])

  // Échap referme : une fenêtre qu'on ne peut quitter qu'au bouton se lit
  // comme un piège, et c'est précisément l'effet inverse de celui voulu. Pas
  // pendant l'échange, en revanche : deux requêtes sont en vol, et fermer au
  // milieu laisserait le catalogue dans un état que personne n'a demandé.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enCours) onFermer() }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [onFermer, enCours])

  async function echanger() {
    if (!choisie || enCours) return
    setEnCours(true)
    const ok = await onEchanger(choisie)
    setEnCours(false)
    if (ok) onFermer()
  }

  return (
    // `overflow-y-auto` sur le VOILE, pas sur la carte : si le contenu dépasse
    // sur un petit écran, c'est toute la fenêtre qui défile, d'un bloc.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1828]/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plafond-catalogue-titre"
    >
      <div className="mx-auto max-w-md px-4 py-4 sm:py-8 min-h-full flex flex-col justify-center">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 p-6">
          <p className={`${SURTITRE} mb-3`} style={{ color: BLEU }}>Catalogue complet</p>

          <h2
            id="plafond-catalogue-titre"
            className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 text-balance"
          >
            Cette prestation ne peut pas être réactivée
          </h2>

          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            {message}
          </p>

          {actives.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                Échanger sans changer d’offre
              </p>
              {/* Le nom de la cible, pour que l'échange soit concret. « Une
                  prestation » ne se visualise pas ; « sf » si. */}
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Choisissez celle qui laisse sa place à <span className="font-semibold text-slate-700 dark:text-slate-200">{cible.name}</span>. Elle passera en veille, vous pourrez la remettre quand vous voulez.
              </p>

              <ul className="mt-3 space-y-1.5">
                {actives.map(p => {
                  const active = choisie === p.id
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setChoisie(active ? null : p.id)}
                        disabled={enCours}
                        aria-pressed={active}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.98] disabled:opacity-40 ${
                          active
                            ? 'border-transparent bg-blue-50 dark:bg-blue-950/40 ring-2'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                        style={active ? { boxShadow: `0 0 0 2px ${BLEU}` } : undefined}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            active ? 'border-transparent' : 'border-slate-300 dark:border-slate-600'
                          }`}
                          style={active ? { backgroundColor: BLEU } : undefined}
                          aria-hidden
                        >
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-[15px] text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <button
                onClick={echanger}
                disabled={!choisie || enCours}
                className="mt-4 w-full px-5 py-3 text-white text-[15px] font-semibold rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                style={{ backgroundColor: BLEU }}
              >
                {enCours ? 'Échange en cours…' : 'Échanger'}
              </button>
            </div>
          )}

          {/* Les deux autres sorties, en retrait : le changement d'offre reste
              la vraie réponse au problème, mais l'imposer en premier ferait
              refermer la fenêtre avant d'avoir lu qu'un échange est possible. */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <Link
              href="/dashboard/abonnement"
              className="text-sm font-bold hover:underline"
              style={{ color: BLEU }}
            >
              Voir les offres
            </Link>
            <button
              onClick={onFermer}
              disabled={enCours}
              className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
