'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// ── Identité WashBoard ──────────────────────────────────────────────────────
// Mêmes valeurs que ChoixVeilleModal, et pour la même raison : une fenêtre qui
// invente ses propres couleurs se reconnaît immédiatement comme une pièce
// rapportée.
const BLEU = '#1651E8'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Le plafond du catalogue, annoncé en fenêtre plutôt qu'en encadré.
 *
 *  L'encadré vivait au milieu de la liste des prestations, sous le pouce, dans
 *  le flux : on cliquait « Réactiver », rien ne semblait se produire, et le
 *  message apparaissait hors écran. Une fenêtre se voit — c'est tout ce qu'on
 *  lui demande.
 *
 *  Elle ne bloque rien : « Plus tard » la referme et le laveur retrouve son
 *  catalogue intact. Ce n'est pas une sanction, c'est le moment exact où
 *  l'offre supérieure lui sert à quelque chose. */
export function PlafondCatalogueModal({ message, onFermer }: {
  /** Le texte du serveur, qui nomme déjà l'offre et le plafond. On ne le
   *  réécrit pas ici : deux formulations du même refus finiraient par diverger,
   *  et c'est celle du serveur qui fait foi. */
  message: string
  onFermer: () => void
}) {
  // Tant que la fenêtre est là, la page derrière ne bouge plus. Sans ça, on
  // croit faire défiler la fenêtre et c'est le catalogue qui glisse dessous —
  // la sensation exacte d'une interface qui ne répond pas.
  useEffect(() => {
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = avant }
  }, [])

  // Échap referme : une fenêtre qu'on ne peut quitter qu'au bouton se lit
  // comme un piège, et c'est précisément l'effet inverse de celui voulu.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [onFermer])

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

          <div className="mt-6 flex items-center gap-2">
            <Link
              href="/dashboard/abonnement"
              className="px-5 py-3 text-white text-[15px] font-semibold rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]"
              style={{ backgroundColor: BLEU }}
            >
              Voir les offres
            </Link>
            <button
              onClick={onFermer}
              className="px-4 py-3 text-[15px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
