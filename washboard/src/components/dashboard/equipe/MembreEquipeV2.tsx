'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { Chevron } from '@/components/dashboard/ParametresFormV2'
import { nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { SANS_RESPONSABLE, contenuMembre, enCours, resumerMembre, type Membre } from '@/lib/espaceEquipe'
import { LIBELLE_STATUT, type Prospect } from '@/lib/prospects'
import { aujourdhuiParis } from '@/lib/suiviAppels'
import type { LaveurResume } from '@/lib/resumeLaveurs'
import EcranEquipe, { Carte, Initiales, Section } from './EcranEquipe'
import { dateJour } from './ChoixDate'

// Page d'un membre de l'équipe (2026-11-09) : ses laveurs, ses prospects, ce qu'il doit
// rappeler. Elle ne fait que lire : l'affiliation se change dans la fiche du laveur ou
// du prospect (« Suivi par »).

const LISTE = 'overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]'
const GRIS = `${corps} text-[color:var(--v2-color-gris)]`

type Vue = 'tout' | 'laveurs' | 'prospects'

function Chiffre({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="bg-[color:var(--v2-color-surface)] px-4 py-3">
      <span className={`block text-[12.5px] ${GRIS}`}>{libelle}</span>
      <span className={`mt-1 block text-[26px] leading-none ${corpsFort} tabular-nums`}>{valeur}</span>
    </div>
  )
}

function Vide({ children }: { children: React.ReactNode }) {
  return <Carte className="px-4 py-4"><p className={`text-[13.5px] ${GRIS}`}>{children}</p></Carte>
}

export default function MembreEquipeV2({ membre, laveurs, prospects, prospectsActifs, maintenant }: {
  membre: Membre
  laveurs: LaveurResume[]
  prospects: Prospect[]
  /** Faux tant que la table des prospects n'existe pas. */
  prospectsActifs: boolean
  maintenant: number
}) {
  const now = useMemo(() => new Date(maintenant), [maintenant])
  const auj = aujourdhuiParis(now)
  const grandEcran = useGrandEcran()
  const [vue, setVue] = useState<Vue>('tout')
  const r = useMemo(() => resumerMembre(membre, laveurs, prospects, now), [membre, laveurs, prospects, now])
  const c = useMemo(() => contenuMembre(membre, laveurs, prospects, now), [membre, laveurs, prospects, now])
  const enCoursP = c.prospects.filter(p => enCours(p, now))
  const autresP = c.prospects.filter(p => !enCours(p, now))
  const sans = membre === SANS_RESPONSABLE

  const ligneLaveur = (l: LaveurResume) => {
    const rappel = l.relance ? (l.relance.le <= auj ? 'À rappeler' : `Rappel ${dateJour(l.relance.le)}`) : null
    return (
      <li key={l.id}>
        <Link href={`/dashboard/support/laveurs/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--v2-filet)]/50">
          <Initiales nom={l.name} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15.5px] ${styleNom}`}>{l.name}</span>
            <span className={`mt-0.5 block truncate text-[12.5px] ${GRIS}`}>{[l.statut, rappel].filter(Boolean).join(' · ')}</span>
          </span>
          <Chevron />
        </Link>
      </li>
    )
  }

  const ligneProspect = (p: Prospect) => {
    const rappel = (p.statut === 'en_discussion' || p.statut === 'interesse') && p.relancer_le
      ? (p.relancer_le <= auj ? 'À rappeler' : `Rappel ${dateJour(p.relancer_le)}`) : null
    return (
      <li key={p.id}>
        <Link href={`/dashboard/support/prospects?p=${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--v2-filet)]/50">
          <Initiales nom={p.nom} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15.5px] ${styleNom}`}>{p.nom}</span>
            <span className={`mt-0.5 block truncate text-[12.5px] ${GRIS}`}>
              {[p.instagram && `@${p.instagram}`, p.ville, !p.instagram && p.telephone].filter(Boolean).join(' · ') || 'Sans coordonnées'}
            </span>
            <span className={`mt-0.5 block truncate text-[12.5px] ${GRIS}`}>{[LIBELLE_STATUT[p.statut], rappel].filter(Boolean).join(' · ')}</span>
          </span>
          <Chevron />
        </Link>
      </li>
    )
  }

  const blocLaveurs = (
    <Section titre={`Laveurs · ${c.laveurs.length}`}>
      {c.laveurs.length === 0
        ? <Vide>{sans ? 'Tous les laveurs ont quelqu’un qui les suit.' : 'Aucun laveur pour l’instant. Ouvrez la fiche d’un laveur et choisissez « Le prendre ».'}</Vide>
        : <ul className={LISTE}>{c.laveurs.map(ligneLaveur)}</ul>}
    </Section>
  )

  const blocProspects = (
    <div className="space-y-6">
      <Section titre={`Prospects · ${enCoursP.length}`}>
        {!prospectsActifs
          ? <Vide>La zone Prospects n’est pas encore activée en base.</Vide>
          : enCoursP.length === 0
            ? <Vide>{sans ? 'Tous les prospects en cours ont quelqu’un qui les suit.' : 'Aucun prospect en cours. Ouvrez un prospect et choisissez « Le prendre ».'}</Vide>
            : <ul className={LISTE}>{enCoursP.map(ligneProspect)}</ul>}
      </Section>
      {autresP.length > 0 && (
        <Section titre={`Refus, inscrits et archivés · ${autresP.length}`}>
          <ul className={LISTE}>{autresP.map(ligneProspect)}</ul>
        </Section>
      )}
    </div>
  )

  return (
    <EcranEquipe
      titre={sans ? 'À répartir' : membre}
      sousTitre={sans ? 'Laveurs et prospects que personne ne suit encore' : `${r.laveurs} laveur${r.laveurs > 1 ? 's' : ''} · ${r.prospects} prospect${r.prospects > 1 ? 's' : ''} en cours`}
      retour={{ href: '/dashboard/support', label: 'Équipe' }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-filet)]">
        <Chiffre libelle="Laveurs" valeur={r.laveurs} />
        <Chiffre libelle="Prospects en cours" valeur={r.prospects} />
        <Chiffre libelle="À rappeler" valeur={r.aRappeler} />
        <Chiffre libelle="Réponses à trier" valeur={r.aTrier} />
      </div>

      <div className="flex gap-2" role="group" aria-label="Afficher">
        {([['tout', 'Tout'], ['laveurs', `Laveurs ${c.laveurs.length}`], ['prospects', `Prospects ${c.prospects.length}`]] as const).map(([cle, libelle]) => (
          <button key={cle} type="button" aria-pressed={vue === cle} onClick={() => setVue(cle)} className={puce(vue === cle)}>{libelle}</button>
        ))}
      </div>

      {grandEcran && vue === 'tout' ? (
        <div className="grid grid-cols-2 items-start gap-6">{blocLaveurs}{blocProspects}</div>
      ) : (
        <>
          {vue !== 'prospects' && blocLaveurs}
          {vue !== 'laveurs' && blocProspects}
        </>
      )}
    </EcranEquipe>
  )
}
