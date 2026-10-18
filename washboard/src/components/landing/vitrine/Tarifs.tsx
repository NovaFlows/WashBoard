'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  PLAN_CARDS, formatEuros, freeMonthsLabel, lienRendezVousBusiness, rendezVousExterne,
  yearlyMonthlyEquivalent, yearlyPrice, LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, RDV_BUSINESS_MINUTES,
} from '@/lib/plan'

// Lignes de PLAN_CARDS marquées « Nouveau » : les trois sorties d'octobre 2026.
const NOUVEAUTES = ['Acompte à la réservation', 'Promotions avec compte à rebours', 'Carte de fidélité']

export default function Tarifs() {
  const [annuel, setAnnuel] = useState(false)
  const rdv = lienRendezVousBusiness()
  const rdvExterne = rendezVousExterne(rdv)

  return (
    <section className="section" id="tarifs">
      <div className="w">
        <div className="tarif-tete">
          <div>
            <p className="sur-titre"><span className="pt" />Les formules</p>
            <h2 className="h2">Commence gratuitement. <span className="doux">Tu paies quand ça remplit.</span></h2>
          </div>
          <div className="segment" role="group" aria-label="Facturation">
            <button type="button" aria-pressed={!annuel} onClick={() => setAnnuel(false)}>Mensuel</button>
            <button type="button" aria-pressed={annuel} onClick={() => setAnnuel(true)}>Annuel · {freeMonthsLabel()}</button>
          </div>
        </div>

        <div className="offres">
          {PLAN_CARDS.map(card => {
            const an = annuel && card.price > 0 && !card.surDevis
            return (
              <div className={`offre${card.highlight ? ' phare' : ''}`} key={card.key}>
                <div className="nm">{card.name}{card.highlight && <span className="pop">Le plus populaire</span>}</div>
                <p className="tag">{card.tagline}</p>
                <div className="px">
                  {card.surDevis ? <b className="texte">{LIBELLE_CONTACT}</b> : (
                    <>
                      {card.from && <span>dès</span>}
                      <b className="num">{card.price === 0 ? '0 €' : `${formatEuros(an ? yearlyMonthlyEquivalent(card.price) : card.price)} €`}</b>
                      <span>{card.price === 0 ? 'pour toujours' : '/mois'}</span>
                    </>
                  )}
                </div>
                <p className="an">
                  {card.surDevis
                    ? `Un échange de ${RDV_BUSINESS_MINUTES} minutes, puis un devis`
                    : card.price === 0
                      ? 'Sans carte bancaire, sans limite de durée'
                      : an ? `Soit ${formatEuros(yearlyPrice(card.price))} € par an, ${freeMonthsLabel()}` : ''}
                </p>
                <ul>
                  {card.features.map(f => (
                    <li key={f}><span>{f}{NOUVEAUTES.includes(f) && <> <span className="badge badge-new">Nouveau</span></>}</span></li>
                  ))}
                </ul>
                {card.surDevis ? (
                  <a
                    className="btn btn-encre" href={rdv}
                    {...(rdvExterne ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >{LIBELLE_RDV_BUSINESS}</a>
                ) : (
                  <Link className={`btn ${card.highlight || card.price === 0 ? 'btn-ligne' : 'btn-encre'}`} href="/signup">
                    {card.price === 0 ? 'Commencer gratuitement' : 'Essayer 1 mois gratuit'}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <p className="rassure">Un mois d’essai avec tout débloqué, sans carte bancaire. Sans choix de formule, ton compte passe tout seul sur Découverte : on ne coupe rien.</p>
      </div>
    </section>
  )
}
