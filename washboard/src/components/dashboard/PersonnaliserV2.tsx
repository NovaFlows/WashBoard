'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { WIDGETS, type WidgetKey } from '@/lib/dashboardWidgets'
import { useBloquerDefilement, useGlisserPourFermer } from '@/hooks/useFeuilleTactile'

// « Personnaliser l'accueil », feuille v2 — planche `project/Personnaliser.dc.html`.
// Passe 8 de la refonte 2026, réservée à la PWA installée (elle n'est ouverte
// que par AccueilV2.tsx).
//
// C'est le MÊME réglage que le bouton « Configurer mes widgets » du site : même
// registre (`lib/dashboardWidgets.ts`), même colonne en base
// (`washers.dashboard_widgets`), même route (`PATCH /api/washer`), même
// convention « l'ordre du tableau EST l'ordre d'affichage ». Seule la
// présentation change — d'où un fichier à part plutôt qu'une variante de
// `WidgetsConfigurator.tsx`, qui reste intact pour le site (règle de la
// refonte : v1 identique point pour point).
//
// DEUX ÉCARTS ASSUMÉS PAR RAPPORT À LA PLANCHE :
//
//  1. Des flèches, pas des poignées de glissement. La planche montre des
//     poignées ; le mécanisme réel réordonne par flèches haut/bas, un choix
//     déjà argumenté par Alex et Ryan (le glisser-déposer se manie mal au
//     clavier et jamais aussi bien au doigt qu'à la souris). Écrire un
//     glisser-déposer serait une fonction nouvelle, pas une refonte visuelle.
//  2. La planche liste douze blocs, dont six qui n'existent pas dans le
//     produit (météo, avis Google reçus, devis en attente, factures impayées,
//     créneaux libres de la semaine, tâches). Cette feuille ne montre que les
//     blocs réels — ceux du registre. Un interrupteur qui n'allume rien ne se
//     construit pas.
//
// Le premier bloc de la planche (« Prochain rendez-vous ») est ici une ligne
// d'information, sans interrupteur : dans la PWA, le héros et la journée sont
// l'écran lui-même (voir l'entête d'AccueilV2.tsx). La clé `today` du registre
// continue de piloter le widget du SITE : cette feuille la réécrit donc
// exactement comme elle l'a trouvée, jamais autrement — sans quoi régler son
// accueil dans la PWA modifierait celui du navigateur, sans le dire.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

const SELECTEUR_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Les blocs réglables ici : tout le registre sauf `today` (voir l'entête). */
const REGLABLES = WIDGETS.filter(w => w.key !== 'today')

export default function PersonnaliserV2({ visibles, onClose }: { visibles: WidgetKey[]; onClose: () => void }) {
  const router = useRouter()
  const feuilleRef = useRef<HTMLDivElement>(null)
  useBloquerDefilement()
  const glisser = useGlisserPourFermer(onClose)
  const closeRef = useRef<HTMLButtonElement>(null)
  const focusPrecedent = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  // Position de `today` dans le tableau enregistré, pour le remettre EXACTEMENT
  // où il était : cette feuille ne le montre pas, elle ne doit donc ni le
  // retirer ni le déplacer.
  const indexToday = visibles.indexOf('today')

  // Ordre de départ : d'abord les blocs visibles dans leur ordre enregistré,
  // puis les autres à la suite — même règle que `WidgetsConfigurator`.
  const ordreInitial = useMemo(() => {
    const affiches: WidgetKey[] = visibles.filter(k => k !== 'today')
    const restants = REGLABLES.map(w => w.key).filter(k => !affiches.includes(k))
    return [...affiches, ...restants]
  }, [visibles])

  const [ordre, setOrdre] = useState<WidgetKey[]>(ordreInitial)
  const [coches, setCoches] = useState<Set<WidgetKey>>(() => new Set(visibles.filter(k => k !== 'today')))
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus()
    }
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function basculer(cle: WidgetKey) {
    setCoches(prev => {
      const next = new Set(prev)
      if (next.has(cle)) next.delete(cle)
      else next.add(cle)
      return next
    })
  }

  function deplacer(index: number, sens: -1 | 1) {
    const cible = index + sens
    if (cible < 0 || cible >= ordre.length) return
    setOrdre(prev => {
      const next = [...prev]
      ;[next[index], next[cible]] = [next[cible], next[index]]
      return next
    })
  }

  function toutReafficher() {
    setOrdre(REGLABLES.map(w => w.key))
    setCoches(new Set(REGLABLES.map(w => w.key)))
  }

  async function enregistrer() {
    setEnregistrement(true)
    setErreur(null)
    try {
      const choisis = ordre.filter(k => coches.has(k))
      // `today` retrouve sa place exacte : il n'était pas réglable ici.
      if (indexToday >= 0) choisis.splice(Math.min(indexToday, choisis.length), 0, 'today')
      const res = await fetch('/api/washer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_widgets: choisis }),
      })
      if (!res.ok) {
        setErreur('Enregistrement impossible. Réessayez dans un instant.')
        return
      }
      onClose()
      router.refresh()
    } catch {
      setErreur('Enregistrement impossible. Vérifiez votre connexion.')
    } finally {
      setEnregistrement(false)
    }
  }

  const parCle = new Map(WIDGETS.map(w => [w.key, w]))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Personnaliser l’accueil"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 touch-none bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      />
      <div
        ref={feuilleRef}
        className={`relative flex w-full max-h-[88dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
          visible ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', ...glisser.styleFeuille }}
      >
        {/* Bande du haut (poignée + titre) : zone de tirage pour fermer la feuille. */}
        <div className="shrink-0" {...glisser.poignee}>
<div className="flex justify-center pt-2.5 pb-3 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className={`text-[22px] ${titre}`}>Personnaliser</h2>
            <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Ce qui s’affiche sous vos rendez-vous, et dans quel ordre.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4">
          <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
            <p className={`text-[15px] ${corps}`}>Prochain rendez-vous et journée</p>
            <p className={`mt-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Toujours affichés dans l’application.
            </p>
          </div>

          <div className="mt-5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
            <div className="px-4 divide-y divide-[color:var(--v2-filet)]">
              {ordre.map((cle, index) => {
                const w = parCle.get(cle)
                if (!w) return null
                const coche = coches.has(cle)
                return (
                  <div key={cle} className="flex items-center gap-3 py-2.5">
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => deplacer(index, -1)}
                        disabled={index === 0}
                        aria-label={`Monter ${w.label}`}
                        className="flex h-8 w-10 items-center justify-center text-[color:var(--v2-color-gris)] disabled:opacity-25"
                      >
                        <ChevronUp size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacer(index, 1)}
                        disabled={index === ordre.length - 1}
                        aria-label={`Descendre ${w.label}`}
                        className="flex h-8 w-10 items-center justify-center text-[color:var(--v2-color-gris)] disabled:opacity-25"
                      >
                        <ChevronDown size={16} strokeWidth={2} />
                      </button>
                    </div>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`text-[15px] ${corps} truncate`}>{w.label}</span>
                      <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>{w.description}</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={coche}
                      aria-label={w.label}
                      onClick={() => basculer(cle)}
                      className="flex h-11 w-[46px] shrink-0 items-center justify-center"
                    >
                      <span
                        className="flex h-[28px] w-[46px] items-center rounded-[15px] p-[3px] transition-colors motion-reduce:transition-none"
                        style={{
                          background: coche ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)',
                          justifyContent: coche ? 'flex-end' : 'flex-start',
                          transitionDuration: 'var(--v2-duration-press)',
                          transitionTimingFunction: 'var(--v2-ease-out)',
                        }}
                        aria-hidden
                      >
                        <span className="h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={toutReafficher}
              className={`text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)] min-h-[44px] px-3`}
            >
              Tout réafficher, dans l’ordre d’origine
            </button>
          </div>

          {erreur && (
            <p className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>
              {erreur}
            </p>
          )}
        </div>

        <div
          className="flex gap-2 border-t border-[color:var(--v2-filet)] px-5 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className={`h-11 flex-1 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={enregistrer}
            disabled={enregistrement}
            className={`h-11 flex-1 rounded-[var(--v2-radius-bouton)] text-[14px] ${corpsFort} text-white transition-transform active:scale-[.97] disabled:opacity-50 motion-reduce:transition-none`}
            style={{
              background: 'var(--v2-color-accent)',
              transitionDuration: 'var(--v2-duration-press)',
              transitionTimingFunction: 'var(--v2-ease-out)',
            }}
          >
            {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
