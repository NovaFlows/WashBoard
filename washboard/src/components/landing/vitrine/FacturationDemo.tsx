'use client'

import { useState } from 'react'
import { IcFacture, IcOk } from './Icones'

const eur = (n: number) => `${n.toLocaleString('fr-FR')} €`

const CLIENTS = {
  pro: { nom: 'Garage Renault Mérignac', h: '17:30', presta: 'Forfait flotte · 3 véhicules', adr: '2 avenue de Mérignac, 33700 Mérignac', siret: 'SIRET 812 345 678 00021', ligne: 'Forfait flotte · utilitaire', q: 3, pu: 70, mail: 'compta@garage-merignac.fr' },
  part: { nom: 'Camille Lefebvre', h: '11:30', presta: 'Extérieur + intérieur · Citadine', adr: '8 quai des Chartrons, 33000 Bordeaux', siret: '', ligne: 'Extérieur + intérieur · citadine', q: 1, pu: 59, mail: '' },
}

export default function FacturationDemo() {
  const [pro, setPro] = useState(true)
  const [termine, setTermine] = useState(false)
  const [payee, setPayee] = useState(false)
  const [num, setNum] = useState(44)

  const c = pro ? CLIENTS.pro : CLIENTS.part
  const total = c.q * c.pu
  const choisir = (estPro: boolean) => { setPro(estPro); setTermine(false); setPayee(false) }

  return (
    <>
      <div className="segment" role="group" aria-label="Type de client">
        <button type="button" aria-pressed={pro} onClick={() => choisir(true)}>Client pro</button>
        <button type="button" aria-pressed={!pro} onClick={() => choisir(false)}>Client particulier</button>
      </div>

      {!termine ? (
        <>
          <div className="surf fac-rdv">
            <div className="ligne">
              <span className="h">{c.h}</span>
              <span className="corps"><span className="nom">{c.nom}</span><span className="det">{c.presta}</span></span>
              <span className="fin"><span className="prix">{eur(total)}</span><br /><span className="st st-ambre">À clôturer</span></span>
            </div>
            <button type="button" className="btn btn-encre" onClick={() => setTermine(true)}>Marquer terminé</button>
          </div>
          <p className="rassure" style={{ textAlign: 'center' }}>Clique : la facture se fait toute seule.</p>
        </>
      ) : (
        <div aria-live="polite">
          <div className="papier">
            <div className="ent-f">
              <div className="em">
                <span className="lg">ÉM</span>
                <div><b>Éclat Mobile</b><small>Julien Roussel, EI</small><small>14 cours Victor Hugo, 33000 Bordeaux</small><small>SIRET 912 345 678 00012</small></div>
              </div>
              <div className="tf"><b>Facture</b><small className="num">N° F-{String(num).padStart(5, '0')}</small><small>17 octobre 2026</small></div>
            </div>
            <div className="pour">
              <div><small>Facturé à</small><b style={{ fontWeight: 600 }}>{c.nom}</b><small>{c.adr}</small>{c.siret && <small>{c.siret}</small>}</div>
              <div style={{ textAlign: 'right' }}><small>Prestation du</small><b style={{ fontWeight: 600 }}>17 oct. 2026</b></div>
            </div>
            <table>
              <thead><tr><th>Désignation</th><th>Qté</th><th>Prix unit.</th><th>Montant</th></tr></thead>
              <tbody><tr><td>{c.ligne}</td><td className="num">{c.q}</td><td className="num">{eur(c.pu)}</td><td className="num">{eur(total)}</td></tr></tbody>
            </table>
            <div className="tot-f"><span>Total</span><b>{eur(total)}</b></div>
            <p className="ment">TVA non applicable, art. 293 B du CGI. Paiement à réception.{pro ? ' En cas de retard : pénalités au taux d’intérêt légal majoré, et indemnité forfaitaire de 40 € pour frais de recouvrement.' : ''}</p>
          </div>
          {payee
            ? <div className="fac-statut ok"><IcOk />Payée : elle entre dans ton encaissé du mois.</div>
            : pro
              ? <div className="fac-statut ok"><IcOk />Envoyée par email à {c.mail}</div>
              : <div className="fac-statut info"><IcFacture />Camille la retrouve depuis son lien de confirmation.</div>}
          <div className="fac-act">
            {!payee && <button type="button" className="btn btn-encre" onClick={() => setPayee(true)}>Marquer payée</button>}
            <button type="button" className="btn btn-ligne" onClick={() => { setTermine(false); setPayee(false); setNum(n => n + 1) }}>Rejouer</button>
          </div>
        </div>
      )}
    </>
  )
}

