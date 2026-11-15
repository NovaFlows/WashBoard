'use client'

import { useState } from 'react'
import { IcFacture, IcOk } from './Icones'
import { useT } from '@/components/i18n/I18nProvider'

const eur = (n: number) => `${n.toLocaleString('fr-FR')} €`

const CLIENTS = {
  pro: { nom: 'Garage Renault Mérignac', h: '17:30', presta: 'Forfait flotte · 3 véhicules', adr: '2 avenue de Mérignac, 33700 Mérignac', siret: 'SIRET 812 345 678 00021', ligne: 'Forfait flotte · utilitaire', q: 3, pu: 70, mail: 'compta@garage-merignac.fr' },
  part: { nom: 'Camille Lefebvre', h: '11:30', presta: 'Extérieur + intérieur · Citadine', adr: '8 quai des Chartrons, 33000 Bordeaux', siret: '', ligne: 'Extérieur + intérieur · citadine', q: 1, pu: 59, mail: '' },
}

export default function FacturationDemo() {
  const t = useT()
  const [pro, setPro] = useState(true)
  const [termine, setTermine] = useState(false)
  const [payee, setPayee] = useState(false)
  const [num, setNum] = useState(44)

  const c = pro ? CLIENTS.pro : CLIENTS.part
  const total = c.q * c.pu
  const choisir = (estPro: boolean) => { setPro(estPro); setTermine(false); setPayee(false) }

  return (
    <>
      <div className="segment" role="group" aria-label={t('Type de client')}>
        <button type="button" aria-pressed={pro} onClick={() => choisir(true)}>{t('Client pro')}</button>
        <button type="button" aria-pressed={!pro} onClick={() => choisir(false)}>{t('Client particulier')}</button>
      </div>

      {!termine ? (
        <>
          <div className="surf fac-rdv">
            <div className="ligne">
              <span className="h">{c.h}</span>
              <span className="corps"><span className="nom">{c.nom}</span><span className="det">{t(c.presta)}</span></span>
              <span className="fin"><span className="prix">{eur(total)}</span><br /><span className="st st-ambre">{t('À clôturer')}</span></span>
            </div>
            <button type="button" className="btn btn-encre" onClick={() => setTermine(true)}>{t('Marquer terminé')}</button>
          </div>
          <p className="rassure" style={{ textAlign: 'center' }}>{t('Clique : la facture se fait toute seule.')}</p>
        </>
      ) : (
        <div aria-live="polite">
          <div className="papier">
            <div className="ent-f">
              <div className="em">
                <span className="lg">{t('ÉM')}</span>
                <div><b>{t('Éclat Mobile')}</b><small>{t('Julien Roussel, EI')}</small><small>{t('14 cours Victor Hugo, 33000 Bordeaux')}</small><small>{t('SIRET 912 345 678 00012')}</small></div>
              </div>
              <div className="tf"><b>{t('Facture')}</b><small className="num">N° F-{String(num).padStart(5, '0')}</small><small>{t('17 octobre 2026')}</small></div>
            </div>
            <div className="pour">
              <div><small>{t('Facturé à')}</small><b style={{ fontWeight: 600 }}>{c.nom}</b><small>{c.adr}</small>{c.siret && <small>{c.siret}</small>}</div>
              <div style={{ textAlign: 'right' }}><small>{t('Prestation du')}</small><b style={{ fontWeight: 600 }}>{t('17 oct. 2026')}</b></div>
            </div>
            <table>
              <thead><tr><th>{t('Désignation')}</th><th>{t('Qté')}</th><th>{t('Prix unit.')}</th><th>{t('Montant')}</th></tr></thead>
              <tbody><tr><td>{t(c.ligne)}</td><td className="num">{c.q}</td><td className="num">{eur(c.pu)}</td><td className="num">{eur(total)}</td></tr></tbody>
            </table>
            <div className="tot-f"><span>{t('Total')}</span><b>{eur(total)}</b></div>
            <p className="ment">{t('TVA non applicable, art. 293 B du CGI. Paiement à réception.{v0}', { v0: pro ? ' En cas de retard : pénalités au taux d’intérêt légal majoré, et indemnité forfaitaire de 40 € pour frais de recouvrement.' : '' })}</p>
          </div>
          {payee
            ? <div className="fac-statut ok"><IcOk />{t('Payée : elle entre dans ton encaissé du mois.')}</div>
            : pro
              ? <div className="fac-statut ok"><IcOk />{t('Envoyée par email à')} {c.mail}</div>
              : <div className="fac-statut info"><IcFacture />{t('Camille la retrouve depuis son lien de confirmation.')}</div>}
          <div className="fac-act">
            {!payee && <button type="button" className="btn btn-encre" onClick={() => setPayee(true)}>{t('Marquer payée')}</button>}
            <button type="button" className="btn btn-ligne" onClick={() => { setTermine(false); setPayee(false); setNum(n => n + 1) }}>{t('Rejouer')}</button>
          </div>
        </div>
      )}
    </>
  )
}

