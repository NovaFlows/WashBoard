'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Ctrl } from './ctrl'
import { JOURS_NOMS } from './donnees'
import { EcranAgenda, EcranAuj, EcranChiffres, EcranClients, EcranDocs } from './ecrans'
import { tousClients, useDemo } from './etat'
import { ContenuFeuille } from './feuilles'
import { I, RESEAU } from './icones'
import { Logo } from '../Icones'
import { EcranPlus } from './plus'
import type { EcranDemo, Feuille, Reglages, Vue } from './types'
import '../base.css'
import './demo.css'

export type ModeApp = 'tel' | 'dk'

const vueInitiale = (ecran: EcranDemo, dk: boolean): Vue => ({
  ecran, fiche: null, sous: null, jour: 5, vueAg: dk ? 'semaine' : 'jour', filtre: 'tous', filtreDoc: 'tous',
  q: '', qGuide: '', guide: null, barre: null, feuille: null, clientSel: 'c1', onglet: 'argent', form: {}, nk: 0,
})

function Ecran({ c }: { c: Ctrl }) {
  switch (c.v.ecran) {
    case 'agenda': return <EcranAgenda c={c} />
    case 'clients': return <EcranClients c={c} />
    case 'chiffres': return <EcranChiffres c={c} />
    case 'docs': return <EcranDocs c={c} />
    case 'plus': return <EcranPlus c={c} />
    default: return <EcranAuj c={c} />
  }
}

function BarreBas({ c }: { c: Ctrl }) {
  const b = (k: EcranDemo, ic: string, t: string) => (
    <button onClick={() => c.aller(k)} aria-current={c.v.ecran === k ? 'page' : undefined}>{I[ic]}{t}</button>
  )
  return (
    <nav className="app-nav" aria-label="Navigation de l’application">
      {b('auj', 'maison', 'Aujourd’hui')}
      {b('agenda', 'agenda', 'Agenda')}
      <button className="plus" onClick={() => c.ouvrir({ t: 'nouveau' })} aria-label="Nouveau">{I.plus}</button>
      {b('clients', 'clients', 'Clients')}
      {b('plus', 'plus3', 'Plus')}
    </nav>
  )
}

function Rail({ c }: { c: Ctrl }) {
  const b = (k: EcranDemo, ic: string, t: string, style?: { marginTop: string }) => (
    <button className="it" style={style} onClick={() => c.aller(k)} aria-current={c.v.ecran === k ? 'page' : undefined}>{I[ic]}{t}</button>
  )
  return (
    <aside className="rail">
      <div className="marque"><Logo /><div>WashBoard<small>Julien Roussel</small></div></div>
      <button className="nouveau" onClick={() => c.ouvrir({ t: 'nouveau' })}>{I.plus}Nouveau</button>
      {b('auj', 'maison', 'Aujourd’hui')}
      {b('agenda', 'agenda', 'Agenda')}
      {b('clients', 'clients', 'Clients')}
      {b('chiffres', 'chiffres', 'Chiffres')}
      {b('plus', 'plus3', 'Plus')}
      {b('docs', 'doc', 'Documents', { marginTop: 'auto' })}
      <div className="bas"><span className="av">JR</span>Julien R. <span className="badge" style={{ marginLeft: 'auto' }}>PRO</span></div>
    </aside>
  )
}

/** Application du laveur (téléphone ou ordinateur) : une vue locale, l'état de la journée partagé. */
export function AppLaveur({ mode, ecranInitial }: { mode: ModeApp; ecranInitial: EcranDemo }) {
  const { etat, dispatch } = useDemo()
  const dk = mode === 'dk'
  const [v, setV] = useState(() => vueInitiale(ecranInitial, dk))
  const [message, setMessage] = useState<{ m: string; vu: boolean }>({ m: '', vu: false })
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  const defile = useRef<HTMLDivElement>(null)
  // La feuille garde son contenu pendant qu'elle redescend.
  const [derniere, setDerniere] = useState<Feuille | null>(null)
  if (v.feuille && v.feuille !== derniere) setDerniere(v.feuille)

  useLayoutEffect(() => { if (defile.current) defile.current.scrollTop = 0 }, [v.nk])
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current) }, [])

  const maj = useCallback((p: Partial<Vue>) => setV(s => ({ ...s, ...p })), [])
  const nav = useCallback((p: Partial<Vue>) => setV(s => ({ ...s, ...p, nk: s.nk + 1 })), [])
  const toast = useCallback((m: string) => {
    setMessage({ m, vu: true })
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = setTimeout(() => setMessage(s => ({ ...s, vu: false })), 3600)
  }, [])

  const c = useMemo<Ctrl>(() => {
    const regler = (p: Partial<Reglages>) => dispatch({ t: 'regler', p })
    const g = (k: string, d: string) => v.form[k] ?? d
    const fermer = () => maj({ feuille: null })
    return {
      dk, v, etat, dispatch, maj, nav, toast, regler, fermer,
      aller: ecran => {
        nav({ ecran, fiche: null, sous: null, feuille: null })
        if (ecran === 'chiffres') dispatch({ t: 'mission', k: 'chiffres' })
      },
      ouvrir: f => maj({ form: {}, feuille: f }),
      client: id => {
        nav({ feuille: null, ecran: 'clients', sous: null, ...(dk ? { clientSel: id } : { fiche: id }) })
        if (id === 'c1' && etat.cloture) dispatch({ t: 'mission', k: 'fiche' })
      },
      setForm: (nom, val) => setV(s => ({ ...s, form: { ...s.form, [nom]: val } })),
      creer: type => {
        if (type === 'rdv') {
          const j = ({ 'Dim. 18': 6, 'Lun. 12': 0, 'Mar. 13': 1 } as Record<string, number>)[g('r-jour', 'Dim. 18')]
          const presta = g('r-presta', 'Lavage complet')
          const prix = ({ Extérieur: 35, Intérieur: 45, 'Lavage complet': etat.r.prixComplet } as Record<string, number>)[presta]
          const saisie = g('r-h', '14:00')
          const h = /^\d{2}:\d{2}$/.test(saisie) ? saisie : '14:00'
          const [hh, mm] = h.split(':').map(Number)
          const fin = `${String(Math.min(23, hh + 1)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
          const nom = g('r-cli', 'Nadia Saïdi')
          dispatch({ t: 'rdv', rdv: { h, fin, nom, presta, prix, st: 'confirme', jour: j, neuf: true } })
          nav({ feuille: null, ecran: 'agenda', jour: j, ...(dk ? (v.vueAg === 'mois' ? { vueAg: 'semaine' as const } : {}) : { vueAg: 'jour' as const }) })
          toast(`Rendez-vous ajouté : ${nom}, ${JOURS_NOMS[j]} à ${h}. Il reçoit sa confirmation.`)
        } else if (type === 'client') {
          const id = `n${etat.clientsPlus.length + 1}`
          const nom = g('c-nom', 'Inès Garnier')
          dispatch({ t: 'client', client: { id, nom, type: 'part', v: 0, ca: 0, der: '—', veh: g('c-veh', 'Clio V'), t: 0 } })
          nav({ feuille: null, ecran: 'clients', fiche: dk ? null : id, clientSel: id, filtre: 'tous', q: '' })
          toast(`${nom} est dans ton fichier clients.`)
        } else if (type === 'devis' || type === 'facture') {
          const devis = type === 'devis'
          const n = devis ? `D-${String(6 + etat.docs.filter(d => d.t === 'Devis').length).padStart(5, '0')}` : `F-${String(44 + etat.docs.filter(d => d.t === 'Facture').length).padStart(5, '0')}`
          const cli = g('d-cli', 'Garage Renault Mérignac')
          const pro = tousClients(etat).some(x => x.nom === cli && x.type === 'pro')
          dispatch({ t: 'doc', doc: { n, t: devis ? 'Devis' : 'Facture', cli, p: +g('d-p', '210') || 0, date: '17 oct.', st: devis ? 'En attente' : 'Émise' } })
          nav({ feuille: null, ...(dk ? { ecran: 'docs' as const } : { ecran: 'plus' as const, sous: 'docs' as const }) })
          toast(devis ? `Devis ${n} créé et envoyé par email.` : pro ? `Facture ${n} créée et envoyée par email à ${cli}.` : `Facture ${n} créée. ${cli} la retrouve depuis son lien de confirmation.`)
        } else if (type === 'depense') {
          dispatch({ t: 'depense', d: { l: g('e-lib', 'Cire carnauba'), c: `${g('e-cat', 'Produits')} · 17 oct.`, p: +g('e-p', '38') || 0 } })
          nav({ feuille: null, onglet: 'argent', ...(dk ? { ecran: 'chiffres' as const } : { ecran: 'plus' as const, sous: 'chiffres' as const }) })
          toast('Dépense ajoutée : ton résultat du mois est à jour.')
        } else {
          maj({ feuille: null })
          toast(`Rappel ajouté sur la fiche de ${g('t-cli', 'Sophie Lambert')}.`)
        }
      },
    }
  }, [dk, v, etat, dispatch, maj, nav, toast])

  const ouvert = !!v.feuille
  const corps = (
    <>
      <div className="app-defile" ref={defile}><Ecran c={c} /></div>
      <div className={`voile${ouvert ? ' ouvert' : ''}`} onClick={c.fermer} aria-hidden />
      <aside className={`feuille${ouvert ? ' ouvert' : ''}`} role="dialog" aria-label="Détail" aria-hidden={!ouvert}>
        {derniere ? <ContenuFeuille c={c} f={derniere} /> : null}
      </aside>
      {dk ? null : <BarreBas c={c} />}
      <div className={`toast${message.vu ? ' vu' : ''}`} role="status">{message.m ? <>{I.ok}<span>{message.m}</span></> : null}</div>
    </>
  )

  const app = (
    <div className="app" onKeyDown={e => { if (e.key === 'Escape' && ouvert) c.fermer() }}>
      {dk ? <><Rail c={c} /><div className="dk-main">{corps}</div></> : corps}
    </div>
  )

  if (dk) return app
  return (
    <div className="tel-ecran">
      <div className="ilot" />
      <div className="etat"><span className="num">13:42</span>{RESEAU}</div>
      {app}
    </div>
  )
}

