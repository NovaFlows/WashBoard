'use client'

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import { CLIENTS, DEP, DOCS_BASE, ENC_BASE, RDV, SEMAINE } from './donnees'
import type { Client, CleMission, Depense, Doc, Etat, Rdv, Reglages } from './types'

export const etatInitial = (): Etat => ({
  cloture: false,
  promo: false,
  sophie: false,
  m: { cloture: false, fiche: false, chiffres: false, promo: false },
  depenses: [],
  docs: [],
  clientsPlus: [],
  rdvPlus: [],
  payees: {},
  nePlus: {},
  r: {
    avis: true, canal: 'SMS', delai: 3, relance: true, relMois: 3, acompteOn: true, acompte: 30, acDelai: 2,
    acLien: 'PayPal', fidReq: 8, fidRec: 'Lavage complet offert', parVeh: true, couleur: '#306090', prixComplet: 65,
    horaires: [true, true, true, true, true, true, false],
  },
})

export type Action =
  | { t: 'cloturer' }
  | { t: 'mission'; k: CleMission }
  | { t: 'sophie' }
  | { t: 'promo'; on: boolean }
  | { t: 'regler'; p: Partial<Reglages> }
  | { t: 'rdv'; rdv: Rdv }
  | { t: 'client'; client: Client }
  | { t: 'doc'; doc: Doc }
  | { t: 'depense'; d: Depense }
  | { t: 'nePlus'; id: string }
  | { t: 'payer'; n: string }
  | { t: 'raz' }

function reducer(e: Etat, a: Action): Etat {
  switch (a.t) {
    case 'cloturer': return { ...e, cloture: true, m: { ...e.m, cloture: true } }
    case 'mission': return e.m[a.k] ? e : { ...e, m: { ...e.m, [a.k]: true } }
    case 'sophie': return { ...e, sophie: true }
    case 'promo': return { ...e, promo: a.on, m: a.on ? { ...e.m, promo: true } : e.m }
    case 'regler': return { ...e, r: { ...e.r, ...a.p } }
    case 'rdv': return { ...e, rdvPlus: [...e.rdvPlus, a.rdv] }
    case 'client': return { ...e, clientsPlus: [a.client, ...e.clientsPlus] }
    case 'doc': return { ...e, docs: [a.doc, ...e.docs] }
    case 'depense': return { ...e, depenses: [a.d, ...e.depenses] }
    case 'nePlus': return { ...e, nePlus: { ...e.nePlus, [a.id]: !e.nePlus[a.id] } }
    case 'payer': return { ...e, payees: { ...e.payees, [a.n]: true } }
    case 'raz': return etatInitial()
  }
}

type Contexte = {
  etat: Etat
  dispatch: Dispatch<Action>
  /** Change à chaque remise à zéro : les appareils repartent de leur écran initial. */
  epoque: number
  raz: () => void
}

const Ctx = createContext<Contexte | null>(null)

/** Fournit l'état partagé. Enveloppe toute la landing. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [etat, dispatch] = useReducer(reducer, undefined, etatInitial)
  const [epoque, setEpoque] = useState(0)
  const raz = useCallback(() => {
    dispatch({ t: 'raz' })
    setEpoque(n => n + 1)
  }, [])
  const valeur = useMemo(() => ({ etat, dispatch, epoque, raz }), [etat, epoque, raz])
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

export function useDemo(): Contexte {
  const c = useContext(Ctx)
  if (!c) throw new Error('DemoProvider manquant : les composants de démo doivent être dans la landing.')
  return c
}

// Valeurs dérivées de l'état partagé.

export const statutRdv = (r: Rdv, e: Etat) => (r.id === 'r2' && e.cloture ? 'termine' : r.st)

export const tousClients = (e: Etat): Client[] => [...CLIENTS, ...e.clientsPlus]

/** Client tel qu'il apparaît après les actions de la démo (Camille gagne son 4e tampon). */
export function clientVu(id: string, e: Etat): Client {
  const c = { ...tousClients(e).find(x => x.id === id)! }
  if (id === 'c1' && e.cloture) Object.assign(c, { v: 4, ca: 236, t: 4, der: 'aujourd’hui' })
  return c
}

export const totalDepenses = (e: Etat) => DEP + e.depenses.reduce((a, d) => a + d.p, 0)
export const encaisse = (e: Etat) => ENC_BASE + 120 + (e.cloture ? 59 : 0)

export function tousDocs(e: Etat): Doc[] {
  const f43: Doc[] = e.cloture ? [{ n: 'F-00043', t: 'Facture', cli: 'Camille Lefebvre', p: 59, date: '17 oct.', st: 'Émise' }] : []
  return [...e.docs, ...f43, ...DOCS_BASE].map(d => (e.payees[d.n] ? { ...d, st: 'Payée' } : d))
}

export function rdvDuJour(i: number, e: Etat): Rdv[] {
  const d = SEMAINE[i]
  const base: Rdv[] = d.auj
    ? RDV.map(r => ({ ...r, st: statutRdv(r, e) }))
    : (d.rdv ?? []).map(r => ({ ...r, st: i === 6 && r.nom === 'Sophie Lambert' && e.sophie ? ('confirme' as const) : r.st }))
  return base.concat(e.rdvPlus.filter(r => r.jour === i)).sort((a, b) => a.h.localeCompare(b.h))
}
