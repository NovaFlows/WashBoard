'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  contientAujourdhui, deplacer, plageDe,
  type PeriodeChiffres, type PeriodType,
} from '@/lib/chiffresPeriode'

// Sélecteur de période de l'écran Chiffres (refonte 2026), commun aux trois
// onglets : le type (Jour · Semaine · Mois · Année) et les flèches
// précédent/suivant. La période vit dans ChiffresV2, pas ici — elle survit au
// changement d'onglet. Réservé à la PWA installée (monté par ChiffresV2 seul).
//
// « Suivant » est désactivé quand la période contient aujourd'hui : il n'y a
// rien à lire dans le futur. Toutes les cibles font 44 px de haut, les flèches
// 44 × 44.

const police = '[font-family:var(--font-archivo)]'
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`

const TYPES: { cle: PeriodType; libelle: string }[] = [
  { cle: 'jour', libelle: 'Jour' },
  { cle: 'semaine', libelle: 'Semaine' },
  { cle: 'mois', libelle: 'Mois' },
  { cle: 'annee', libelle: 'Année' },
]

type Props = {
  periode: PeriodeChiffres
  aujourdhui: string
  onChange: (p: PeriodeChiffres) => void
}

export default function SelecteurPeriodeV2({ periode, aujourdhui, onChange }: Props) {
  const { label } = plageDe(periode)
  const surAujourdhui = contientAujourdhui(periode, aujourdhui)

  return (
    <div className="space-y-1">
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Période">
        {TYPES.map(t => (
          <button
            key={t.cle}
            type="button"
            aria-pressed={periode.type === t.cle}
            onClick={() => onChange({ type: t.cle, ref: periode.ref })}
            className={`shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} transition-colors ${
              periode.type === t.cle
                ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border border-[color:var(--v2-color-encre)]'
                : 'bg-transparent text-[color:var(--v2-color-gris)] border border-[color:var(--v2-filet-fort)]'
            }`}
          >
            {t.libelle}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(deplacer(periode, -1, aujourdhui))}
          aria-label="Période précédente"
          className="h-11 w-11 -ml-2.5 flex items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden />
        </button>
        <span
          className={`min-w-0 truncate text-[15px] ${corpsFort} tabular-nums first-letter:uppercase`}
          aria-live="polite"
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange(deplacer(periode, 1, aujourdhui))}
          disabled={surAujourdhui}
          aria-label="Période suivante"
          className="h-11 w-11 -mr-2.5 flex items-center justify-center text-[color:var(--v2-color-encre)] disabled:text-[color:var(--v2-color-encre-pale)]"
        >
          <ChevronRight size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  )
}
