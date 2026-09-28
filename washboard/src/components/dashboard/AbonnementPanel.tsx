'use client'

import { useState } from 'react'
import {
  PLAN_CARDS, PLAN_PRICES, PLAN_HISTORIQUE, monthsOwed, freeMonthsLabel, formatEuros,
  lienRendezVousBusiness, LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, PLAN_COULEURS,
  yearlyPrice, yearlyMonthlyEquivalent, type Plan, type BillingCycle,
} from '@/lib/plan'
import BillingToggle from '@/components/ui/BillingToggle'

type Props = {
  subscriptionStatus: string
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  plan: Plan
  grandfathered: boolean
  /** `null` : l'offre n'a pas de plafond, ou le comptage n'a pas pu être lu. */
  plafondReservations: number | null
  reservationsCeMois: number | null
  plafondPrestations: number | null
  prestationsAuCatalogue: number | null
  /** Essai terminé sans formule choisie : le compte tourne sur Découverte et
   *  on attend une décision. */
  doitChoisir: boolean
}

/** Une jauge « 3 / 5 ». Le laveur doit voir sa limite AVANT de la heurter :
 *  découvrir le plafond au moment où un client n'arrive pas à réserver, c'est
 *  découvrir qu'on a déjà perdu le client. */
function Jauge({ titre, utilise, plafond, unite }: {
  titre: string
  utilise: number
  plafond: number
  unite: string
}) {
  const part = Math.min(100, Math.round((utilise / plafond) * 100))
  const chaud = utilise >= plafond
  const proche = !chaud && utilise >= plafond - 1
  const couleur = chaud ? 'bg-red-500' : proche ? 'bg-amber-500' : 'bg-blue-600'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{titre}</p>
        <p className={`text-sm font-bold ${chaud ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
          {utilise} <span className="font-medium text-slate-400">/ {plafond}</span>
        </p>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${couleur} transition-all`} style={{ width: `${part}%` }} />
      </div>
      {chaud && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">
          Plafond atteint : {unite}
        </p>
      )}
    </div>
  )
}

function StatusBadge({ status, plan, grandfathered }: { status: string; plan: Plan; grandfathered: boolean }) {
  if (grandfathered) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
        Accès complet
      </span>
    )
  }

  // Sur l'offre gratuite, l'abonnement n'est pas « expiré » : il n'y en a pas.
  //
  // Sans ce cas, un laveur retombé sur Découverte à la fin de son essai lisait
  // « Expiré — votre accès est suspendu » en rouge, alors que sa page de
  // réservation fonctionne et que c'est précisément ce qu'on lui promet. Le
  // ton disait l'inverse du produit.
  // La condition ne regarde PAS le statut de paiement : on ne peut pas être
  // « abonné actif » et sur l'offre gratuite en même temps. Si les deux se
  // présentent, c'est l'offre qui dit la vérité de ce que le laveur obtient.
  if (plan === 'decouverte') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-slate-400 rounded-full" />
        Offre Découverte — gratuite
      </span>
    )
  }

  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
        Abonnement actif
      </span>
    )
  }
  if (status === 'trial') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-blue-500 rounded-full" />
        Essai gratuit
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-sm font-semibold rounded-full">
      <span className="w-2 h-2 bg-red-500 rounded-full" />
      Expiré
    </span>
  )
}

export default function AbonnementPanel({
  subscriptionStatus, trialEndsAt, subscriptionEndsAt, plan, grandfathered,
  plafondReservations, reservationsCeMois, plafondPrestations, prestationsAuCatalogue,
  doitChoisir,
}: Props) {
  const [now] = useState(() => Date.now())
  // L'annuel est présélectionné : c'est l'offre qu'on met en avant.
  const [billing, setBilling] = useState<BillingCycle>('yearly')

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24)))
    : null

  // Les clients historiques ne sont sur aucune carte de la grille : leur tarif
  // est celui qu'ils paient depuis le début, pas celui de leur clé de plan.
  // Le tarif suit l'offre EFFECTIVE. Il lisait auparavant le drapeau « client
  // historique » lu brut en base : un compte simulé sur Découverte affichait
  // donc « 49€/mois » à côté d'une jauge « 24 / 5 », deux informations qui se
  // contredisaient sur le même écran.
  const currentPrice = grandfathered
    ? PLAN_PRICES[PLAN_HISTORIQUE]
    : PLAN_PRICES[plan] ?? PLAN_PRICES.decouverte

  const owed = subscriptionStatus === 'active' ? 0 : monthsOwed(subscriptionEndsAt, trialEndsAt, new Date(now))
  const dueMonths = Math.max(1, owed)

  // Montant à régler pour une offre : l'année entière si engagement annuel,
  // sinon le mensuel multiplié par les mois éventuellement en retard.
  function amountFor(monthlyPrice: number) {
    return billing === 'yearly' ? yearlyPrice(monthlyPrice) : monthlyPrice * dueMonths
  }


  return (
    <div className="space-y-6">

      {/* Essai terminé : le choix de la formule, posé calmement */}
      {doitChoisir && (
        // Ni rouge ni alarmiste : rien n'est cassé, la page de réservation
        // tourne toujours. Un bandeau d'urgence pour une situation qui n'en est
        // pas une apprend au laveur à ignorer les bandeaux d'urgence.
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
            Votre mois d’essai est terminé — quelle formule vous va ?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Vous n’avez rien perdu : votre page de réservation, votre agenda et vos clients
            sont toujours là. En attendant votre choix, votre compte tourne sur l’offre{' '}
            <strong>Découverte</strong>, gratuite et limitée à{' '}
            <strong>{plafondReservations ?? 5} réservations par mois</strong>.
            Choisissez une formule ci-dessous dès que votre activité le demande.
          </p>
        </div>
      )}

      {/* Statut actuel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Statut actuel</p>
            <StatusBadge status={subscriptionStatus} plan={plan} grandfathered={grandfathered} />
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Tarif</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {currentPrice === 0
                ? 'Gratuit'
                : <>{currentPrice}€<span className="text-sm font-medium text-slate-400">/mois</span></>}
            </p>
          </div>
        </div>

        {subscriptionStatus === 'trial' && daysLeft !== null && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${
            daysLeft <= 7
              ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
              : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          }`}>
            {daysLeft === 0
              ? "Votre essai gratuit a expiré aujourd'hui."
              : `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai gratuit.`}
          </div>
        )}

        {subscriptionStatus === 'active' && (plan !== 'decouverte' || grandfathered) && (
          <div className="mt-4 p-3 rounded-xl text-sm font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            Votre abonnement est actif. Merci de votre confiance !
          </div>
        )}

        {subscriptionStatus === 'expired' && (
          <div className="mt-4 p-3 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            Votre accès est suspendu. Réglez votre abonnement pour retrouver l&apos;accès complet.
          </div>
        )}

        {owed > 1 && (
          <div className="mt-4 p-3 rounded-xl text-sm font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            Vous avez <strong>{owed} mois</strong> de paiement en retard. Merci de régulariser au plus vite pour éviter la suspension de votre page de réservation.
          </div>
        )}
      </div>

      {/* Ce qu'il reste dans l'offre en cours */}
      {(plafondReservations !== null || plafondPrestations !== null) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Votre consommation</h2>
          {plafondReservations !== null && reservationsCeMois !== null && (
            <Jauge
              titre="Réservations ce mois-ci"
              utilise={reservationsCeMois}
              plafond={plafondReservations}
              unite="vos clients ne peuvent plus réserver en ligne jusqu’au 1er du mois prochain."
            />
          )}
          {plafondPrestations !== null && prestationsAuCatalogue !== null && (
            <Jauge
              titre="Prestations au catalogue"
              utilise={prestationsAuCatalogue}
              plafond={plafondPrestations}
              unite="vous ne pouvez plus en ajouter."
            />
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Les réservations se remettent à zéro le 1er de chaque mois. Les rendez-vous annulés ne comptent pas.
          </p>
        </div>
      )}

      {/* Nos offres */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Nos offres</h2>
        {grandfathered ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">
            En tant que client historique, vous avez accès à <strong>toutes les fonctionnalités</strong>{' '}sans changer d&apos;offre. Tout est inclus dans votre plan à{' '}
            {/* Le tarif était écrit en dur : il ne suivait ni la bascule
                mensuel/annuel, ni un changement de prix dans `plan.ts`. */}
            {billing === 'yearly'
              ? `${formatEuros(yearlyMonthlyEquivalent(PLAN_PRICES[PLAN_HISTORIQUE]))}€/mois, soit ${formatEuros(yearlyPrice(PLAN_PRICES[PLAN_HISTORIQUE]))}€/an`
              : `${formatEuros(PLAN_PRICES[PLAN_HISTORIQUE])}€/mois`}.
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choisissez l&apos;offre adaptée à votre activité.</p>
        )}

        <BillingToggle value={billing} onChange={setBilling} className="mb-5" />

        <div className="grid gap-4 sm:grid-cols-2">
          {PLAN_CARDS.map(card => {
            const isCurrent = !grandfathered && plan === card.key
            return (
              <div
                key={card.key}
                className={`rounded-2xl border-2 p-4 flex flex-col ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PLAN_COULEURS[card.key] }}
                      aria-hidden
                    />
                    {card.name}
                  </p>
                  {isCurrent ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-600 text-white">Actuel</span>
                  ) : null}
                </div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-0.5">
                  {card.surDevis ? LIBELLE_CONTACT : card.price === 0 ? 'Gratuit' : (
                    <>
                      {card.from && <span className="text-xs font-medium text-slate-400">dès </span>}
                      {billing === 'yearly' ? formatEuros(yearlyMonthlyEquivalent(card.price)) : card.price}€
                      <span className="text-xs font-medium text-slate-400">/mois</span>
                    </>
                  )}
                </p>
                {/* L'économie annuelle ne s'affiche qu'en vue annuelle. En vue
                    mensuelle, cette ligne verte vendait l'engagement annuel au
                    milieu des tarifs mensuels : le vert du produit signale une
                    économie, il n'a rien à faire là où il n'y en a pas. */}
                {billing === 'yearly' && card.price > 0 && !card.surDevis && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                    Soit {formatEuros(yearlyPrice(card.price))}€/an — {freeMonthsLabel()}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{card.tagline}</p>
                <ul className="space-y-1.5 flex-1 mb-4">
                  {card.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Un client historique a déjà tout : aucune carte ne lui propose
                    de payer quoi que ce soit. L'offre gratuite non plus, pour
                    une raison inverse — il n'y a rien à encaisser. */}
                {/* Chaque carte mène quelque part. Avant, un laveur déjà
                    abonné voyait Starter et Pro SANS AUCUN BOUTON : il cliquait
                    dessus, rien ne se passait, et il en concluait — à raison —
                    que l'écran était cassé. Le panneau supposait qu'un abonné
                    n'a plus rien à acheter ; il a justement à changer. */}
                {grandfathered ? (
                  <span className="block text-center py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                    Inclus dans votre plan
                  </span>
                ) : isCurrent ? (
                  <span className="block text-center py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                    Votre offre actuelle
                  </span>
                ) : card.surDevis ? (
                  // Business ne passe pas par Stripe depuis cet écran : le prix
                  // dépend de la taille de l'équipe, donc il se chiffre après
                  // l'entretien. Placé AVANT les branches de paiement, sinon un
                  // compte en retard de règlement se verrait proposer de payer
                  // un montant qu'on n'a pas encore établi.
                  <a
                    href={lienRendezVousBusiness()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center py-2 rounded-xl text-xs font-bold bg-[#1651E8] hover:bg-[#0F4ACC] text-white transition-colors"
                  >
                    {LIBELLE_RDV_BUSINESS}
                  </a>
                ) : card.price === 0 ? (
                  // L'offre gratuite ne s'achète pas : on y retombe tout seul à
                  // la fin de l'essai, ou on nous écrit pour redescendre.
                  <span className="block text-center py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                    Sans paiement
                  </span>
                ) : (
                  // PayPal sur TOUTE offre payante qui n'est pas la sienne, que
                  // l'abonnement soit actif ou non. Le panneau ne montrait rien
                  // à un abonné déjà actif : il cliquait sur Starter ou Pro et
                  // il ne se passait rien.
                  //
                  // ⚠️ Un abonné qui paie ici règle la nouvelle offre pendant que
                  // l'ancienne court encore : l'activation étant manuelle (voir
                  // la note sous la grille), c'est à ce moment-là qu'on arrête
                  // l'ancienne et qu'on ajuste. Choix assumé — demander d'écrire
                  // avant de payer faisait perdre la vente.
                  <div className="space-y-2">
                    {billing === 'monthly' && dueMonths > 1 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-center">
                        {dueMonths} mois dus — total {card.price * dueMonths}€
                      </p>
                    )}
                    {billing === 'yearly' && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold text-center">
                        12 mois payés en une fois
                      </p>
                    )}
                    <a
                      href={`https://paypal.me/WashBoardSAAS/${amountFor(card.price)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2 bg-[#003087] hover:bg-[#00256b] text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                        <path d="M7.5 3h7.125C17.25 3 19.5 5.25 19.5 7.875c0 3.375-2.625 6-6 6H11.25L10.125 21H6.375L7.5 3z" opacity=".8"/>
                      </svg>
                      PayPal — {formatEuros(amountFor(card.price))}€
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Affichée dès qu'un bouton de paiement existe, et plus seulement
            aux comptes non abonnés : un abonné qui change d'offre paie lui
            aussi ici, et c'est à ce moment qu'il doit lire que l'activation
            passe par nous. */}
        {!grandfathered && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-5">
            Après réception de votre paiement, votre abonnement sera activé manuellement sous 24h ouvrées.
          </p>
        )}
      </div>

      {/* FAQ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Questions fréquentes</h2>
        {[
          { q: 'Comment annuler mon abonnement ?', r: 'Envoyez-nous un email à novaflows.pro@gmail.com. Aucun engagement, résiliation immédiate.' },
          { q: 'Mes données sont-elles conservées si j\'arrête ?', r: 'Oui, vos données (clients, RDV, historique) sont conservées 30 jours après résiliation.' },
          { q: 'Puis-je changer de mode de paiement ?', r: 'Oui, contactez-nous par email à tout moment.' },
          { q: 'Comment changer de plan ?', r: 'Contactez-nous à novaflows.pro@gmail.com et nous l\'activons sous 24h.' },
        ].map(({ q, r }) => (
          <div key={q} className="border-t border-slate-100 dark:border-slate-800 pt-4 first:border-0 first:pt-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{q}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{r}</p>
          </div>
        ))}
      </div>

    </div>
  )
}
