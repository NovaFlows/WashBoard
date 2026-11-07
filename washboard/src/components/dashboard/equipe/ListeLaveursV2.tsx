'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CHAMP, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { Chevron } from '@/components/dashboard/ParametresFormV2'
import { ilYa } from '@/lib/ficheLaveur'
import { aujourdhuiParis } from '@/lib/suiviAppels'
import { EQUIPE } from '@/lib/responsables'
import type { LaveurResume } from '@/lib/resumeLaveurs'
import EcranEquipe, { Initiales, Point, Section } from './EcranEquipe'
import FeuilleRappel, { BoutonRappel, rappelLaveur } from './FeuilleRappel'

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

function jourCourt(aaaammjj: string): string {
  return new Date(`${aaaammjj}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// « Suivi par » : retenu sur l'appareil, pour que chacun retrouve ses laveurs en ouvrant la liste.
const CLE_SUIVI_PAR = 'equipe.suiviPar'
type SuiviPar = 'tous' | 'personne' | string

export default function ListeLaveursV2({ laveurs, filtreInitial, maintenant, affiliationActive = false }: { laveurs: LaveurResume[]; filtreInitial: Filtre; maintenant: number; affiliationActive?: boolean }) {
  const [filtre, setFiltre] = useState<Filtre>(filtreInitial)
  const [suiviPar, setSuiviPar] = useState<SuiviPar>('tous')
  useEffect(() => {
    try {
      const v = localStorage.getItem(CLE_SUIVI_PAR)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique au montage (le serveur ne connaît pas l'appareil)
      if (v && (v === 'personne' || (EQUIPE as readonly string[]).includes(v))) setSuiviPar(v)
    } catch { /* stockage indisponible : on reste sur « Tous » */ }
  }, [])
  function choisirSuiviPar(v: SuiviPar) {
    setSuiviPar(v)
    try { localStorage.setItem(CLE_SUIVI_PAR, v) } catch { /* sans effet */ }
  }
  const suit = (l: LaveurResume, v: SuiviPar = suiviPar) => !affiliationActive || v === 'tous' || (v === 'personne' ? !l.responsable : l.responsable === v)
  const [recherche, setRecherche] = useState('')
  const [rappelOuvert, setRappelOuvert] = useState<string | null>(null)
  const now = useMemo(() => new Date(maintenant), [maintenant])

  const visibles = useMemo(() => {
    const q = sansAccents(recherche.trim())
    const chiffres = recherche.replace(/\D/g, '')
    const liste = laveurs.filter(l => garde(l, filtre, maintenant) && suit(l) && (!q
      || sansAccents(l.name).includes(q) || l.slug.includes(q)
      || (chiffres.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(chiffres))))
    // « À rappeler » : la relance la plus ancienne d'abord. Sinon, les derniers inscrits.
    return filtre === 'rappeler'
      ? liste.sort((a, b) => a.relance!.le.localeCompare(b.relance!.le))
      : liste
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `suit` ne dépend que de suiviPar et affiliationActive
  }, [laveurs, filtre, recherche, maintenant, suiviPar, affiliationActive])

  const compte = (f: Filtre) => laveurs.filter(l => garde(l, f, maintenant) && suit(l)).length
  const compteSuivi = (v: SuiviPar) => laveurs.filter(l => garde(l, filtre, maintenant) && suit(l, v)).length

  // « À rappeler » rangé par jour : aujourd'hui (retards compris), demain, les jours suivants.
  const auj = aujourdhuiParis(now)
  const demain = aujourdhuiParis(new Date(maintenant + 864e5))
  const jours = filtre === 'rappeler' ? [
    { titre: 'Aujourd’hui', vide: 'Personne à rappeler aujourd’hui.', laveurs: visibles.filter(l => l.relance!.le <= auj) },
    { titre: 'Demain', vide: 'Personne demain.', laveurs: visibles.filter(l => l.relance!.le === demain) },
    { titre: 'Les prochains jours', vide: 'Rien de prévu après demain.', laveurs: visibles.filter(l => l.relance!.le > demain) },
  ] : null

  const ligne = (l: LaveurResume) => (
    <li key={l.id} className="flex items-center">
      <Link href={`/dashboard/support/laveurs/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-[color:var(--v2-filet)]/50">
        <Initiales nom={l.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-[15.5px] ${styleNom}`}>{l.name}</span>
            {l.priorite === 1 && <span className={`shrink-0 text-[11.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>À appeler</span>}
            {l.responsable && suiviPar === 'tous' && <span className={`ml-auto shrink-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{l.responsable}</span>}
          </span>
          <span className={`mt-0.5 flex items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            <Point ton={TON_POINT[l.ton]} />
            <span className="truncate">{l.statut} · {l.pagePrete ? 'page prête' : 'page à faire'}</span>
          </span>
          <span className={`mt-0.5 block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {filtre === 'rappeler' && l.relance
              ? [l.relance.le < auj ? `En retard depuis ${jourCourt(l.relance.le)}` : l.relance.le > demain ? jourCourt(l.relance.le).replace(/^./, c => c.toUpperCase()) : null, l.relance.action ?? 'Sans motif'].filter(Boolean).join(' · ')
              : `${l.visites30} visite${l.visites30 > 1 ? 's' : ''} · ${l.reservations30} résa sur 30 j${l.derniereConnexion ? ` · vu ${ilYa(l.derniereConnexion, now)}` : ''}`}
          </span>
        </span>
        {!(filtre === 'rappeler' && l.relance) && <Chevron />}
      </Link>
      {/* « À rappeler » : décaler ou supprimer l'appel sans ouvrir la fiche. */}
      {filtre === 'rappeler' && l.relance && <span className="pr-2"><BoutonRappel onClick={() => setRappelOuvert(l.id)} libelle={`Décaler ou supprimer le rappel de ${l.name}`} /></span>}
    </li>
  )
  const laveurRappel = rappelOuvert ? laveurs.find(l => l.id === rappelOuvert && l.relance) : null
  const LISTE = 'overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]'

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
        {affiliationActive && (
          <div className="-mx-3 sm:mx-0 px-3 sm:px-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Suivi par">
            <span className={`shrink-0 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Suivi par</span>
            {(['tous', ...EQUIPE, 'personne'] as SuiviPar[]).map(v => (
              <button key={v} type="button" aria-pressed={suiviPar === v} onClick={() => choisirSuiviPar(v)} className={puce(suiviPar === v)}>
                {v === 'tous' ? 'Tous' : v === 'personne' ? `Personne ${compteSuivi(v)}` : `${v} ${compteSuivi(v)}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {jours && (recherche.trim() === '' || visibles.length > 0) ? (
        jours.map(j => (
          <Section key={j.titre} titre={j.laveurs.length ? `${j.titre} · ${j.laveurs.length}` : j.titre}>
            {j.laveurs.length === 0
              ? <p className={`px-0.5 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{j.vide}</p>
              : <ul className={LISTE}>{j.laveurs.map(ligne)}</ul>}
          </Section>
        ))
      ) : visibles.length === 0 ? (
        <p className={`py-6 text-center text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucun laveur ne correspond.</p>
      ) : (
        <ul className={LISTE}>{visibles.map(ligne)}</ul>
      )}
      {filtre === 'rappeler' && (
        <p className={`px-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Un laveur s’ajoute ici avec le bouton « À rappeler » de sa fiche, ou en fixant une date de relance quand vous notez un appel.
        </p>
      )}
      {laveurRappel?.relance && (
        <FeuilleRappel
          key={laveurRappel.relance.appelId} nom={laveurRappel.name} le={laveurRappel.relance.le} now={now}
          lienFiche={`/dashboard/support/laveurs/${laveurRappel.id}`} {...rappelLaveur(laveurRappel.relance)} onClose={() => setRappelOuvert(null)}
        />
      )}
    </EcranEquipe>
  )
}
