'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CHAMP, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { Chevron } from '@/components/dashboard/ParametresFormV2'
import { ilYa } from '@/lib/ficheLaveur'
import type { LaveurResume } from '@/lib/resumeLaveurs'
import EcranEquipe, { Initiales, Point } from './EcranEquipe'

export type { LaveurResume }

export type Filtre = 'tous' | 'rappeler' | 'nouveaux' | 'configurer' | 'essai'

const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: 'tous', label: 'Tous' },
  { cle: 'rappeler', label: 'À rappeler' },
  { cle: 'nouveaux', label: 'Nouveaux' },
  { cle: 'configurer', label: 'Page à faire' },
  { cle: 'essai', label: 'En essai' },
]

const SEMAINE_MS = 7 * 864e5
const TON_POINT = { ok: 'vert', attention: 'ambre', alerte: 'rouge', neutre: 'gris' } as const

function garde(l: LaveurResume, filtre: Filtre, maintenant: number): boolean {
  switch (filtre) {
    case 'rappeler': return !!l.relance
    case 'nouveaux': return maintenant - Date.parse(l.creeLe) < SEMAINE_MS
    case 'configurer': return !l.pagePrete
    case 'essai': return l.enEssai
    default: return true
  }
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function ListeLaveursV2({ laveurs, filtreInitial, maintenant }: { laveurs: LaveurResume[]; filtreInitial: Filtre; maintenant: number }) {
  const [filtre, setFiltre] = useState<Filtre>(filtreInitial)
  const [recherche, setRecherche] = useState('')
  const now = useMemo(() => new Date(maintenant), [maintenant])

  const visibles = useMemo(() => {
    const q = sansAccents(recherche.trim())
    const chiffres = recherche.replace(/\D/g, '')
    const liste = laveurs.filter(l => garde(l, filtre, maintenant) && (!q
      || sansAccents(l.name).includes(q) || l.slug.includes(q)
      || (chiffres.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(chiffres))))
    // « À rappeler » : la relance la plus ancienne d'abord. Sinon, les derniers inscrits.
    return filtre === 'rappeler'
      ? liste.sort((a, b) => a.relance!.le.localeCompare(b.relance!.le))
      : liste
  }, [laveurs, filtre, recherche, maintenant])

  const compte = (f: Filtre) => laveurs.filter(l => garde(l, f, maintenant)).length

  return (
    <EcranEquipe titre="Laveurs" sousTitre={`${laveurs.length} comptes, comptes de test exclus`} retour={{ href: '/dashboard/support', label: 'Équipe' }}>
      <div className="space-y-3">
        <input
          type="search" inputMode="search" value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder="Nom, téléphone, lien" aria-label="Rechercher un laveur" className={CHAMP}
        />
        <div className="-mx-3 sm:mx-0 px-3 sm:px-0 flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filtrer">
          {FILTRES.map(f => (
            <button key={f.cle} type="button" aria-pressed={filtre === f.cle} onClick={() => setFiltre(f.cle)} className={puce(filtre === f.cle)}>
              {f.label}{f.cle !== 'tous' ? ` ${compte(f.cle)}` : ''}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className={`py-6 text-center text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>
          {filtre === 'rappeler' ? 'Aucune relance due. Ajoutez un laveur avec le bouton « À rappeler » de sa fiche, ou fixez une relance en notant un appel.' : 'Aucun laveur ne correspond.'}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]">
          {visibles.map(l => (
            <li key={l.id}>
              <Link href={`/dashboard/support/laveurs/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--v2-filet)]/50">
                <Initiales nom={l.name} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-[15.5px] ${styleNom}`}>{l.name}</span>
                    {l.priorite === 1 && <span className={`shrink-0 text-[11.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>À appeler</span>}
                  </span>
                  <span className={`mt-0.5 flex items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    <Point ton={TON_POINT[l.ton]} />
                    <span className="truncate">{l.statut} · {l.pagePrete ? 'page prête' : 'page à faire'}</span>
                  </span>
                  <span className={`mt-0.5 block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    {l.relance
                      ? `Relance ${l.relance.le <= now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) ? 'due' : 'prévue'}${l.relance.action ? ` : ${l.relance.action}` : ''}`
                      : `${l.visites30} visite${l.visites30 > 1 ? 's' : ''} · ${l.reservations30} résa sur 30 j${l.derniereConnexion ? ` · vu ${ilYa(l.derniereConnexion, now)}` : ''}`}
                  </span>
                </span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </EcranEquipe>
  )
}
