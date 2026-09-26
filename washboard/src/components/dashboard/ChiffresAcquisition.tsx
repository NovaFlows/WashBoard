'use client'

import { useMemo } from 'react'
import {
  buildFunnelSummary, countDistinctSessions, buildDeviceBreakdown, buildReferrerBreakdown,
  buildVisitTimingBreakdown, restrictToSessionsReaching, comparePeriods, formatConversionRate,
} from '@/lib/funnelStats'
import { deplacer, formaterJour, libelleComparaison, plageDe, type PeriodeChiffres, type PeriodType } from '@/lib/chiffresPeriode'
import { couvertureEvenements, evenementsDansLaPeriode, serieVisites } from '@/lib/chiffresAcquisition'
import GraphiqueBarres, { type PointBarre } from '@/components/dashboard/GraphiqueBarres'
import type { ChiffresEvent } from '@/components/dashboard/ChiffresV2'

// Onglet « Acquisition » de Chiffres (refonte 2026, passe 5, repris au
// 2026-09-24) — reprend les statistiques de visite de l'ancien CRM
// (`CrmView.tsx`, `/dashboard/crm`), mêmes fonctions pures (`funnelStats.ts`),
// présentation différente.
//
// La période est celle de l'écran (type + jour de référence, flèches
// comprises, choisie dans ChiffresV2) : visiteurs, entonnoir, sources,
// appareils, horaires, comparaison à la période précédente ET graphique des
// visites se recalculent à chaque changement. Les bornes sont celles de Paris
// (`chiffresPeriode.ts`), pas la date locale de la machine.
//
// Données chargées : `chiffres/page.tsx` ne lit les visites que sur les 365
// derniers jours. Une période plus ancienne n'a pas « zéro visite », elle n'a
// pas de donnée : l'écran le dit (« Pas de données avant le… ») au lieu de
// montrer des zéros. Même règle pour la comparaison : on ne compare pas à une
// période précédente qui n'est chargée qu'en partie.
//
// Étape volontairement omise, comme `funnelStats.ts` l'a déjà documenté pour
// tout le CRM : l'étape « Options » n'existe que pour les prestations avec
// options, l'exclure du tunnel principal évite un faux décrochage pour les
// laveurs qui n'en ont pas — d'où 4 lignes dans « Où ils s'arrêtent », pas 5
// comme le dessin de la maquette.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const LABEL_APPAREIL: Record<string, string> = {
  mobile: 'Téléphone', tablet: 'Tablette', desktop: 'Ordinateur', inconnu: 'Inconnu',
}

function titreVisites(type: PeriodType): string {
  switch (type) {
    case 'jour': return 'Visiteurs par heure'
    case 'annee': return 'Visiteurs par mois'
    default: return 'Visiteurs par jour'
  }
}

export default function ChiffresAcquisition({ events, websiteHost, periode, maintenant, evenementsDepuis, evenementsIncomplets }: {
  events: ChiffresEvent[]
  websiteHost?: string
  periode: PeriodeChiffres
  maintenant: number
  /** Début (ISO) de la fenêtre de visites chargée par la page. */
  evenementsDepuis?: string | null
  evenementsIncomplets?: boolean
}) {
  const couverture = couvertureEvenements(periode, evenementsDepuis ?? null)
  const plage = plageDe(periode)

  const stats = useMemo(() => {
    const precedente = deplacer({ type: periode.type, ref: periode.ref }, -1, periode.ref)
    const dansLaPeriode = evenementsDansLaPeriode(events, periode)
    const dansLaPrecedente = evenementsDansLaPeriode(events, precedente)

    const retenus = restrictToSessionsReaching(dansLaPeriode, 'prestation')
    const funnelStats = buildFunnelSummary(retenus)
    const visitorCount = funnelStats.find(s => s.step === 'prestation')?.sessions ?? 0
    const conversionCount = funnelStats.find(s => s.step === 'confirmation')?.sessions ?? 0

    const visitorChange = comparePeriods(
      countDistinctSessions(retenus),
      countDistinctSessions(restrictToSessionsReaching(dansLaPrecedente, 'prestation')),
    )
    // Comparer à une période précédente dont on n'a chargé qu'une partie
    // (ou rien) ferait un « +300 % » qui ne veut rien dire.
    const comparable = couvertureEvenements(precedente, evenementsDepuis ?? null).etat === 'complete'

    // Le plus gros décrochage : la marche la plus haute entre deux étapes
    // consécutives, jamais la première (son "décrochage" vaut toujours 0 par
    // construction — voir buildFunnelSummary).
    let pire: typeof funnelStats[number] | null = null
    for (const s of funnelStats.slice(1)) {
      if (!pire || s.pctDropFromPrevious > pire.pctDropFromPrevious) pire = s
    }
    const pireIndex = pire ? funnelStats.indexOf(pire) : -1

    return {
      funnelStats,
      visitorCount,
      conversionCount,
      visitorChange,
      comparable,
      pire,
      pireAvant: pireIndex > 0 ? funnelStats[pireIndex - 1] : null,
      referrerBreakdown: buildReferrerBreakdown(retenus),
      deviceBreakdown: buildDeviceBreakdown(retenus),
      visitTiming: buildVisitTimingBreakdown(retenus),
      visites: serieVisites(periode, retenus, maintenant),
    }
  }, [events, periode, maintenant, evenementsDepuis])

  const points: PointBarre[] = useMemo(() => stats.visites.map(v => ({
    cle: v.cle,
    label: v.label,
    afficherLabel: v.afficherLabel,
    libelleLong: v.libelleLong,
    valeur: v.visiteurs,
    futur: v.futur,
    courant: v.courant,
  })), [stats.visites])

  const meilleur = points.filter(p => !p.futur).reduce<PointBarre | null>((m, p) => (!m || p.valeur > m.valeur ? p : m), null)
  const resume = `${titreVisites(periode.type)}, ${plage.label}. ${nombre.format(stats.visitorCount)} visiteur${stats.visitorCount > 1 ? 's' : ''}.`
    + (meilleur && meilleur.valeur > 0 ? ` Créneau le plus fréquenté : ${meilleur.libelleLong}, ${nombre.format(meilleur.valeur)}.` : '')
    + ' Flèches gauche et droite pour parcourir les barres.'

  const maxReferrer = stats.referrerBreakdown[0]?.sessions ?? 1

  const aucune = couverture.etat === 'aucune'
  const pct = stats.visitorChange.pct

  return (
    <div className="space-y-5">
      {evenementsIncomplets && (
        <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-ambre)]`} role="status">
          Une partie des visites n’a pas pu être chargée : ces chiffres peuvent être incomplets.
        </p>
      )}

      <div className="flex flex-col gap-[3px]">
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Visiteurs sur votre page</span>
        <span className={`text-[44px] sm:text-[52px] leading-none ${hero}`}>{aucune ? '—' : nombre.format(stats.visitorCount)}</span>
        {aucune ? (
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Pas de données avant le {formaterJour(couverture.depuisJour!)}.
          </span>
        ) : stats.visitorCount === 0 ? (
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune visite sur cette période</span>
        ) : (
          <>
            {stats.comparable && pct !== null && (
              <span className={`text-[13.5px] ${corps}`} style={{ color: pct >= 0 ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)' }}>
                {pct >= 0 ? '+' : ''}{pct} % {libelleComparaison(periode.type)}
              </span>
            )}
            <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {nombre.format(stats.conversionCount)} réservation{stats.conversionCount > 1 ? 's' : ''}, soit {formatConversionRate(stats.conversionCount, stats.visitorCount)} des visiteurs
            </span>
          </>
        )}
        {couverture.etat === 'partielle' && (
          <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-ambre)] mt-1`}>
            Les visites avant le {formaterJour(couverture.depuisJour!)} ne sont pas comptées.
          </span>
        )}
      </div>

      {stats.visitorCount > 0 && (
        <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 py-3.5">
          <GraphiqueBarres
            key={`${periode.type}|${periode.ref}`}
            points={points}
            formaterValeur={v => `${nombre.format(v)} visiteur${v > 1 ? 's' : ''}`}
            resume={resume}
            titreParDefaut={`${titreVisites(periode.type)} · touchez une barre pour lire sa valeur`}
          />
        </div>
      )}

      {stats.visitorCount > 0 && (
        <>
          <div>
            <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>Où ils s’arrêtent</p>
            <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 pt-2 pb-3">
              {stats.funnelStats.map((s, i) => (
                <div key={s.step} className="flex items-center gap-[11px] py-[7px]">
                  <span className={`w-[92px] shrink-0 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{ETAPE_COURTE[s.step]}</span>
                  <span className="flex-1 h-3 rounded-md bg-[color:var(--v2-filet-fort)] flex overflow-hidden">
                    <span
                      className="rounded-md"
                      style={{ width: `${Math.max(s.pctOfFirst, 2)}%`, backgroundColor: i === 0 ? 'var(--v2-color-encre)' : 'var(--v2-color-encre-pale)' }}
                    />
                  </span>
                  <span className={`w-10 shrink-0 text-right text-[13.5px] ${corpsFort} tabular-nums`}>{nombre.format(s.sessions)}</span>
                </div>
              ))}
              {stats.pire && stats.pireAvant && stats.pire.pctDropFromPrevious > 0 && (
                <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed pt-1.5`}>
                  Le plus gros décrochage est entre {ETAPE_COURTE[stats.pireAvant.step].toLowerCase()} et {ETAPE_COURTE[stats.pire.step].toLowerCase()} :{' '}
                  {stats.pire.pctDropFromPrevious} % des visiteurs abandonnent là.
                </p>
              )}
            </div>
          </div>

          {stats.referrerBreakdown.length > 0 && (
            <div>
              <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>D’où ils viennent</p>
              <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 py-2.5">
                {stats.referrerBreakdown.slice(0, 6).map((r, i) => (
                  <div key={r.host} className="flex items-center gap-3 py-[9px]">
                    <span className={`w-[78px] shrink-0 truncate text-[13.5px] ${i === 0 ? corpsFort : corps}`} style={{ color: i === 0 ? 'var(--v2-color-encre)' : 'var(--v2-color-gris)' }}>
                      {r.host === websiteHost ? 'Votre site' : r.host === 'direct' ? 'Direct' : r.host}
                    </span>
                    <span className="flex-1 h-1.5 rounded bg-[color:var(--v2-filet-fort)] flex overflow-hidden">
                      <span className="rounded" style={{ width: `${Math.max((r.sessions / maxReferrer) * 100, 3)}%`, backgroundColor: i === 0 ? 'var(--v2-color-encre)' : 'var(--v2-color-encre-pale)' }} />
                    </span>
                    <span className={`w-[46px] shrink-0 text-right text-[13.5px] ${corpsFort} tabular-nums`}>{nombre.format(r.sessions)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed px-1`}>
            {stats.deviceBreakdown.map(d => `${LABEL_APPAREIL[d.device] ?? d.device} ${d.pct} %`).join(' · ')}
            {stats.visitTiming.topSlot && ` · les visites montent surtout en ${stats.visitTiming.topSlot.toLowerCase()}`}
          </p>
        </>
      )}
    </div>
  )
}

const ETAPE_COURTE: Record<string, string> = {
  prestation: 'Prestation',
  creneau: 'Créneau',
  coordonnees: 'Coordonnées',
  confirmation: 'Confirmation',
  options: 'Options',
}
