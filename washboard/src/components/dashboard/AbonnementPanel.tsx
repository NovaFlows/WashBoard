'use client'

import { useState } from 'react'
import {
  PLAN_CARDS, monthsOwed, YEARLY_FREE_MONTHS, formatEuros, yearlyPrice,
  yearlyMonthlyEquivalent, type Plan, type BillingCycle,
} from '@/lib/plan'
import BillingToggle from '@/components/ui/BillingToggle'

type Props = {
  subscriptionStatus: string
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  washerName: string
  washerEmail: string
  plan: Plan
  grandfathered: boolean
}

function StatusBadge({ status }: { status: string }) {
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

export default function AbonnementPanel({ subscriptionStatus, trialEndsAt, subscriptionEndsAt, washerName, washerEmail, plan, grandfathered }: Props) {
  const [now] = useState(() => Date.now())
  // L'annuel est présélectionné : c'est l'offre qu'on met en avant.
  const [billing, setBilling] = useState<BillingCycle>('yearly')

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24)))
    : null

  const currentPrice = PLAN_CARDS.find(c => c.key === plan)?.price ?? 49

  const owed = subscriptionStatus === 'active' ? 0 : monthsOwed(subscriptionEndsAt, trialEndsAt, new Date(now))
  const dueMonths = Math.max(1, owed)

  // Montant à régler pour une offre : l'année entière si engagement annuel,
  // sinon le mensuel multiplié par les mois éventuellement en retard.
  function amountFor(monthlyPrice: number) {
    return billing === 'yearly' ? yearlyPrice(monthlyPrice) : monthlyPrice * dueMonths
  }

  function virementHref(planName: string, monthlyPrice: number) {
    const total = amountFor(monthlyPrice)
    const cycleLabel = billing === 'yearly'
      ? `${formatEuros(yearlyPrice(monthlyPrice))}€/an, soit ${formatEuros(yearlyMonthlyEquivalent(monthlyPrice))}€/mois`
      : `${monthlyPrice}€/mois`
    const monthsNote = billing === 'monthly' && dueMonths > 1 ? ` (${dueMonths} mois à régulariser)` : ''
    const subject = encodeURIComponent(`Abonnement WashBoard ${planName} — ${washerName}`)
    const body = encodeURIComponent(
      `Bonjour,\n\nJe souhaite activer mon abonnement WashBoard ${planName} (${cycleLabel}) pour l'espace "${washerName}".\nMontant à régler : ${formatEuros(total)}€${monthsNote}\n\nEmail du compte : ${washerEmail}\n\nMerci de me confirmer les coordonnées bancaires pour effectuer le virement.\n\nCordialement,\n${washerName}`
    )
    return `mailto:novaflows.pro@gmail.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="space-y-6">

      {/* Statut actuel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Statut actuel</p>
            <StatusBadge status={subscriptionStatus} />
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Tarif</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{currentPrice}€<span className="text-sm font-medium text-slate-400">/mois</span></p>
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

        {subscriptionStatus === 'active' && (
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

      {/* Nos offres */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Nos offres</h2>
        {grandfathered ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">
            En tant que client historique, vous avez accès à <strong>toutes les fonctionnalités</strong>{' '}sans changer d&apos;offre. Tout est inclus dans votre plan à 49€/mois.
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
                  <p className="font-bold text-slate-900 dark:text-slate-100">{card.name}</p>
                  {isCurrent ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-600 text-white">Actuel</span>
                  ) : null}
                </div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-0.5">
                  {billing === 'yearly' ? formatEuros(yearlyMonthlyEquivalent(card.price)) : card.price}€
                  <span className="text-xs font-medium text-slate-400">/mois</span>
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  {billing === 'yearly'
                    ? `Soit ${formatEuros(yearlyPrice(card.price))}€/an — ${YEARLY_FREE_MONTHS} mois offerts`
                    : `En annuel : ${formatEuros(yearlyMonthlyEquivalent(card.price))}€/mois`}
                </p>
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

                {grandfathered && card.key !== 'essentiel' ? (
                  <span className="block text-center py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                    Inclus dans votre plan
                  </span>
                ) : subscriptionStatus !== 'active' ? (
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
                    <a
                      href={virementHref(card.name, card.price)}
                      className="flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                    >
                      Virement bancaire
                    </a>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {subscriptionStatus !== 'active' && (
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
