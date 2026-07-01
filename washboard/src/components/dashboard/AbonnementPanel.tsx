'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLAN_CARDS, type Plan } from '@/lib/plan'

type Props = {
  subscriptionStatus: string
  trialEndsAt: string | null
  washerName: string
  washerEmail: string
  plan: Plan
  grandfathered: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  successParam?: boolean
  cancelledParam?: boolean
}

function StatusBadge({ status, cardRegistered }: { status: string; cardRegistered?: boolean }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
        Abonnement actif
      </span>
    )
  }
  if (status === 'trial' && cardRegistered) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
        Carte enregistrée
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
  if (status === 'past_due') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-sm font-semibold rounded-full">
        <span className="w-2 h-2 bg-orange-500 rounded-full" />
        Paiement en attente
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
  subscriptionStatus, trialEndsAt, plan, grandfathered,
  stripeCustomerId, stripeSubscriptionId, successParam, cancelledParam,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24)))
    : null

  const currentPrice   = PLAN_CARDS.find(c => c.key === plan)?.price ?? 49
  const hasStripe      = !!stripeCustomerId
  const cardRegistered = !!stripeSubscriptionId && subscriptionStatus === 'trial'
  const canManage      = hasStripe && (subscriptionStatus === 'active' || subscriptionStatus === 'past_due' || cardRegistered)
  const needsPayment   = !grandfathered && subscriptionStatus !== 'active' && !cardRegistered

  async function startCheckout(planKey: Plan) {
    setLoading(planKey)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  async function openPortal() {
    setLoading('portal')
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Banners retour Stripe */}
      {successParam && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Paiement reçu ! Votre abonnement est en cours d&apos;activation.
          <button onClick={() => router.replace('/dashboard/abonnement')} className="ml-auto text-xs underline opacity-70 hover:opacity-100">Fermer</button>
        </div>
      )}
      {cancelledParam && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Paiement annulé. Vous pouvez réessayer à tout moment.
          <button onClick={() => router.replace('/dashboard/abonnement')} className="ml-auto text-xs underline opacity-70 hover:opacity-100">Fermer</button>
        </div>
      )}

      {/* Statut actuel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Statut actuel</p>
            <StatusBadge status={subscriptionStatus} cardRegistered={cardRegistered} />
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Tarif</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{currentPrice}€<span className="text-sm font-medium text-slate-400">/mois</span></p>
          </div>
        </div>

        {subscriptionStatus === 'trial' && daysLeft !== null && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${
            cardRegistered
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : daysLeft <= 7
              ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
              : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          }`}>
            {cardRegistered
              ? `Votre carte est enregistrée. La facturation de ${currentPrice} €/mois débutera dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}, à la fin de votre essai.`
              : daysLeft === 0
              ? "Votre essai gratuit a expiré aujourd'hui."
              : `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai gratuit.`}
          </div>
        )}

        {subscriptionStatus === 'active' && (
          <div className="mt-4 p-3 rounded-xl text-sm font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            Votre abonnement est actif. Merci de votre confiance !
          </div>
        )}

        {subscriptionStatus === 'past_due' && (
          <div className="mt-4 p-3 rounded-xl text-sm font-medium bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
            Un paiement a échoué. Mettez à jour votre moyen de paiement pour conserver l&apos;accès.
          </div>
        )}

        {subscriptionStatus === 'expired' && (
          <div className="mt-4 p-3 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            Votre accès est suspendu. Réactivez votre abonnement pour retrouver l&apos;accès complet.
          </div>
        )}

        {/* Bouton portail Stripe */}
        {canManage && (
          <button
            onClick={openPortal}
            disabled={loading === 'portal'}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {loading === 'portal' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            )}
            Gérer mon abonnement
          </button>
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
            const isLoading = loading === card.key
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
                ) : needsPayment ? (
                  <div className="space-y-1.5">
                    <button
                      onClick={() => startCheckout(card.key)}
                      disabled={!!loading}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      {isLoading && (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                      )}
                      {isLoading ? 'Redirection…' : isCurrent ? 'Commencer mon abonnement' : `Choisir ${card.name}`}
                    </button>
                    {subscriptionStatus === 'trial' && daysLeft !== null && daysLeft > 0 && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-500 text-center leading-tight">
                        Carte enregistrée maintenant, facturation dans {daysLeft} jour{daysLeft > 1 ? 's' : ''} — à la fin de votre essai.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Questions fréquentes</h2>
        {[
          { q: 'Comment annuler mon abonnement ?', r: 'Cliquez sur « Gérer mon abonnement » pour accéder au portail Stripe. Vous pouvez résilier à tout moment, sans engagement.' },
          { q: 'Mes données sont-elles conservées si j\'arrête ?', r: 'Oui, vos données (clients, RDV, historique) sont conservées 30 jours après résiliation.' },
          { q: 'Comment mettre à jour mon moyen de paiement ?', r: 'Cliquez sur « Gérer mon abonnement » pour accéder au portail Stripe et mettre à jour votre carte bancaire.' },
          { q: 'Le paiement est-il sécurisé ?', r: 'Oui. Les paiements sont traités par Stripe, certifié PCI DSS. WashBoard ne stocke aucune donnée bancaire.' },
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
