'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  PLAN_CARDS, formatEuros, freeMonthsLabel, lienRendezVousBusiness, rendezVousExterne,
  yearlyMonthlyEquivalent, yearlyPrice, LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, RDV_BUSINESS_MINUTES,
} from '@/lib/plan'
import { useT } from '@/components/i18n/I18nProvider'

// Lignes de PLAN_CARDS marquées « Nouveau » : les trois sorties d'octobre 2026.
const NOUVEAUTES = ['Acompte à la réservation', 'Promotions avec compte à rebours', 'Carte de fidélité']

export default function Tarifs() {
  const t = useT()
  const [annuel, setAnnuel] = useState(false)
  const rdv = lienRendezVousBusiness()
  const rdvExterne = rendezVousExterne(rdv)

  return (
    <section className="section" id="tarifs">
      <div className="w">
        <div className="tarif-tete">
          <div>
            <p className="sur-titre"><span className="pt" />{t('Les formules')}</p>
            <h2 className="h2">{t('Commence gratuitement.')} <span className="doux">{t('Tu paies quand ça remplit.')}</span></h2>
          </div>
          <div className="segment" role="group" aria-label={t('Facturation')}>
            <button type="button" aria-pressed={!annuel} onClick={() => setAnnuel(false)}>{t('Mensuel')}</button>
            <button type="button" aria-pressed={annuel} onClick={() => setAnnuel(true)}>{t('Annuel · {offre}', { offre: t(freeMonthsLabel()) })}</button>
          </div>
        </div>

        <div className="offres">
          {PLAN_CARDS.map(card => {
            const an = annuel && card.price > 0 && !card.surDevis
            return (
              <div className={`offre${card.highlight ? ' phare' : ''}`} key={card.key}>
                <div className="nm">{card.name}{card.highlight && <span className="pop">{t('Le plus populaire')}</span>}</div>
                <p className="tag">{t(card.tagline)}</p>
                <div className="px">
                  {card.surDevis ? <b className="texte">{t(LIBELLE_CONTACT)}</b> : (
                    <>
                      {card.from && <span>{t('dès')}</span>}
                      <b className="num">{card.price === 0 ? '0 €' : `${formatEuros(an ? yearlyMonthlyEquivalent(card.price) : card.price)} €`}</b>
                      <span>{card.price === 0 ? t('pour toujours') : t('/mois')}</span>
                    </>
                  )}
                </div>
                <p className="an">
                  {card.surDevis
                    ? t('Un échange de {n} minutes, puis un devis', { n: RDV_BUSINESS_MINUTES })
                    : card.price === 0
                      ? t('Sans carte bancaire, sans limite de durée')
                      : an ? t('Soit {prix} € par an, {offre}', { prix: formatEuros(yearlyPrice(card.price)), offre: t(freeMonthsLabel()) }) : ''}
                </p>
                <ul>
                  {card.features.map(f => (
                    <li key={f}><span>{t(f)}{NOUVEAUTES.includes(f) && <> <span className="badge badge-new">{t('Nouveau')}</span></>}</span></li>
                  ))}
                </ul>
                {card.surDevis ? (
                  <a
                    className="btn btn-encre" href={rdv}
                    {...(rdvExterne ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >{t(LIBELLE_RDV_BUSINESS)}</a>
                ) : (
                  <Link className={`btn ${card.highlight || card.price === 0 ? 'btn-ligne' : 'btn-encre'}`} href="/signup">
                    {card.price === 0 ? t('Commencer gratuitement') : t('Essayer 14 jours gratuits')}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
        <p className="rassure">{t('14 jours d’essai avec tout débloqué, sans carte bancaire. Sans choix de formule, ton compte passe tout seul sur Découverte : on ne coupe rien.')}</p>
      </div>
    </section>
  )
}
