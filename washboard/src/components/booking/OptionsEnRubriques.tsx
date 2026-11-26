'use client'

import { useState, type ReactNode } from 'react'
import type { ServiceAddon } from '@/types'
import { enDepliants, rubriquesDesOptions, type RubriqueOptions } from '@/lib/optionsRubriques'
import { useT } from '@/components/i18n/I18nProvider'

// Les options d'une prestation, rangées par rubrique. Quand il y en a beaucoup (voir
// `enDepliants`), chaque rubrique est un dépliant : le client voit trois ou quatre titres au
// lieu d'une quinzaine de lignes, et le nombre d'options qu'il a déjà cochées dans chacun.
// Sinon, la liste reste comme elle était — avec ou sans titres selon l'écran.

type Props = {
  options: ServiceAddon[]
  estChoisie: (option: ServiceAddon) => boolean
  /** Une ligne d'option (case, libellé, prix) : l'écran garde sa mise en forme. */
  rendu: (option: ServiceAddon) => ReactNode
  /** Liste courte : afficher quand même le nom des rubriques en simples titres (écran classique). */
  titresSiCourte?: boolean
  classeTitre?: string
  /** Préfixe des identifiants (un jeu d'options par véhicule : ils ne doivent pas se répéter). */
  idBase?: string
}

function Depliant({ rubrique, estChoisie, rendu, id }: { rubrique: RubriqueOptions; estChoisie: Props['estChoisie']; rendu: Props['rendu']; id: string }) {
  const t = useT()
  const choisies = rubrique.options.filter(estChoisie).length
  // Ouvert au départ si le client y a déjà coché quelque chose (retour depuis l'étape suivante) ;
  // ensuite il décide : cocher ou décocher ne referme jamais un dépliant sous son doigt.
  const [ouvert, setOuvert] = useState(choisies > 0)
  return (
    <div className="border-b border-zinc-200/70 dark:border-zinc-700 last:border-b-0">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert(o => !o)}
        className="flex w-full min-h-11 items-center justify-between gap-3 py-2 text-left"
      >
        <span className="text-sm font-semibold">{rubrique.nom}</span>
        <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {choisies > 0 && (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {choisies === 1 ? t('1 choisie') : t('{n} choisies', { n: choisies })}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <div id={id} hidden={!ouvert} className="pb-2">
        {rubrique.options.map(o => <div key={o.id}>{rendu(o)}</div>)}
      </div>
    </div>
  )
}

export default function OptionsEnRubriques({ options, estChoisie, rendu, titresSiCourte = false, classeTitre = 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5', idBase = 'rubrique-options' }: Props) {
  const rubriques = rubriquesDesOptions(options)
  if (enDepliants(rubriques)) {
    return (
      <div className="rounded-xl border border-zinc-200/70 px-3 dark:border-zinc-700">
        {rubriques.map((r, i) => <Depliant key={r.nom} id={`${idBase}-${i}`} rubrique={r} estChoisie={estChoisie} rendu={rendu} />)}
      </div>
    )
  }
  if (titresSiCourte) {
    return (
      <>
        {rubriques.map(r => (
          <div key={r.nom} className="mb-5">
            <p className={classeTitre}>{r.nom}</p>
            <div className="space-y-2">{r.options.map(o => <div key={o.id}>{rendu(o)}</div>)}</div>
          </div>
        ))}
      </>
    )
  }
  return <>{options.map(o => <div key={o.id}>{rendu(o)}</div>)}</>
}
