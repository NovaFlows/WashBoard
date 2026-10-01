'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PLAN_LABELS, PLAN_PRICES, SERVICE_QUOTA, type Plan } from '@/lib/plan'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'

type PrestationChoisissable = {
  id: string
  name: string
  price: number
  duration_minutes: number
}

// ── Identité WashBoard ──────────────────────────────────────────────────────
// Reprises de la page d'accueil publique. Une fenêtre qui invente ses propres
// couleurs se reconnaît immédiatement comme une pièce rapportée.
const BLEU = '#1651E8'
const BLEU_SOMBRE = '#0F4ACC'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Première offre qui lève le plafond du catalogue. Calculée plutôt qu'écrite
 *  en dur : déplacer le catalogue illimité d'un palier à l'autre ne doit pas
 *  laisser cette fenêtre proposer la mauvaise offre. */
const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const OFFRE_SANS_PLAFOND = OFFRES.find(p => SERVICE_QUOTA[p] === null) ?? 'starter'

/** Aperçu de la page de réservation telle que les clients la voient.
 *
 *  Il fait comprendre en une seconde ce que trois paragraphes peinaient à
 *  expliquer : le laveur n'imagine pas sa page, il la regarde.
 *
 *  Sur fond clair, et volontairement. La version précédente le posait à
 *  l'intérieur d'un bandeau sombre, donc une boîte dans une boîte dans une
 *  carte : trois surfaces empilées, du texte translucide sur du bleu nuit, et
 *  plus rien de net. Ici il n'y a qu'un seul encadré, et il porte le message. */
/** Habillage : tout ce qui change entre le site (v1) et l'application (v2).
 *  Uniquement des classes et des couleurs — jamais une règle de gestion. */
type Habit = { [clef: string]: string }

function ApercuPage({ actives, plafond, habit }: {
  actives: PrestationChoisissable[]
  plafond: number
  habit: Habit
}) {
  return (
    <div className={habit.carteInterne}>
      <p className={`${habit.surtitre} ${habit.petit} px-3.5 py-2.5 border-b border-current/10`}>
        Votre page de réservation
      </p>
      <div className={habit.ligne}>
        {actives.map((svc, i) => {
          const masquee = i >= plafond
          return (
            <div
              key={svc.id}
              className={`flex items-center gap-3 px-3.5 py-2.5 ${masquee ? habit.ligneEteinte : ''}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: masquee ? 'currentColor' : habit.accent, opacity: masquee ? 0.35 : 1 }}
              />
              <span className={`flex-1 truncate text-sm ${masquee ? habit.nomEteint : habit.nom}`}>
                {svc.name}
              </span>
              <span className={`shrink-0 ${masquee ? `${habit.surtitre} ${habit.petit}` : `text-xs ${habit.petit}`}`}>
                {masquee ? 'masquée' : `${svc.price}€`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Fenêtre en deux temps : on explique, puis on propose.
 *
 *  Une seule surface blanche, un seul encadré à l'intérieur. La version
 *  précédente empilait un bandeau bleu nuit haut d'une demi-carte, un encadré
 *  translucide dedans, puis un bloc blanc avec des puces — quatre niveaux de
 *  fond pour trois phrases.
 *
 *  Le bleu de marque ne sert plus de décor : il ne colore que ce qui est actif
 *  ou cliquable. Ce qui est éteint est gris. On lit l'état d'un coup d'œil sans
 *  avoir à déchiffrer une nuance.
 *
 *  Le laveur doit d'abord comprendre que sa page a DÉJÀ changé, sans qu'il
 *  l'ait décidé : « Suivant » devient l'accusé de réception de l'explication.
 *  Mélanger explication et liste à cocher faisait qu'on ne lisait ni l'une ni
 *  l'autre — l'œil tombe sur les cases, coche, et passe.
 *
 *  Et pourquoi le laisser choisir plutôt que d'éteindre les plus récentes : sa
 *  prestation la plus rentable peut être la dernière ajoutée. Choisir au hasard
 *  lui coûterait de l'argent sans qu'il comprenne pourquoi. */
export function ChoixVeilleModal({ actives, plafond, aRanger, offre }: {
  actives: PrestationChoisissable[]
  plafond: number
  aRanger: number
  /** Offre en cours, pour la nommer au lieu de dire « votre offre ». */
  offre: Plan
}) {
  const router = useRouter()
  // Deux habillages, une seule mécanique (voir plus bas, `V`) : dans la PWA la
  // fenêtre monte du bas comme les autres feuilles de la refonte et prend le
  // papier, les filets et la police v2 ; sur le site elle garde exactement la
  // carte blanche centrée d'avant. Alexandre, 2026-09-29 : une fenêtre du site
  // posée par-dessus l'application « n'a rien à voir » avec le reste.
  const isPwa = usePwaStandalone()
  // La fenêtre gère sa propre disparition : le layout la rend sur chaque page,
  // il ne peut pas savoir qu'on vient de la fermer.
  const [ferme, setFerme] = useState(false)
  const [etape, setEtape] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Au-delà du plafond, ce sont les dernières de la liste que la page masque
  // déjà (voir `prestationsAffichees`). On part donc de l'état RÉEL : le laveur
  // n'a rien à faire s'il est d'accord, et tout à changer sinon.
  const masqueesAujourdhui = actives.slice(plafond)
  const [choisies, setChoisies] = useState<string[]>(masqueesAujourdhui.map(s => s.id))

  // Tant que la fenêtre est là, la page derrière ne bouge plus. Sans ça, on
  // croit faire défiler la fenêtre et c'est le tableau de bord qui glisse
  // dessous — la sensation exacte d'une interface qui ne répond pas.
  useEffect(() => {
    if (ferme) return
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = avant }
  }, [ferme])

  const basculer = (id: string) =>
    setChoisies(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const pret = choisies.length === aRanger
  const pluriel = aRanger > 1

  async function reporter() {
    setLoading(true)
    // Le cookie évite qu'elle resurgisse à chaque changement de page : sans
    // lui, « Plus tard » ne durerait que jusqu'au prochain clic dans le menu.
    await fetch('/api/prestations/reporter', { method: 'POST' }).catch(() => {})
    setFerme(true)
  }

  async function confirmer() {
    setError(null)
    setLoading(true)
    // En série : le serveur compte les prestations actives à chaque appel, deux
    // requêtes simultanées liraient le même compte et passeraient toutes les deux.
    for (const id of choisies) {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ en_veille: true }),
      })
      if (!res.ok) {
        const corps = await res.json().catch(() => ({}))
        setError(corps.error ?? 'Impossible de mettre cette prestation en veille')
        setLoading(false)
        return
      }
    }
    setFerme(true)
    // Les pages sont rendues côté serveur : sans ça, les compteurs et la liste
    // des prestations garderaient leur ancienne valeur jusqu'au rechargement.
    router.refresh()
  }

  if (ferme) return null

  // `:active` sur les boutons : un bouton qui ne bouge pas sous le doigt donne
  // l'impression que le clic n'est pas passé. Seuls `transform` et les couleurs
  // sont animés — jamais la géométrie, qui ferait sauter la mise en page.
  const principal = 'px-5 py-3 text-white text-[15px] font-semibold rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
  const secondaire = 'px-4 py-3 text-[15px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-40'

  // ── Les deux habillages, côte à côte ───────────────────────────────────────
  //
  // Un seul arbre JSX, deux jeux de classes : dupliquer 150 lignes de contenu
  // pour changer des couleurs aurait garanti que les deux versions divergent au
  // premier correctif. Ce qui change ici est de la présentation pure — aucune
  // condition ne touche à la logique de choix ni aux appels réseau.
  const POLICE = '[font-family:var(--font-archivo)]'
  const V: Habit = isPwa
    ? {
        voile: 'fixed inset-0 z-50 overflow-y-auto bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px]',
        boite: `mx-auto max-w-md px-3 py-3 min-h-full flex flex-col justify-end sm:justify-center ${POLICE}`,
        carte: 'bg-[color:var(--v2-color-surface)] rounded-[var(--v2-radius-feuille)] border border-[color:var(--v2-filet)] p-5 text-[color:var(--v2-color-encre)]',
        accent: 'var(--v2-color-accent)',
        accentSombre: 'var(--v2-color-accent)',
        inactif: 'var(--v2-filet-fort)',
        surtitre: 'text-[11px] font-black uppercase tracking-[0.18em]',
        titre: 'text-[21px] leading-tight [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]',
        texte: 'text-[14px] leading-snug text-[color:var(--v2-color-gris)]',
        petit: 'text-[12.5px] leading-snug text-[color:var(--v2-color-gris)]',
        carteInterne: 'rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] overflow-hidden',
        ligne: 'divide-y divide-[color:var(--v2-filet)]',
        ligneEteinte: 'bg-[color:var(--v2-filet)]/40',
        choixRetire: 'border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-filet)]/40',
        choixGarde: 'border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]',
        nom: 'text-[15px] [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]',
        nomEteint: 'text-[color:var(--v2-color-gris)] line-through',
        principal: `${principal} rounded-[var(--v2-radius-bouton)]`,
        secondaire: 'px-4 py-3 text-[15px] rounded-[var(--v2-radius-bouton)] text-[color:var(--v2-color-gris)] transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40',
        pied: '-mx-5 -mb-5 mt-5 px-5 py-3.5 border-t border-[color:var(--v2-filet)] rounded-b-[var(--v2-radius-feuille)]',
      }
    : {
        voile: 'fixed inset-0 z-50 overflow-y-auto bg-[#0B1828]/60 backdrop-blur-[2px]',
        boite: 'mx-auto max-w-md px-4 py-4 sm:py-8 min-h-full flex flex-col justify-center',
        carte: 'bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 p-6',
        accent: BLEU,
        accentSombre: BLEU_SOMBRE,
        inactif: '#cbd5e1',
        surtitre: SURTITRE,
        titre: 'text-[22px] font-black tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15] text-balance',
        texte: 'text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed',
        petit: 'text-[13px] text-slate-400 dark:text-slate-500 leading-relaxed',
        carteInterne: 'rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden',
        ligne: 'divide-y divide-slate-100 dark:divide-slate-800',
        ligneEteinte: 'bg-slate-50 dark:bg-slate-800/40',
        choixRetire: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40',
        choixGarde: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
        nom: 'text-[15px] font-semibold text-slate-900 dark:text-slate-100',
        nomEteint: 'text-slate-400 dark:text-slate-500 line-through',
        principal,
        secondaire,
        pied: '-mx-6 -mb-6 mt-5 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl bg-slate-50/60 dark:bg-slate-950/30',
      }

  return (
    // `overflow-y-auto` sur le VOILE, pas sur la carte : si le contenu dépasse
    // l'écran, c'est l'arrière-plan qui défile et la carte garde un seul bloc.
    <div className={V.voile}>
      <div className={V.boite}>
        <div className={V.carte}>

          {/* ── Bandeau : offre + avancement ─────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className={V.surtitre} style={{ color: V.accent }}>Offre {PLAN_LABELS[offre]}</span>
            <span className="flex items-center gap-1.5" aria-label={`Étape ${etape} sur 2`}>
              <span
                className="w-6 h-[3px] rounded-full transition-colors duration-200 ease-out"
                style={{ backgroundColor: etape === 1 ? V.accent : V.inactif }}
              />
              <span
                className="w-6 h-[3px] rounded-full transition-colors duration-200 ease-out"
                style={{ backgroundColor: etape === 2 ? V.accent : V.inactif }}
              />
            </span>
          </div>

          {/* ── Écran 1 : ce qui se passe, et pourquoi ───────────────────── */}
          {etape === 1 && (
            <>
              <h2 className={V.titre}>
                {plafond} prestation{plafond > 1 ? 's' : ''} sur {actives.length} seulement sont en ligne
              </h2>

              <p className={`${V.texte} mt-3`}>
                L’offre <strong>{PLAN_LABELS[offre]}</strong> en
                affiche {plafond} au maximum. Faute de décision de votre part,{' '}
                {masqueesAujourdhui.length > 0 && (
                  <strong>{masqueesAujourdhui.map(s => `« ${s.name} »`).join(', ')}</strong>
                )}{' '}
                {pluriel ? 'ont été masquées' : 'a été masquée'} par défaut.
              </p>

              <div className="mt-5">
                <ApercuPage actives={actives} plafond={plafond} habit={V} />
              </div>

              {/* Dit avant toute décision : c'est la crainte d'effacer qui fait
                  qu'on n'ose pas trancher, et donc qu'on repousse. */}
              <p className={`${V.petit} mt-4`}>
                Rien n’est effacé : vos rendez-vous, vos factures et votre historique restent intacts,
                et une prestation en veille revient dès que vous changez d’offre.
              </p>

              <div className="flex items-center justify-end gap-1 mt-6">
                <button type="button" onClick={reporter} disabled={loading} className={V.secondaire}>
                  Plus tard
                </button>
                <button
                  type="button"
                  onClick={() => setEtape(2)}
                  className={V.principal}
                  style={{ backgroundColor: V.accent }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = V.accentSombre)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = V.accent)}
                >
                  Choisir
                </button>
              </div>

              {/* L'autre issue. N'offrir que la mise en veille reviendrait à
                  faire croire qu'il faut forcément renoncer à quelque chose. */}
              <div className={V.pied}>
                {/* Deux lignes VOULUES plutot qu'une phrase qui deborde : sur
                    un petit telephone, la ligne unique repassait a la ligne et
                    laissait la fleche seule en dessous, ce qui se lit comme un
                    bloc casse. L'espace insecable avant la fleche l'empeche
                    d'etre orpheline quelle que soit la largeur. */}
                <p className={V.petit}>
                  Vous préférez tout garder ?
                </p>
                <Link
                  href="/dashboard/abonnement"
                  className="block text-sm font-bold hover:underline mt-0.5"
                  style={{ color: V.accent }}
                >
                  Offre {PLAN_LABELS[OFFRE_SANS_PLAFOND]} — {PLAN_PRICES[OFFRE_SANS_PLAFOND]}€/mois{' '}→
                </Link>
              </div>
            </>
          )}

          {/* ── Écran 2 : le choix ───────────────────────────────────────── */}
          {etape === 2 && (
            <>
              <h2 className={V.titre}>
                {pluriel ? 'Lesquelles retirer' : 'Laquelle retirer'} de votre page ?
              </h2>
              <p className={`${V.texte} mt-2`}>
                {pluriel ? 'Les prestations déjà masquées sont sélectionnées' : 'La prestation déjà masquée est sélectionnée'}.
                Touchez une autre carte pour changer.
              </p>

              <div className="space-y-2 mt-5">
                {actives.map(svc => {
                  const retiree = choisies.includes(svc.id)
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => basculer(svc.id)}
                      aria-pressed={retiree}
                      className={`w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.99] ${
                        retiree ? V.choixRetire : V.choixGarde
                      }`}
                    >
                      {/* La sélection ÉTEINT au lieu de cocher : la carte
                          choisie se grise et son nom se barre. Le laveur voit le
                          résultat de son clic, pas une case de plus à décoder. */}
                      <span
                        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors duration-150 ease-out ${
                          retiree ? 'border-current/30' : 'border-transparent'
                        }`}
                        style={retiree ? undefined : { backgroundColor: V.accent }}
                      >
                        {!retiree && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block truncate ${retiree ? `${V.nom} ${V.nomEteint}` : V.nom}`}>
                          {svc.name}
                        </span>
                        <span className={`block mt-0.5 ${V.petit}`}>
                          {svc.price}€ · {svc.duration_minutes} min
                        </span>
                      </span>
                      <span className={`shrink-0 ${V.surtitre} ${V.petit}`}>
                        {retiree ? 'retirée' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>

              {error && (
                <p className="text-sm font-medium mt-4" style={{ color: isPwa ? 'var(--v2-color-rouge)' : undefined }}>
                  <span className={isPwa ? '' : 'text-red-600 dark:text-red-400'}>{error}</span>
                </p>
              )}

              <div className="flex items-center justify-between gap-3 mt-6">
                <span className={`text-xs font-bold ${V.petit}`}>
                  {choisies.length} / {aRanger} {pluriel ? 'retirées' : 'retirée'}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setEtape(1)} disabled={loading} className={V.secondaire}>
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={confirmer}
                    disabled={!pret || loading}
                    className={V.principal}
                    style={{ backgroundColor: pret && !loading ? V.accent : V.inactif }}
                  >
                    {loading ? 'Enregistrement…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
