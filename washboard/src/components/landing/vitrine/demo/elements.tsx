'use client'

import type { ReactNode } from 'react'
import type { Ctrl } from './ctrl'
import { STATUTS } from './donnees'
import { I } from './icones'
import type { Reglages, StatutRdv } from './types'
import { useT } from '@/components/i18n/I18nProvider'

export function Statut({ s }: { s: StatutRdv }) {
  const tr = useT()
  const [t, cl] = STATUTS[s]
  return <span className={`st ${cl}`}>{tr(t)}</span>
}

export function Titre({ t, s, droite }: { t: ReactNode; s?: ReactNode; droite?: ReactNode }) {
  const tr = useT()
  return (
    <div className="ecr-tete">
      <div>
        <p className="ecr-titre">{typeof t === 'string' ? tr(t) : t}</p>
        {s ? <p className="ecr-sous">{typeof s === 'string' ? tr(s) : s}</p> : null}
      </div>
      {droite}
    </div>
  )
}

/** Retour vers la liste de Plus. */
export function RetourPlus({ c }: { c: Ctrl }) {
  const tr = useT()
  return <button className="retour" onClick={() => c.nav({ sous: null, guide: null })}>{I.gauche}{tr('Plus')}</button>
}

export function Champ({ c, nom, lib, def, type = 'text' }: { c: Ctrl; nom: string; lib: string; def: string; type?: string }) {
  const tr = useT()
  return (
    <label className="fchamp">
      <small>{tr(lib)}</small>
      <input type={type} value={c.v.form[nom] ?? def} onChange={e => c.setForm(nom, e.target.value)} />
    </label>
  )
}

/** Choix unique dans un formulaire (puces). */
export function Choix({ c, nom, opts, def }: { c: Ctrl; nom: string; opts: string[]; def: string }) {
  const cur = c.v.form[nom] ?? def
  return (
    <div className="puces">
      {opts.map(o => <button key={o} className="puce" aria-pressed={cur === o} onClick={() => c.setForm(nom, o)}>{o}</button>)}
    </div>
  )
}

type CleNombre = 'fidReq' | 'delai' | 'prixComplet'
const LIMITES: Record<CleNombre, [number, number, number]> = { fidReq: [3, 20, 1], delai: [1, 24, 1], prixComplet: [40, 120, 5] }

export function Pas({ c, cle, unite = '' }: { c: Ctrl; cle: CleNombre; unite?: string }) {
  const tr = useT()
  const val = c.etat.r[cle]
  const [min, max, pas] = LIMITES[cle]
  const bouger = (d: number) => c.regler({ [cle]: Math.max(min, Math.min(max, val + d * pas)) })
  return (
    <span className="pas">
      <button onClick={() => bouger(-1)} aria-label={tr('Moins')}>−</button>
      <b className="num">{val}{unite}</b>
      <button onClick={() => bouger(1)} aria-label={tr('Plus')}>+</button>
    </span>
  )
}

type CleBascule = 'parVeh' | 'acompteOn' | 'avis' | 'relance'

export function Interr({ on, lib, onClick }: { on: boolean; lib: string; onClick: () => void }) {
  return <button className="interr" role="switch" aria-checked={on} aria-label={lib} onClick={onClick} />
}

export function Bascule({ c, cle, lib }: { c: Ctrl; cle: CleBascule; lib: string }) {
  return <Interr on={c.etat.r[cle]} lib={lib} onClick={() => c.regler({ [cle]: !c.etat.r[cle] })} />
}

/** Choix unique parmi des réglages (puces). */
export function PuceReg<K extends keyof Reglages>({ c, cle, opts, fmt }: { c: Ctrl; cle: K; opts: Reglages[K][]; fmt?: (x: Reglages[K]) => string }) {
  const cur = c.etat.r[cle]
  return (
    <div className="puces">
      {opts.map(o => <button key={String(o)} className="puce" aria-pressed={cur === o} onClick={() => c.regler({ [cle]: o } as Partial<Reglages>)}>{fmt ? fmt(o) : String(o)}</button>)}
    </div>
  )
}
