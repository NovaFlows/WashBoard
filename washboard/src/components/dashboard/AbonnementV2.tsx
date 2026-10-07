'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import {
  PLAN_CARDS, PLAN_PRICES, PLAN_LABELS, PLAN_COULEURS, PLAN_HISTORIQUE, monthsOwed,
  freeMonthsLabel, formatEuros, lienRendezVousBusiness, rendezVousExterne, LIBELLE_CONTACT,
  LIBELLE_RDV_BUSINESS, yearlyPrice, yearlyMonthlyEquivalent, type Plan, type BillingCycle,
} from '@/lib/plan'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2 from '@/components/dashboard/ListeReglagesV2'
import type { PropsAbonnement } from '@/components/dashboard/Abonnement'

// « Mon offre », présentation v2 — réservée à la PWA installée (voir
// Abonnement.tsx, le point de branchement ; décision d'Alexandre, 2026-09-22 :
// le site reste v1 sans exception). Même contenu et mêmes montants que
// `AbonnementPanel.tsx`, même logique de calcul — seule la présentation change,
// et rien n'est dupliqué côté `lib/plan.ts`.
//
// La grille tarifaire arrivait dans la PWA telle quelle : cartes blanches,
// bleu #1651E8, ombres portées — l'écran vers lequel mènent TOUS les boutons
// « Changer d'offre » de la refonte était le seul à ne pas lui ressembler
// (relevé par Alexandre le 2026-09-29). D'où cette version.
//
// Ordre voulu, propre au téléphone : ce que je paie aujourd'hui, ce qu'il me
// reste, puis ce que je pourrais prendre. La v1 (ordinateur) peut se permettre
// une grille à deux colonnes ; ici les offres s'empilent, une par écran de
// pouce, la sienne en premier repère visuel.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.18em]'
const CARTE = 'rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]'

/** Un encadré de constat — même rôle que les bandeaux colorés de la v1, en
 *  jetons v2 : un filet de la couleur du ton, jamais un aplat criard. */
function Constat({ ton, children }: { ton: 'accent' | 'vert' | 'ambre' | 'rouge'; children: React.ReactNode }) {
  const couleur = `var(--v2-color-${ton})`
  return (
    <p
      className={`rounded-[var(--v2-radius-carte)] border px-3.5 py-3 text-[13.5px] leading-snug ${corpsFort}`}
      style={{ borderColor: `color-mix(in srgb, ${couleur} 30%, transparent)`, color: couleur }}
    >
      {children}
    </p>
  )
}

/** Une jauge « 3 / 5 » en v2 — même règle de couleur que la jauge d'accueil
 *  (`AccueilV2`) : accent tant qu'il reste de la marge, ambre à la dernière,
 *  rouge une fois dépassée. */
function JaugeV2({ titre: intitule, utilise, plafond, unite }: {
  titre: string
  utilise: number
  plafond: number
  unite: string
}) {
  const part = Math.min(100, Math.round((utilise / plafond) * 100))
  const chaud = utilise >= plafond
  const proche = !chaud && utilise >= plafond - 1
  const couleur = chaud ? 'var(--v2-color-rouge)' : proche ? 'var(--v2-color-ambre)' : 'var(--v2-color-accent)'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-[14px] ${corps}`}>{intitule}</p>
        <p className={`text-[14px] ${corpsFort} tabular-nums`}>
          <span style={{ color: chaud ? couleur : undefined }}>{utilise}</span>
          <span className="text-[color:var(--v2-color-gris)]"> / {plafond}</span>
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--v2-filet)]" aria-hidden>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${part}%`, backgroundColor: couleur }} />
      </div>
      {chaud && (
        <p className={`mt-1.5 text-[12.5px] leading-snug ${corps}`} style={{ color: couleur }}>
          Plafond atteint : {unite}
        </p>
      )}
    </div>
  )
}

export default function AbonnementV2({
  subscriptionStatus, trialEndsAt, subscriptionEndsAt, plan, grandfathered,
  plafondReservations, reservationsCeMois, plafondPrestations, prestationsAuCatalogue,
  remiseAZero, doitChoisir, liste,
}: PropsAbonnement) {
  const grandEcran = useGrandEcran()
  const [maintenant] = useState(() => Date.now())
  // L'annuel est présélectionné : c'est l'offre qu'on met en avant.
  const [facturation, setFacturation] = useState<BillingCycle>('yearly')
  const rdvBusiness = lienRendezVousBusiness()
  const rdvExterne = rendezVousExterne(rdvBusiness)

  const joursRestants = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - maintenant) / 86_400_000))
    : null

  // Le tarif suit l'offre EFFECTIVE, jamais la clé brute en base : un compte
  // historique paie son tarif d'origine, pas celui de son plan affiché.
  const prixActuel = grandfathered
    ? PLAN_PRICES[PLAN_HISTORIQUE]
    : PLAN_PRICES[plan] ?? PLAN_PRICES.decouverte

  const dus = subscriptionStatus === 'active' ? 0 : monthsOwed(subscriptionEndsAt, trialEndsAt, new Date(maintenant))
  const moisDus = Math.max(1, dus)
  const montantPour = (prixMensuel: number) =>
    facturation === 'yearly' ? yearlyPrice(prixMensuel) : prixMensuel * moisDus

  const offreAffichee: Plan = grandfathered ? PLAN_HISTORIQUE : plan
  const etat = grandfathered
    ? { texte: 'Accès complet', ton: 'vert' as const }
    : plan === 'decouverte'
      ? { texte: 'Gratuite, sans paiement', ton: 'gris' as const }
      : subscriptionStatus === 'active'
        ? { texte: 'Abonnement actif', ton: 'vert' as const }
        : subscriptionStatus === 'trial'
          ? { texte: 'Essai gratuit', ton: 'accent' as const }
          : { texte: 'Abonnement expiré', ton: 'rouge' as const }

  const contenu = (
    <div
      className={grandEcran
        ? `space-y-5 text-[color:var(--v2-color-encre)] ${police}`
        : `max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={grandEcran ? `text-[20px] ${titre}` : `text-[21px] ${titre}`}>Mon offre</h1>
        <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Ce que vous payez, ce qu’il vous reste, ce que vous pourriez prendre
        </p>
      </div>

      {/* ── Ce que je paie aujourd'hui : le héros de l'écran ───────────────── */}
      <section className={`${CARTE} px-4 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 ${SURTITRE} text-[color:var(--v2-color-gris)]`}>
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PLAN_COULEURS[offreAffichee] }}
                aria-hidden
              />
              {grandfathered ? 'Client historique' : 'Votre offre'}
            </span>
            <p className={`mt-1 text-[24px] leading-none ${titre}`}>{PLAN_LABELS[offreAffichee]}</p>
            <p
              className={`mt-2 text-[13px] ${corpsFort}`}
              style={{ color: etat.ton === 'gris' ? 'var(--v2-color-gris)' : `var(--v2-color-${etat.ton})` }}
            >
              {etat.texte}
            </p>
          </div>
          <p className={`shrink-0 text-right text-[26px] leading-none ${hero}`}>
            {prixActuel === 0 ? 'Gratuit' : <>{prixActuel} €<span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>par mois</span></>}
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          {doitChoisir && (
            <Constat ton="accent">
              Votre mois d’essai est terminé, et rien n’est perdu : page de réservation, agenda et
              clients sont toujours là. En attendant votre choix, le compte tourne sur Découverte,
              limitée à {plafondReservations ?? 5} réservations par mois.
            </Constat>
          )}
          {subscriptionStatus === 'trial' && joursRestants !== null && (
            <Constat ton={joursRestants <= 7 ? 'ambre' : 'accent'}>
              {joursRestants === 0
                ? 'Votre essai gratuit a expiré aujourd’hui.'
                : `Il vous reste ${joursRestants} jour${joursRestants > 1 ? 's' : ''} d’essai gratuit.`}
            </Constat>
          )}
          {subscriptionStatus === 'active' && (plan !== 'decouverte' || grandfathered) && (
            <Constat ton="vert">Votre abonnement est actif. Merci de votre confiance !</Constat>
          )}
          {subscriptionStatus === 'expired' && (
            <Constat ton="rouge">
              Votre accès est suspendu. Réglez votre abonnement pour retrouver l’accès complet.
            </Constat>
          )}
          {dus > 1 && (
            <Constat ton="ambre">
              {dus} mois de paiement en retard. Régularisez pour éviter la suspension de votre page
              de réservation.
            </Constat>
          )}
        </div>
      </section>

      {/* ── Ce qu'il me reste ──────────────────────────────────────────────── */}
      {(plafondReservations !== null || plafondPrestations !== null) && (
        <section className={`${CARTE} px-4 py-4`}>
          <h2 className={`text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Votre consommation</h2>
          <div className="mt-3 space-y-4">
            {plafondReservations !== null && reservationsCeMois !== null && (
              <JaugeV2
                titre="Réservations ce mois"
                utilise={reservationsCeMois}
                plafond={plafondReservations}
                unite={`vos clients ne peuvent plus réserver en ligne jusqu’au ${remiseAZero}.`}
              />
            )}
            {plafondPrestations !== null && prestationsAuCatalogue !== null && (
              <JaugeV2
                titre="Prestations au catalogue"
                utilise={prestationsAuCatalogue}
                plafond={plafondPrestations}
                unite="vous ne pouvez plus en ajouter."
              />
            )}
          </div>
          <p className={`mt-3 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Les réservations se remettent à zéro le {remiseAZero}, puis tous les mois à cette date.
            Les rendez-vous annulés ne comptent pas.
          </p>
        </section>
      )}

      {/* ── Ce que je pourrais prendre ─────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={`text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Nos offres</h2>
          {/* Bascule mensuel / annuel : mêmes pilules que les onglets des autres
              écrans v2, plutôt que l'interrupteur du site. */}
          <div className="flex gap-1.5" role="tablist" aria-label="Rythme de facturation">
            {([['monthly', 'Mensuel'], ['yearly', 'Annuel']] as const).map(([cle, libelle]) => (
              <button
                key={cle}
                type="button"
                role="tab"
                aria-selected={facturation === cle}
                onClick={() => setFacturation(cle)}
                className={`h-9 shrink-0 rounded-[var(--v2-radius-pilule)] px-3.5 text-[12.5px] ${corpsFort} transition-colors ${
                  facturation === cle
                    ? 'border border-[color:var(--v2-color-encre)] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]'
                    : 'border border-[color:var(--v2-filet-fort)] bg-transparent text-[color:var(--v2-color-gris)]'
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>
        </div>

        {grandfathered && (
          <p className={`mt-2 text-[13px] leading-snug ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>
            Client historique : toutes les fonctionnalités sont incluses, sans changer d’offre —{' '}
            {facturation === 'yearly'
              ? `${formatEuros(yearlyMonthlyEquivalent(PLAN_PRICES[PLAN_HISTORIQUE]))} €/mois, soit ${formatEuros(yearlyPrice(PLAN_PRICES[PLAN_HISTORIQUE]))} €/an`
              : `${formatEuros(PLAN_PRICES[PLAN_HISTORIQUE])} €/mois`}.
          </p>
        )}

        <div className="mt-3 space-y-3">
          {PLAN_CARDS.map(carte => {
            const actuelle = !grandfathered && plan === carte.key
            return (
              <article
                key={carte.key}
                className={`${CARTE} px-4 py-4`}
                style={actuelle ? { borderColor: 'var(--v2-color-accent)' } : undefined}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`flex items-center gap-2 text-[16px] ${nom}`}>
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: PLAN_COULEURS[carte.key] }}
                      aria-hidden
                    />
                    {carte.name}
                  </p>
                  {actuelle && (
                    <span
                      className={`shrink-0 rounded-[var(--v2-radius-pilule)] px-2 py-0.5 text-[11px] ${corpsFort} text-white`}
                      style={{ background: 'var(--v2-color-accent)' }}
                    >
                      Actuelle
                    </span>
                  )}
                </div>

                <p className={`mt-1.5 text-[22px] leading-none ${hero}`}>
                  {carte.surDevis ? (
                    <span className={`text-[16px] ${titre}`}>{LIBELLE_CONTACT}</span>
                  ) : carte.price === 0 ? (
                    'Gratuit'
                  ) : (
                    <>
                      {carte.from && <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>dès </span>}
                      {facturation === 'yearly' ? formatEuros(yearlyMonthlyEquivalent(carte.price)) : carte.price} €
                      <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>/mois</span>
                    </>
                  )}
                </p>

                {facturation === 'yearly' && carte.price > 0 && !carte.surDevis && (
                  <p className={`mt-1 text-[12px] ${corpsFort}`} style={{ color: 'var(--v2-color-vert)' }}>
                    Soit {formatEuros(yearlyPrice(carte.price))} €/an — {freeMonthsLabel()}
                  </p>
                )}

                <p className={`mt-1.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                  {carte.tagline}
                </p>

                <ul className="mt-3 space-y-1.5">
                  {carte.features.map(f => (
                    <li key={f} className={`flex items-start gap-2 text-[13px] leading-snug ${corps}`}>
                      <Check size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: 'var(--v2-color-vert)' }} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {grandfathered ? (
                    <p className={`rounded-[var(--v2-radius-bouton)] py-2.5 text-center text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-vert)', background: 'color-mix(in srgb, var(--v2-color-vert) 10%, transparent)' }}>
                      Inclus dans votre plan
                    </p>
                  ) : actuelle ? (
                    <p className={`rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-filet)] py-2.5 text-center text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                      Votre offre actuelle
                    </p>
                  ) : carte.surDevis ? (
                    <a
                      href={rdvBusiness}
                      {...(rdvExterne ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={`flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] text-[14px] text-white ${corpsFort} transition-transform active:scale-[.98]`}
                      style={{ background: 'var(--v2-color-accent)' }}
                    >
                      {LIBELLE_RDV_BUSINESS}
                    </a>
                  ) : carte.price === 0 ? (
                    <p className={`rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-filet)] py-2.5 text-center text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                      Sans paiement
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {facturation === 'monthly' && moisDus > 1 && (
                        <p className={`text-center text-[12px] ${corpsFort}`} style={{ color: 'var(--v2-color-ambre)' }}>
                          {moisDus} mois dus — total {carte.price * moisDus} €
                        </p>
                      )}
                      {facturation === 'yearly' && (
                        <p className={`text-center text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
                          12 mois payés en une fois
                        </p>
                      )}
                      <a
                        href={`https://paypal.me/WashBoardSAAS/${montantPour(carte.price)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] text-[14px] text-white ${corpsFort} transition-transform active:scale-[.98]`}
                        style={{ background: '#003087' }}
                      >
                        PayPal — {formatEuros(montantPour(carte.price))} €
                      </a>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {!grandfathered && (
          <p className={`mt-4 text-center text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Après réception de votre paiement, votre abonnement est activé à la main sous 24 h ouvrées.
          </p>
        )}
      </section>

      {/* ── Questions fréquentes ───────────────────────────────────────────── */}
      <section className={`${CARTE} overflow-hidden`}>
        <h2 className={`px-4 pt-4 text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Questions fréquentes</h2>
        <div className="mt-1 divide-y divide-[color:var(--v2-filet)]">
          {[
            { q: 'Comment annuler mon abonnement ?', r: 'Écrivez-nous à novaflows.pro@gmail.com. Aucun engagement, résiliation immédiate.' },
            { q: 'Mes données sont-elles conservées si j’arrête ?', r: 'Oui : clients, rendez-vous et historique sont gardés 30 jours après la résiliation.' },
            { q: 'Puis-je changer de mode de paiement ?', r: 'Oui, écrivez-nous à tout moment.' },
            { q: 'Comment changer d’offre ?', r: 'Payez l’offre voulue ci-dessus, ou écrivez-nous : nous l’activons sous 24 h.' },
          ].map(({ q, r }) => (
            <div key={q} className="px-4 py-3">
              <p className={`text-[13.5px] ${corpsFort}`}>{q}</p>
              <p className={`mt-0.5 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{r}</p>
            </div>
          ))}
        </div>
      </section>

      <p className={`text-center text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
        Une question sur les offres ?{' '}
        <Link href="/dashboard/assistance" className={corpsFort} style={{ color: 'var(--v2-color-accent)' }}>
          Écrire à l’équipe
        </Link>
      </p>
    </div>
  )

  if (!grandEcran) return contenu

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="abonnement" />
      </div>
      <div className="min-w-0 max-w-[720px] flex-1">{contenu}</div>
    </div>
  )
}
