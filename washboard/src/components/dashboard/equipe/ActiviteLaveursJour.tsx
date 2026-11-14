'use client'

import { useMemo } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { aujourdhuiParis } from '@/lib/suiviAppels'
import type { LaveurResume } from '@/lib/resumeLaveurs'
import { Section } from './EcranEquipe'
import { LigneLaveur, LISTE, Vide, heureParis } from './TableauEquipe'

// Réservations des dernières 24 h et connexions du jour des laveurs, sur téléphone
// (Alexandre, 2026-11-14 : « on ne les a pas »). Sur ordinateur, le tableau les affiche déjà.

export default function ActiviteLaveursJour({ laveurs, maintenant }: { laveurs: LaveurResume[]; maintenant: number }) {
  const { resa, connectes } = useMemo(() => {
    const auj = aujourdhuiParis(new Date(maintenant))
    return {
      resa: laveurs.filter(l => l.reservations24h > 0).sort((a, b) => b.reservations24h - a.reservations24h),
      connectes: laveurs
        .filter(l => l.derniereConnexion && aujourdhuiParis(new Date(l.derniereConnexion)) === auj)
        .sort((a, b) => b.derniereConnexion!.localeCompare(a.derniereConnexion!)),
    }
  }, [laveurs, maintenant])
  const total = resa.reduce((t, l) => t + l.reservations24h, 0)

  return (
    <>
      <Section titre={total ? `Réservations des dernières 24 h · ${total}` : 'Réservations des dernières 24 h'}>
        {resa.length === 0 ? <Vide>Aucune réservation ces dernières 24 heures.</Vide> : (
          <ul className={LISTE}>
            {resa.map(l => (
              <LigneLaveur
                key={l.id} l={l}
                sousTitre={<span className="truncate">{l.reservations24hEnLigne === l.reservations24h ? 'Toutes prises en ligne' : l.reservations24hEnLigne ? `${l.reservations24hEnLigne} en ligne, ${l.reservations24h - l.reservations24hEnLigne} saisie${l.reservations24h - l.reservations24hEnLigne > 1 ? 's' : ''} par lui` : `Saisie${l.reservations24h > 1 ? 's' : ''} par lui`}</span>}
                droite={<span className={`shrink-0 text-[15px] ${corpsFort} tabular-nums`}>{l.reservations24h}</span>}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section titre={connectes.length ? `Connectés aujourd’hui · ${connectes.length}` : 'Connectés aujourd’hui'}>
        {connectes.length === 0 ? <Vide>Aucun laveur connecté aujourd’hui.</Vide> : (
          <ul className={LISTE}>
            {connectes.map(l => (
              <LigneLaveur key={l.id} l={l} sousTitre={<span className="truncate">{l.statut}</span>} droite={<span className={`shrink-0 text-[12.5px] ${corps} tabular-nums`}>{heureParis(l.derniereConnexion!)}</span>} />
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
