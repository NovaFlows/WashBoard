'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// Graphique en barres de l'écran Chiffres (refonte 2026), commun aux onglets
// Argent (résultat par créneau) et Acquisition (visiteurs par créneau).
// Réservé à la PWA installée : il n'est monté que par ChiffresV2.
//
// Lisibilité : sur un mois, 30 barres font 10 px de large — impossible à
// viser au doigt une par une. Toute la zone du graphique est donc UNE cible :
// on pose le doigt (ou on le glisse) et la barre la plus proche s'allume, sa
// date et sa valeur s'écrivent au-dessus, comme dans Apple Santé. Au clavier :
// flèches, Début, Fin, Échap.
//
// Valeurs négatives : la ligne de zéro monte quand il y en a. Une perte
// descend sous la ligne ET passe au rouge — la couleur seule ne suffirait pas
// à un daltonien, le sens de la barre porte déjà l'information.
//
// Mouvement : chaque barre pousse depuis la ligne de zéro (classe `.v2-barre`
// de globals.css, coupée sous `prefers-reduced-motion`). Le parent change de
// `key` quand la période change : le graphique se remonte, les barres
// repoussent.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`

export type PointBarre = {
  cle: string
  /** Libellé court sous la barre. */
  label: string
  /** L'écrire ou non : un libellé sur cinq suffit quand les barres sont fines. */
  afficherLabel: boolean
  /** Libellé complet, lu quand on touche la barre. */
  libelleLong: string
  valeur: number
  /** Ligne secondaire lue au toucher (« Encaissé 180 € · Dépensé 60 € »). */
  detail?: string
  /** Créneau qui n'a pas encore eu lieu : pas de barre, « à venir ». */
  futur?: boolean
  /** Créneau en cours : mis en avant tant qu'on ne touche rien. */
  courant?: boolean
}

type Props = {
  points: PointBarre[]
  formaterValeur: (v: number) => string
  /** Résumé lu par un lecteur d'écran (le graphique lui-même est visuel). */
  resume: string
  /** Ce qu'on lit au-dessus tant qu'aucune barre n'est touchée. */
  titreParDefaut: string
  hauteur?: number
}

const clamp = (i: number, n: number) => Math.max(0, Math.min(n - 1, i))

export default function GraphiqueBarres({ points, formaterValeur, resume, titreParDefaut, hauteur = 112 }: Props) {
  const n = points.length
  const [choisi, setChoisi] = useState<number | null>(null)
  const zone = useRef<HTMLDivElement>(null)

  const indexCourant = points.findIndex(p => p.courant)
  const mis = choisi ?? (indexCourant >= 0 ? indexCourant : null)

  // Échelle : la ligne de zéro se place selon la part de valeurs positives et
  // négatives. Sans aucune valeur négative, elle reste tout en bas.
  const maxPos = Math.max(0, ...points.filter(p => !p.futur).map(p => p.valeur))
  const maxNeg = Math.max(0, ...points.filter(p => !p.futur).map(p => -p.valeur))
  const echelle = Math.max(maxPos + maxNeg, 1)
  const hPos = maxNeg === 0 ? hauteur : Math.round((maxPos / echelle) * hauteur)
  const hNeg = hauteur - hPos
  const gouttiere = n <= 12 ? 6 : n <= 24 ? 3 : 2
  const rayon = n <= 12 ? 5 : 3

  const indexDepuis = (clientX: number): number => {
    const r = zone.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    return clamp(Math.floor(((clientX - r.left) / r.width) * n), n)
  }

  const surAppui = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexDepuis(e.clientX)
    // Retoucher la barre déjà allumée l'éteint (au doigt, il n'y a pas de
    // « sortie de la souris » pour le faire).
    setChoisi(e.pointerType !== 'mouse' && choisi === i ? null : i)
  }
  const surDeplacement = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || e.buttons === 1) setChoisi(indexDepuis(e.clientX))
  }
  const surSortie = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setChoisi(null)
  }
  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    const depart = choisi ?? (indexCourant >= 0 ? indexCourant : n - 1)
    switch (e.key) {
      case 'ArrowLeft': setChoisi(clamp(depart - 1, n)); break
      case 'ArrowRight': setChoisi(clamp(depart + 1, n)); break
      case 'Home': setChoisi(0); break
      case 'End': setChoisi(n - 1); break
      case 'Escape': setChoisi(null); return
      default: return
    }
    e.preventDefault()
  }

  const lu = choisi !== null ? points[choisi] : null

  return (
    <div>
      <div className="min-h-[44px] flex flex-col justify-center gap-0.5" aria-live="polite" aria-atomic="true">
        {lu ? (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className={`text-[13.5px] ${corpsFort} min-w-0 truncate first-letter:uppercase`}>{lu.libelleLong}</span>
              <span
                className={`text-[15px] ${corpsFort} tabular-nums shrink-0`}
                style={lu.valeur < 0 && !lu.futur ? { color: 'var(--v2-color-rouge)' } : undefined}
              >
                {lu.futur ? 'À venir' : formaterValeur(lu.valeur)}
              </span>
            </span>
            {lu.detail && !lu.futur && (
              <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{lu.detail}</span>
            )}
          </>
        ) : (
          <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{titreParDefaut}</span>
        )}
      </div>

      <div
        ref={zone}
        role="group"
        aria-label={resume}
        tabIndex={0}
        onPointerDown={surAppui}
        onPointerMove={surDeplacement}
        onPointerLeave={surSortie}
        onKeyDown={surTouche}
        onBlur={() => setChoisi(null)}
        className="relative flex touch-pan-y select-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--v2-color-accent)]"
        style={{ height: hauteur, gap: gouttiere }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 h-px bg-[color:var(--v2-filet-fort)] pointer-events-none"
          style={{ bottom: hNeg }}
        />
        {points.map((pt, i) => {
          const negatif = pt.valeur < 0
          const nul = pt.valeur === 0 || pt.futur
          const h = nul ? 2 : Math.max(3, Math.round((Math.abs(pt.valeur) / echelle) * hauteur))
          // Trois tons : une barre touchée (ou, sans toucher, le créneau en
          // cours) est pleine ; les autres restent lisibles (60 %) tant qu'on
          // ne touche rien, et s'effacent (30 %) pendant qu'on en lit une.
          const plein = mis === i
          const ton = plein ? 100 : choisi !== null ? 30 : 60
          const fond = nul
            ? 'var(--v2-filet-fort)'
            : `color-mix(in srgb, var(${negatif ? '--v2-color-rouge' : '--v2-color-encre'}) ${ton}%, transparent)`
          return (
            <div key={pt.cle} className="relative flex-1 h-full pointer-events-none">
              <span
                className="v2-barre absolute inset-x-0"
                style={{
                  height: h,
                  backgroundColor: fond,
                  ...(negatif && !nul
                    ? { top: hPos, borderRadius: `0 0 ${rayon}px ${rayon}px`, transformOrigin: 'top' }
                    : { bottom: hNeg, borderRadius: `${rayon}px ${rayon}px 0 0`, transformOrigin: 'bottom' }),
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="flex mt-2" style={{ gap: gouttiere }} aria-hidden>
        {points.map((pt, i) => (
          <div key={pt.cle} className="relative flex-1 h-4">
            {pt.afficherLabel && (
              <span
                className={`absolute left-1/2 -translate-x-1/2 text-[11px] ${corpsFort} whitespace-nowrap`}
                style={{ color: mis === i ? 'var(--v2-color-encre)' : 'var(--v2-color-gris)' }}
              >
                {pt.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
