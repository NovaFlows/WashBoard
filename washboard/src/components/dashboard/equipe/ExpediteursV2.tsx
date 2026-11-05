'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat, nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import EcranEquipe, { Point, Section } from './EcranEquipe'

// Noms d'expéditeur SMS demandés par les laveurs, au design de la refonte
// (remplace SupportExpediteurs dans l'espace équipe, 2026-11-05). Même route,
// mêmes règles : on approuve seulement après la validation Brevo.

type Demande = {
  id: string
  name: string
  slug: string | null
  sms_sender: string | null
  sms_sender_statut: 'en_attente' | 'approuve' | 'refuse'
}

const LIBELLE = { en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé' } as const
const TON = { en_attente: 'ambre', approuve: 'vert', refuse: 'gris' } as const

export default function ExpediteursV2() {
  const [demandes, setDemandes] = useState<Demande[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/support/expediteurs')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setErreur(body.error || 'Impossible de charger les demandes.'); return }
      setErreur(null)
      setDemandes(body.demandes ?? [])
    } catch {
      setErreur('Impossible de charger les demandes.')
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement des données au montage
  useEffect(() => { void charger() }, [charger])

  async function decider(id: string, decision: 'approuve' | 'refuse') {
    setEnCours(id)
    setErreur(null)
    const res = await fetch(`/api/support/expediteurs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    }).catch(() => null)
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}))
      setErreur(body?.error || 'Enregistrement impossible.')
    }
    setEnCours(null)
    void charger()
  }

  const enAttente = demandes?.filter(d => d.sms_sender_statut === 'en_attente') ?? []
  const traitees = demandes?.filter(d => d.sms_sender_statut !== 'en_attente') ?? []

  return (
    <EcranEquipe titre="Expéditeurs SMS" sousTitre="Approuver seulement après la validation chez Brevo" retour={{ href: '/dashboard/support', label: 'Équipe' }}>
      {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
      {demandes === null && !erreur && <p className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>Chargement…</p>}

      {demandes && (
        <Section titre="En attente">
          {enAttente.length === 0 ? (
            <p className={`px-0.5 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Aucune demande en attente. Tant qu’un nom n’est pas approuvé, ses SMS partent sous « WashBoard ».
            </p>
          ) : (
            <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]">
              {enAttente.map(d => (
                <li key={d.id} className="px-4 py-3.5">
                  <p className={`text-[17px] ${corpsFort}`}>{d.sms_sender ?? '—'}</p>
                  <Link href={`/dashboard/support/laveurs/${d.id}`} className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] underline-offset-2 hover:underline`}>{d.name}</Link>
                  <div className="mt-3 flex gap-2.5">
                    <button type="button" disabled={enCours === d.id} onClick={() => void decider(d.id, 'refuse')} className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>Refuser</button>
                    <button type="button" disabled={enCours === d.id} onClick={() => void decider(d.id, 'approuve')} className={`${BOUTON} flex-1 text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>Approuver</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {traitees.length > 0 && (
        <Section titre="Déjà traités">
          <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] px-4">
            {traitees.map(d => (
              <li key={d.id}>
                <Link href={`/dashboard/support/laveurs/${d.id}`} className="flex items-center gap-3 min-h-[52px] py-2">
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${styleNom}`}>{d.sms_sender ?? '—'}</span>
                    <span className={`block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{d.name}</span>
                  </span>
                  <span className={`flex shrink-0 items-center gap-1.5 text-[13px] ${corps}`}><Point ton={TON[d.sms_sender_statut]} />{LIBELLE[d.sms_sender_statut]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </EcranEquipe>
  )
}
