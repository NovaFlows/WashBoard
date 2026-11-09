'use client'

import Link from 'next/link'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Chevron } from '@/components/dashboard/ParametresFormV2'
import { nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { SANS_RESPONSABLE, slugMembre, type ResumeMembre } from '@/lib/espaceEquipe'
import { Initiales } from './EcranEquipe'

// Les membres de l'équipe, en tête de l'accueil Équipe (2026-11-09) : un clic ouvre ses
// laveurs et ses prospects. Cartes sur ordinateur, liste sur téléphone.

const GRIS = `${corps} text-[color:var(--v2-color-gris)]`
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

function nomDe(r: ResumeMembre) { return r.membre === SANS_RESPONSABLE ? 'À répartir' : r.membre }
/** Pastille : les initiales du prénom, un « ? » pour ceux que personne ne suit. */
const pastille = (r: ResumeMembre) => (r.membre === SANS_RESPONSABLE ? '' : r.membre)

/** « 3 laveurs · 5 prospects », puis ce qui l'attend. */
function resume(r: ResumeMembre): string {
  return `${pluriel(r.laveurs, 'laveur', 'laveurs')} · ${pluriel(r.prospects, 'prospect', 'prospects')}`
}
function attente(r: ResumeMembre): string | null {
  const morceaux = [r.aRappeler ? `${r.aRappeler} à rappeler` : null, r.aTrier ? `${pluriel(r.aTrier, 'réponse', 'réponses')} à trier` : null].filter(Boolean)
  return morceaux.length ? morceaux.join(' · ') : null
}

export default function CartesEquipe({ equipe }: { equipe: ResumeMembre[] }) {
  const grandEcran = useGrandEcran()
  const lien = (r: ResumeMembre) => `/dashboard/support/equipe/${slugMembre(r.membre)}`

  if (grandEcran) {
    return (
      <div className={`grid gap-4 ${equipe.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {equipe.map(r => (
          <Link key={r.membre} href={lien(r)} className="flex items-center gap-3.5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-5 py-4 hover:bg-[color:var(--v2-filet)]/50">
            <Initiales nom={pastille(r)} taille={46} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[17px] ${styleNom}`}>{nomDe(r)}</span>
              <span className={`mt-0.5 block truncate text-[13px] ${GRIS}`}>{resume(r)}</span>
              <span className={`mt-0.5 block min-h-[18px] truncate text-[12.5px] ${attente(r) ? corpsFort : GRIS}`}>{attente(r) ?? 'Rien en attente'}</span>
            </span>
            <Chevron />
          </Link>
        ))}
      </div>
    )
  }

  return (
    <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]">
      {equipe.map(r => (
        <li key={r.membre}>
          <Link href={lien(r)} className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--v2-filet)]/50">
            <Initiales nom={pastille(r)} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[16px] ${styleNom}`}>{nomDe(r)}</span>
              <span className={`mt-0.5 block truncate text-[12.5px] ${GRIS}`}>{resume(r)}</span>
              {attente(r) && <span className={`mt-0.5 block truncate text-[12.5px] ${corpsFort}`}>{attente(r)}</span>}
            </span>
            <Chevron />
          </Link>
        </li>
      ))}
    </ul>
  )
}
