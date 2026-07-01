'use client'

import { useState } from 'react'
import { PLAN_CARDS, type Plan } from '@/lib/plan'

type Props = {
  subscriptionStatus: string
  trialEndsAt: string | null
  washerName: string
  washerEmail: string
  plan: Plan
  grandfathered: boolean
}

const PRICE = 49

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

export default function AbonnementPanel({ subscriptionStatus, trialEndsAt, washerName, washerEmail, plan, grandfathered }: Props) {
  const [now] = useState(() => Date.now())
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24)))
    : null

  const virementSubject = encodeURIComponent(`Abonnement WashBoard — ${washerName}`)
  const virementBody = encodeURIComponent(
    `Bonjour,\n\nJe souhaite activer mon abonnement WashBoard (49€/mois) pour l'espace "${washerName}".\n\nEmail du compte : ${washerEmail}\n\nMerci de me confirmer les coordonnées bancaires pour effectuer le virement.\n\nCordialement,\n${washerName}`
  )
  const virementHref = `https://mail.google.com/mail/?view=cm&to=novaflows.pro@gmail.com&su=${virementSubject}&body=${virementBody}`

  const paypalHref = `https://paypal.me/WashBoardSAAS/${PRICE}`

  const currentPrice = PLAN_CARDS.find(c => c.key === plan)?.price ?? PRICE

  function upgradeHref(target: typeof PLAN_CARDS[number]) {
    const su = encodeURIComponent(`Passage au plan ${target.name} — ${washerName}`)
    const body = encodeURIComponent(
      `Bonjour,\n\nJe souhaite passer au plan ${target.name} (${target.price}€/mois) pour l'espace "${washerName}".\n\nEmail du compte : ${washerEmail}\n\nMerci.`
    )
    return `https://mail.google.com/mail/?view=cm&to=novaflows.pro@gmail.com&su=${su}&body=${body}`
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
              ? 'Votre essai gratuit a expiré aujourd\'hui.'
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
      </div>

      {/* Nos offres */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Nos offres</h2>
        {grandfathered ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">
            En tant que client historique, vous avez accès à <strong>toutes les fonctionnalités</strong> sans changer d&apos;offre.
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choisissez l&apos;offre adaptée à votre activité.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
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
                  ) : card.comingSoon ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">Bientôt</span>
                  ) : null}
                </div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-0.5">
                  {card.price}€<span className="text-xs font-medium text-slate-400">/mois</span>
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
                {card.comingSoon ? (
                  <span className="block text-center py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed">
                    En cours de développement
                  </span>
                ) : !isCurrent && !grandfathered ? (
                  <a
                    href={upgradeHref(card)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    Choisir {card.name}
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-4">
          Changement d&apos;offre activé manuellement sous 24h après votre demande.
        </p>
      </div>

      {/* Options de paiement */}
      {subscriptionStatus !== 'active' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Activer mon abonnement</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Choisissez votre mode de paiement. Votre abonnement sera activé sous 24h après confirmation.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* PayPal */}
            <a
              href={paypalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-[#003087] dark:border-[#009cde] hover:bg-[#f5f8ff] dark:hover:bg-[#003087]/20 transition-colors text-center group"
            >
              <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none">
                <path d="M7.5 3h7.125C17.25 3 19.5 5.25 19.5 7.875c0 3.375-2.625 6-6 6H11.25L10.125 21H6.375L7.5 3z" fill="#009cde"/>
                <path d="M6 6h7.125c2.625 0 4.875 2.25 4.875 4.875 0 3.375-2.625 6-6 6H9.75L8.625 24H4.875L6 6z" fill="#003087" opacity="0.7"/>
              </svg>
              <div>
                <p className="font-bold text-[#003087] dark:text-[#009cde] text-base">Payer par PayPal</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{PRICE}€ · Paiement sécurisé</p>
              </div>
              <span className="mt-1 px-4 py-2 bg-[#003087] dark:bg-[#009cde] text-white text-sm font-bold rounded-xl group-hover:opacity-90 transition-opacity">
                Payer {PRICE}€ →
              </span>
            </a>

            {/* Virement bancaire */}
            <a
              href={virementHref}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-center group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-base">Virement bancaire</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Envoyez une demande par email</p>
              </div>
              <span className="mt-1 px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white text-sm font-bold rounded-xl group-hover:opacity-90 transition-opacity">
                Faire une demande →
              </span>
            </a>

          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-5">
            Après réception de votre paiement, votre abonnement sera activé manuellement sous 24h ouvrées.
          </p>
        </div>
      )}

      {/* FAQ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Questions fréquentes</h2>
        {[
          { q: 'Comment annuler mon abonnement ?', r: 'Contactez-nous sur WhatsApp au 06 84 14 04 38. Aucun engagement, résiliation immédiate.' },
          { q: 'Mes données sont-elles conservées si j\'arrête ?', r: 'Oui, vos données (clients, RDV, historique) sont conservées 30 jours après résiliation.' },
          { q: 'Puis-je changer de mode de paiement ?', r: 'Oui, écrivez-nous sur WhatsApp au 06 84 14 04 38 à tout moment.' },
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
