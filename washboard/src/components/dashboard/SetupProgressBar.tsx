'use client'

import Link from 'next/link'
import { useDesignV2 } from '@/components/dashboard/DesignV2Context'
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

const POLICE = '[font-family:var(--font-archivo)]'
const STYLE_V1 = {
  carte: 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5',
  titre: 'text-sm font-bold text-slate-900 dark:text-white',
  piste: 'h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3',
  jauge: 'bg-[#1651E8]',
  jaugeAlerte: 'bg-amber-500',
  jaugeComplete: 'bg-emerald-500',
  phrase: 'text-sm text-slate-500 dark:text-slate-400',
  lien: 'group flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors',
  point: 'bg-slate-300 dark:bg-slate-600',
  pointBloquant: 'bg-amber-500',
  discret: 'text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
}
// Même carte dans la v2 : jetons de la refonte (surface, encre, gris, accent, ambre, vert).
const STYLE_V2: typeof STYLE_V1 = {
  carte: `rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-5 text-[color:var(--v2-color-encre)] ${POLICE}`,
  titre: `text-[14.5px] [font-weight:var(--v2-type-corps-fort-poids)] text-[color:var(--v2-color-encre)]`,
  piste: 'h-1.5 rounded-full bg-[color:var(--v2-filet)] overflow-hidden mb-3',
  jauge: 'bg-[color:var(--v2-color-accent)]',
  jaugeAlerte: 'bg-[color:var(--v2-color-ambre)]',
  jaugeComplete: 'bg-[color:var(--v2-color-vert)]',
  phrase: 'text-[13.5px] text-[color:var(--v2-color-gris)]',
  lien: 'group flex min-h-9 items-center gap-2 text-[14px] text-[color:var(--v2-color-encre)] hover:text-[color:var(--v2-color-accent)] transition-colors',
  point: 'bg-[color:var(--v2-filet-fort)]',
  pointBloquant: 'bg-[color:var(--v2-color-ambre)]',
  discret: 'text-[12.5px] text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]',
}

export function SetupProgressBar({ progress }: { progress: SetupProgress }) {
  // Chaque réglage vit à deux endroits : l'ancien écran sur le site, le nouveau dans la v2
  // (téléphone, ou ordinateur en bêta). Sans ce choix, un tap faisait sortir le laveur de la v2
  // (Alexandre, 2026-09-27) — encore le cas sur la v2 ordinateur jusqu'au 2026-10-10.
  const v2 = useDesignV2()
  const c = v2 ? STYLE_V2 : STYLE_V1
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
    <div className={c.carte}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className={c.titre}>
          Configuration de votre compte
        </h3>
        <span className={`${c.titre} tabular-nums`}>
          {progress.percent}&nbsp;%
        </span>
      </div>

      <div className={c.piste}>
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            alerte ? c.jaugeAlerte : progress.complete ? c.jaugeComplete : c.jauge
          }`}
          style={{ width: `${Math.max(progress.percent, 3)}%` }}
        />
      </div>

      <p className={c.phrase}>
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
                href={v2 ? item.hrefV2 : item.href}
                onClick={() => { if (peutEtreMasque(item)) ecarter(item.key) }}
                className={c.lien}
              >
                <span
                  aria-hidden
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.blocking ? c.pointBloquant : c.point
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
        <p className={`${c.discret} mt-2.5`}>
          et {reste} autre{reste > 1 ? 's' : ''} réglage{reste > 1 ? 's' : ''} facultatif{reste > 1 ? 's' : ''}
        </p>
      )}

      {/* Ce qui explique l'écart à 100 % quand la liste est vide : sans cette ligne, le
          laveur verrait « 85 % » et plus rien à faire. */}
      {ecartes > 0 && (
        <button
          type="button"
          onClick={() => setMasques(null)}
          className={`mt-2.5 underline underline-offset-2 ${c.discret}`}
        >
          {phraseMasques(ecartes)} · revoir
        </button>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setCachee('1')}
          className={c.discret}
        >
          Masquer
        </button>
      </div>
    </div>
  )
}
