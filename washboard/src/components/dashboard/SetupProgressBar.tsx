'use client'

import Link from 'next/link'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { usePreferenceLocale } from '@/hooks/usePreferenceLocale'
import {
  CLE_CARTE_CACHEE, CLE_MASQUES, ecrireMasques, lireMasques, nettoyerMasques, nombreMasques,
  peutEtreMasque, phraseMasques, reglagesAffiches,
} from '@/lib/reglagesMasques'
import type { SetupProgress } from '@/lib/setupProgress'

// Avancement de la configuration, en tête des réglages.
//
// Volontairement discret : une barre fine, un pourcentage, une phrase. Un
// grand encart de bienvenue serait vite du bruit pour quelqu'un qui vient
// simplement changer un tarif.
//
// Il reste affiché même à 100 % : de nouveaux réglages viendront s'ajouter au
// produit, et un laveur qui voit sa barre disparaître puis réapparaître un
// mois plus tard croirait avoir perdu quelque chose.

/** Onze éléments au total : tout lister ferait un mur. On montre les premiers,
 *  déjà triés par urgence, et on annonce le reste d'un mot. */
const MAX_AFFICHES = 4

/** Au-dessus de ce seuil, la barre reste bleue.
 *
 *  L'orange n'a de sens que sur un compte visiblement inachevé. Passé les
 *  trois quarts, il ne signale plus un problème : il inquiète quelqu'un dont
 *  la page tourne, à propos de réglages facultatifs. L'information « il manque
 *  quelque chose d'important » reste portée par la phrase, qui la dit avec des
 *  mots plutôt qu'avec une couleur d'alerte. */
const SEUIL_BLEU = 75

export function SetupProgressBar({ progress }: { progress: SetupProgress }) {
  // Chaque réglage vit à deux endroits : l'ancien écran sur le site, le nouveau dans
  // l'application installée. Sans ce choix, un tap depuis la PWA faisait sortir le laveur
  // de l'application refaite (Alexandre, 2026-09-27).
  const isPwa = usePwaStandalone()
  const [brutMasques, setMasques] = usePreferenceLocale(CLE_MASQUES)
  const [cachee, setCachee] = usePreferenceLocale(CLE_CARTE_CACHEE)

  // Un réglage fait entre-temps ne reste pas dans la liste des écartés.
  const masques = nettoyerMasques(progress.missing, lireMasques(brutMasques))
  const restants = reglagesAffiches(progress.missing, masques)
  const ecartes = nombreMasques(progress.missing, masques)

  const alerte = progress.missing.some(m => m.blocking) && progress.percent < SEUIL_BLEU
  const affiches = restants.slice(0, MAX_AFFICHES)
  const reste = restants.length - affiches.length

  /** Ouvrir un réglage facultatif sans le remplir vaut « pas pour moi » : on l'écarte au
   *  moment du tap. S'il le fait quand même, il sortira des manques tout seul. */
  const ecarter = (cle: string) => setMasques(ecrireMasques([...masques, cle]))

  // La carte entière peut être mise de côté (le laveur la retrouve depuis « Plus »).
  if (cachee === '1') return null

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Configuration de votre compte
        </h3>
        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
          {progress.percent}&nbsp;%
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            alerte ? 'bg-amber-500' : progress.complete ? 'bg-emerald-500' : 'bg-[#1651E8]'
          }`}
          style={{ width: `${Math.max(progress.percent, 3)}%` }}
        />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {progress.complete
          ? 'Tout est configuré. Vos clients ont toutes les informations pour réserver sereinement.'
          : progress.missing.some(m => m.blocking)
            // Tant qu'un point bloquant manque, la page ne peut pas encaisser
            // de réservation : le dire franchement vaut mieux qu'un
            // encouragement, quelle que soit la couleur de la barre.
            ? 'Il manque encore de quoi permettre à vos clients de réserver.'
            : progress.essentialsDone
              // L'essentiel est fait : on ne réclame plus rien, on explique ce
              // que le reste apporte. Ces réglages sont facultatifs, le ton
              // doit le refléter.
              ? 'Votre page fonctionne. Ces réglages vous feront gagner du temps et rassureront vos clients.'
              : 'Un compte complet inspire confiance et évite les allers-retours avec vos clients.'}
      </p>

      {affiches.length > 0 && (
        <ul className="space-y-1.5 mt-3">
          {affiches.map(item => (
            <li key={item.key}>
              <Link
                href={isPwa ? item.hrefV2 : item.href}
                onClick={() => { if (peutEtreMasque(item)) ecarter(item.key) }}
                className="group flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors"
              >
                <span
                  aria-hidden
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.blocking ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
                {item.label}
                <svg
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {reste > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2.5">
          et {reste} autre{reste > 1 ? 's' : ''} réglage{reste > 1 ? 's' : ''} facultatif{reste > 1 ? 's' : ''}
        </p>
      )}

      {/* Ce qui explique l'écart à 100 % quand la liste est vide : sans cette ligne, le
          laveur verrait « 85 % » et plus rien à faire. */}
      {ecartes > 0 && (
        <button
          type="button"
          onClick={() => setMasques(null)}
          className="mt-2.5 text-xs text-slate-400 dark:text-slate-500 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {phraseMasques(ecartes)} · revoir
        </button>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setCachee('1')}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Masquer
        </button>
      </div>
    </div>
  )
}
