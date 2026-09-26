'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLAN_LABELS, PLAN_PRICES, SERVICE_QUOTA, type Plan } from '@/lib/plan'

/** Ce dont la fenêtre a besoin, et rien de plus : elle affiche un nom, un prix
 *  et une durée. Exiger un `Service` complet obligeait les appelants à charger
 *  des colonnes inutiles, ou à forcer le type — ce qui revient à désactiver la
 *  vérification à l'endroit même où elle sert. */
type PrestationChoisissable = {
  id: string
  name: string
  price: number
  duration_minutes: number
}

// ── Identité WashBoard ──────────────────────────────────────────────────────
// Les mêmes valeurs que la page d'accueil publique : bleu de marque, dégradé
// sombre des cartes mises en avant, surtitres très espacés. Une fenêtre qui
// invente ses propres couleurs se reconnaît immédiatement comme une pièce
// rapportée.
const BLEU = '#1651E8'
const BLEU_SOMBRE = '#0F4ACC'
const FOND_SOMBRE = 'linear-gradient(135deg, #0B1828 0%, #0D2248 55%, #0B1828 100%)'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Première offre qui lève le plafond du catalogue. Calculée plutôt qu'écrite
 *  en dur : déplacer le catalogue illimité d'un palier à l'autre ne doit pas
 *  laisser cette fenêtre proposer la mauvaise offre. */
const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const OFFRE_SANS_PLAFOND = OFFRES.find(p => SERVICE_QUOTA[p] === null) ?? 'starter'

/** Aperçu de la page de réservation telle que les clients la voient.
 *
 *  C'est la pièce qui fait comprendre en une seconde ce que trois paragraphes
 *  peinaient à expliquer : on voit les prestations en ligne, et on voit la
 *  dernière barrée. Le laveur n'a pas à imaginer sa page, il la regarde. */
function ApercuPage({ actives, plafond }: { actives: PrestationChoisissable[]; plafond: number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
      <p className={`${SURTITRE} text-white/40 mb-2.5`}>Votre page de réservation</p>
      <div className="space-y-1.5">
        {actives.map((svc, i) => {
          const masquee = i >= plafond
          return (
            <div
              key={svc.id}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                masquee ? 'bg-white/[0.03] border border-dashed border-white/15' : 'bg-white/10'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${masquee ? 'bg-white/20' : 'bg-[#00C4D4]'}`} />
              <span className={`flex-1 truncate text-xs font-medium ${
                masquee ? 'text-white/30 line-through' : 'text-white/90'
              }`}>
                {svc.name}
              </span>
              <span className={`text-[10px] font-semibold shrink-0 ${masquee ? 'text-white/25' : 'text-white/50'}`}>
                {masquee ? 'masquée' : `${svc.price}€`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Point({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: BLEU }}
      />
      <div>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{titre}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{children}</p>
      </div>
    </div>
  )
}

/** Fenêtre en deux temps : on explique, puis on propose.
 *
 *  Mélanger les deux — l'explication au-dessus d'une liste à cocher — faisait
 *  qu'on ne lisait ni l'une ni l'autre : l'œil tombe sur les cases, coche, et
 *  passe. Le laveur doit d'abord comprendre que sa page a DÉJÀ changé, sans
 *  qu'il l'ait décidé. Le bouton « Suivant » devient l'accusé de réception.
 *
 *  L'écran 1 donne les DEUX issues : retirer une prestation, ou changer
 *  d'offre. N'en présenter qu'une revient à faire croire qu'il faut forcément
 *  renoncer à quelque chose.
 *
 *  Et pourquoi le laisser choisir plutôt que d'éteindre les plus récentes : sa
 *  prestation la plus rentable peut être la dernière ajoutée. Choisir au hasard
 *  lui coûterait de l'argent sans qu'il comprenne pourquoi. */
export function ChoixVeilleModal({ actives, plafond, aRanger, offre, onValider, onFermer, loading, error }: {
  actives: PrestationChoisissable[]
  plafond: number
  aRanger: number
  /** Offre en cours, pour la nommer au lieu de dire « votre offre ». */
  offre: Plan
  onValider: (ids: string[]) => void
  onFermer: () => void
  loading: boolean
  error: string | null
}) {
  const [etape, setEtape] = useState<1 | 2>(1)

  // Au-delà du plafond, ce sont les dernières de la liste que la page masque
  // déjà (voir `prestationsAffichees`). On part donc de l'état RÉEL : le laveur
  // n'a rien à faire s'il est d'accord, et tout à changer sinon.
  const masqueesAujourdhui = actives.slice(plafond)
  const [choisies, setChoisies] = useState<string[]>(masqueesAujourdhui.map(s => s.id))

  const basculer = (id: string) =>
    setChoisies(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const pret = choisies.length === aRanger
  const pluriel = aRanger > 1

  const cadre = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1828]/70 backdrop-blur-sm'
  const boite = 'w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl'
  const principal = 'px-5 py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const secondaire = 'px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40'

  // ── En-tête sombre, commun aux deux écrans ────────────────────────────────
  const enTete = (n: 1 | 2, titre: string, apercu?: React.ReactNode) => (
    <div className="p-6 rounded-t-2xl" style={{ background: FOND_SOMBRE }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className={`${SURTITRE} text-[#00C4D4]`}>Offre {PLAN_LABELS[offre]}</span>
        <span className="flex items-center gap-1.5" aria-label={`Étape ${n} sur 2`}>
          <span className="w-6 h-1 rounded-full" style={{ backgroundColor: n === 1 ? '#00C4D4' : 'rgba(255,255,255,0.2)' }} />
          <span className="w-6 h-1 rounded-full" style={{ backgroundColor: n === 2 ? '#00C4D4' : 'rgba(255,255,255,0.2)' }} />
        </span>
      </div>
      <h2 className="text-2xl font-black tracking-tight text-white leading-[1.1]">{titre}</h2>
      {apercu && <div className="mt-5">{apercu}</div>}
    </div>
  )

  // ── Écran 1 : ce qui se passe, et pourquoi ────────────────────────────────
  if (etape === 1) {
    return (
      <div className={cadre}>
        <div className={boite}>
          {enTete(
            1,
            `${plafond} prestation${plafond > 1 ? 's' : ''} sur ${actives.length} seulement sont en ligne`,
            <ApercuPage actives={actives} plafond={plafond} />,
          )}

          <div className="p-6 space-y-4">
            <Point titre="Pourquoi ?">
              L’offre {PLAN_LABELS[offre]} affiche {plafond} prestation{plafond > 1 ? 's' : ''} au maximum
              sur votre page. Vous en avez {actives.length}.
            </Point>
            <Point titre="Ce n’est pas vous qui avez choisi">
              Faute de décision de votre part,{' '}
              {masqueesAujourdhui.length > 0 && (
                <strong className="text-slate-700 dark:text-slate-200">
                  {masqueesAujourdhui.map(s => `« ${s.name} »`).join(', ')}
                </strong>
              )}{' '}
              {pluriel ? 'ont été masquées' : 'a été masquée'} par défaut. Vous pouvez reprendre la main.
            </Point>
            <Point titre="Rien n’est effacé">
              {/* Dit avant toute décision : c'est la crainte d'effacer qui fait
                  qu'on n'ose pas trancher, et donc qu'on repousse. */}
              Vos rendez-vous, vos factures et l’historique de vos clients restent intacts. Une
              prestation en veille revient dès que vous changez d’offre.
            </Point>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onFermer} className={secondaire}>Plus tard</button>
              <button
                type="button"
                onClick={() => setEtape(2)}
                className={principal}
                style={{ backgroundColor: BLEU }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BLEU_SOMBRE)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = BLEU)}
              >
                Suivant →
              </button>
            </div>
          </div>

          {/* L'autre issue, offerte dès l'explication : c'est là que la question
              « et si je payais ? » se pose naturellement. */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vous préférez garder vos {actives.length} prestations en ligne ?
            </p>
            <Link
              href="/dashboard/abonnement"
              className="inline-block mt-1 text-sm font-bold hover:underline"
              style={{ color: BLEU }}
            >
              Passer à l’offre {PLAN_LABELS[OFFRE_SANS_PLAFOND]} — {PLAN_PRICES[OFFRE_SANS_PLAFOND]}€/mois →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Écran 2 : le choix ────────────────────────────────────────────────────
  return (
    <div className={cadre}>
      <div className={boite}>
        {enTete(2, pluriel ? `Lesquelles retirer de votre page ?` : `Laquelle retirer de votre page ?`)}

        <div className="p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {pluriel ? 'Les prestations déjà masquées sont cochées' : 'La prestation déjà masquée est cochée'}
            {' '}d’avance. Touchez une autre carte pour changer.
          </p>

          <div className="space-y-2 mt-4">
            {actives.map(svc => {
              const retiree = choisies.includes(svc.id)
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => basculer(svc.id)}
                  aria-pressed={retiree}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    retiree
                      ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                  style={retiree ? undefined : { borderColor: BLEU }}
                >
                  {/* La sélection ne « coche » pas, elle ÉTEINT : la carte
                      choisie se grise et son nom se barre. Le laveur voit le
                      résultat de son clic, pas une case de plus à interpréter. */}
                  <span
                    className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 ${
                      retiree ? 'border-slate-300 dark:border-slate-600' : 'border-transparent'
                    }`}
                    style={retiree ? undefined : { backgroundColor: BLEU }}
                  >
                    {!retiree && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-bold truncate ${
                      retiree ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'
                    }`}>
                      {svc.name}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {svc.price}€ · {svc.duration_minutes} min
                    </span>
                  </span>
                  <span className={`shrink-0 ${SURTITRE} ${
                    retiree ? 'text-slate-400 dark:text-slate-500' : ''
                  }`} style={retiree ? undefined : { color: BLEU }}>
                    {retiree ? 'retirée' : 'en ligne'}
                  </span>
                </button>
              )
            })}
          </div>

          {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-4">{error}</p>}

          <div className="flex items-center justify-between gap-3 mt-6">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
              {choisies.length} / {aRanger} {pluriel ? 'retirées' : 'retirée'}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEtape(1)} disabled={loading} className={secondaire}>
                ← Retour
              </button>
              <button
                type="button"
                onClick={() => onValider(choisies)}
                disabled={!pret || loading}
                className={principal}
                style={{ backgroundColor: pret && !loading ? BLEU : undefined }}
              >
                {loading ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
