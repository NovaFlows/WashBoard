'use client'

import { useRef, useState } from 'react'
import CarteFidelite3D from '@/components/fidelite/CarteFidelite3D'
import { CompteARebours } from './composants'
import { useDemo } from './etat'
import { I, RESEAU } from './icones'
import { PleinEcranTel } from './PleinEcran'
import '../base.css'
import './demo.css'
import { useT } from '@/components/i18n/I18nProvider'

const VEH: [string, number][] = [['Citadine', 0], ['Berline', 5], ['SUV', 10], ['Utilitaire', 20]]
const PRESTA: [string, string, string, number, string][] = [
  ['ext', 'Extérieur', 'Carrosserie, jantes, vitres', 35, '45 min'],
  ['int', 'Intérieur', 'Aspiration, plastiques, tapis', 45, '1 h'],
  ['complet', 'Lavage complet', 'Intérieur et extérieur', 65, '1 h 30'],
]
const JOURS: [string, number][] = [['ven.', 23], ['sam.', 24], ['dim.', 25], ['lun.', 26], ['mar.', 27]]
const HEURES = ['09:00', '10:00', '11:00', '14:00', '15:30', '16:30']
const GROUPES = ['15:30', '16:30']

type Choix = { e: number; veh: number; presta: string; poils: boolean; jour: number; h: string | null }
const DEPART: Choix = { e: 0, veh: 0, presta: 'complet', poils: false, jour: 1, h: null }

/** Page de réservation côté client, dans un téléphone : elle suit les réglages de la démo. */
export function ReservationClient() {
  const t = useT()
  const { etat } = useDemo()
  const { r: reg, promo } = etat
  const [r, setR] = useState<Choix>(DEPART)
  const defile = useRef<HTMLDivElement>(null)
  const maj = (p: Partial<Choix>) => setR(s => ({ ...s, ...p }))

  const prixPresta = (k: string) => (k === 'complet' ? reg.prixComplet : PRESTA.find(p => p[0] === k)![3])
  const remiseGroupe = r.h && GROUPES.includes(r.h) && r.jour === 1 ? 5 : 0
  const total = () => {
    const brut = prixPresta(r.presta) + VEH[r.veh][1] + (r.poils ? 15 : 0) - remiseGroupe
    return promo ? Math.round(brut * 0.9) : brut
  }
  const tot = total()
  const lienPaiement = reg.acLien === 'Virement' ? 'par virement' : `avec le lien ${reg.acLien}`
  const delai = reg.acDelai === 24 ? 'dans les 24 heures' : reg.acDelai === 1 ? 'dans l’heure' : 'dans les 2 heures'

  let corps
  if (r.e === 0) {
    corps = (
      <>
        <p className="r-titre">{t('Que faut-il laver ?')}</p>
        <div className="vehs">{VEH.map(([n], i) => <button key={n} className="puce" onClick={() => maj({ veh: i })} aria-pressed={r.veh === i}>{t(n)}</button>)}</div>
        {PRESTA.map(([k, n, d, , du]) => {
          const px = prixPresta(k) + VEH[r.veh][1]
          return (
            <button key={k} className="opt" onClick={() => maj({ presta: k })} aria-pressed={r.presta === k}>
              <span className="rd" /><span className="corps"><b>{t(n)}</b><small>{t(d)} · {t(du)}</small></span>
              <span className="px">{promo ? <><s>{px} €</s>{Math.round(px * 0.9)} €</> : `${px} €`}</span>
            </button>
          )
        })}
        <p className="r-titre" style={{ marginTop: 14 }}>{t('Une option ?')}</p>
        <button className="opt" onClick={() => maj({ poils: !r.poils })} aria-pressed={r.poils}>
          <span className="rd" style={{ borderRadius: 5 }} /><span className="corps"><b>{t('Poils d’animaux')}</b><small>{t('Aspiration renforcée')}</small></span><span className="px">+15 €</span>
        </button>
      </>
    )
  } else if (r.e === 1) {
    corps = (
      <>
        <p className="r-titre">{t('Quel jour ?')}</p>
        <div className="jours-r">{JOURS.map(([j, n], i) => <button key={n} onClick={() => maj({ jour: i, h: null })} aria-pressed={r.jour === i}><small>{j}</small><b>{n}</b></button>)}</div>
        <p className="r-titre">{t('À quelle heure ?')}</p>
        <div className="heures-r">
          {HEURES.map(h => {
            const g = r.jour === 1 && GROUPES.includes(h)
            return <button key={h} className={g ? 'groupe' : undefined} onClick={() => maj({ h })} aria-pressed={r.h === h}>{h}{g ? <small>−5 €</small> : null}</button>
          })}
        </div>
        {r.jour === 1 ? <p className="msg-groupe">{t('−5 € sur 15:30 et 16:30 : ce jour-là, le laveur a déjà un rendez-vous tout près de chez vous. Moins de route pour lui, moins cher pour vous.')}</p> : null}
      </>
    )
  } else if (r.e === 2) {
    corps = (
      <>
        <p className="r-titre">{t('Vos coordonnées')}</p>
        <div className="coord">
          <div><small>{t('Nom')}</small><b>{t('Léa Martin')}</b></div>
          <div><small>{t('Téléphone')}</small><b className="num">06 12 34 56 78</b></div>
          <div><small>{t('Adresse du lavage')}</small><b>{t('14 rue Notre-Dame, Bordeaux')}</b></div>
        </div>
        {reg.acompteOn ? (
          <div className="acompte"><b>{t('Acompte de {v0} € pour bloquer le créneau', { v0: Math.round((tot * reg.acompte) / 100) })}</b>{t('Payé')} {lienPaiement} {t('d’Éclat Mobile')} {delai}{t(', le reste sur place. Remboursé si vous annulez au moins 48 h avant.')}</div>
        ) : null}
      </>
    )
  } else {
    corps = (
      <>
        <div className="ok-rond">{I.ok}</div>
        <p className="r-titre" style={{ textAlign: 'center', fontSize: 19 }}>{t('Réservation envoyée')}</p>
        <p style={{ textAlign: 'center', color: 'var(--gris)', fontSize: 13 }}>{t('{v0} {v1} oct. à {h} · {v3} · {tot} €', { v0: JOURS[r.jour][0], v1: JOURS[r.jour][1], h: r.h, v3: PRESTA.find(p => p[0] === r.presta)![1], tot })}</p>
        <div style={{ marginTop: 4 }}>
          {/* key : la carte rejoue son animation quand un réglage change */}
          <CarteFidelite3D key={`${reg.couleur}|${reg.fidReq}|${reg.fidRec}`} couleur={reg.couleur} finition="holo" nom="Éclat Mobile" numero="4F2A"
            requis={reg.fidReq} tampons={0} recompense={reg.fidRec} largeur={240} scenario="reservation" legende="Votre 1er tampon arrive après la prestation." />
        </div>
        <button className="btn btn-ligne" style={{ width: '100%', marginTop: 4 }} onClick={() => setR(DEPART)}>{t('Refaire une réservation')}</button>
      </>
    )
  }

  const remises = [remiseGroupe ? '−5 € créneau groupé' : '', promo ? '−10 % promo' : ''].filter(Boolean).join(' · ')
  const bloque = r.e === 1 && !r.h

  return (
    <PleinEcranTel>
      <div className="tel">
        <div className="tel-ecran">
          <div className="ilot" />
          <div className="etat" style={{ color: '#fff' }}><span className="num">13:42</span>{RESEAU}</div>
          <div className="app resa">
            <div className="app-defile" ref={defile}>
              <div className="resa-tete" style={{ background: reg.couleur }}><span className="lg">{t('ÉM')}</span><p className="r-nom">{t('Éclat Mobile')}</p><p>{t('Lavage auto à domicile · Bordeaux')}</p></div>
              <div className="resa-corps">
                {promo ? <div className="bandeau-promo" style={{ marginBottom: 14 }}><span><b>−10 %</b> {t('ce week-end')}</span><CompteARebours /></div> : null}
                <div className="etapes" aria-hidden>{[0, 1, 2, 3].map(i => <i key={i} className={i <= r.e ? 'on' : undefined} />)}</div>
                {corps}
                <div style={{ height: r.e === 3 ? 20 : 110 }} />
              </div>
            </div>
            {r.e < 3 ? (
              <div className="resa-pied">
                <div className="tot"><span>{t('Total')}<small style={{ display: 'block', color: 'var(--vert)', fontWeight: 550 }}>{remises}</small></span><b>{tot} €</b></div>
                <button className="btn btn-encre" disabled={bloque} style={bloque ? { opacity: 0.4 } : undefined}
                  onClick={() => { if (bloque) return; maj({ e: r.e + 1 }); if (defile.current) defile.current.scrollTop = 0 }}>
                  {t(['Choisir le créneau', 'Continuer', 'Confirmer la réservation'][r.e])}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PleinEcranTel>
  )
}
