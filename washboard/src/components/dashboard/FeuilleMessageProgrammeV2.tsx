'use client'

import { useState } from 'react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { DECALAGES_JOURS, type LigneMessage } from '@/lib/messagesAutomatiques'

// Un message de « Programmé » ouvert : le décaler, ou ne pas l'envoyer (Alexandre, 2026-10-10).
// Toute la règle (nouvelle date, ce qui s'écrit en base) vit dans `PATCH /api/bookings/[id]/message`
// et `nouvelleEcheance` ; cette feuille ne fait que choisir.

export type ResultatMessage = { ok: true; champs: Record<string, string | null> } | { ok: false; erreur: string }

const libelleJours = (j: number) => (j === 1 ? '1 jour' : j === 7 ? '1 semaine' : j === 30 ? '1 mois' : j === 90 ? '3 mois' : `${j} jours`)

export default function FeuilleMessageProgrammeV2({
  ligne, onAgir, onClose,
}: {
  ligne: LigneMessage
  onAgir: (action: 'decaler' | 'annuler', jours?: number) => Promise<ResultatMessage>
  onClose: () => void
}) {
  const choix = DECALAGES_JOURS[ligne.type]
  const [jours, setJours] = useState<number>(choix[0])
  const [enCours, setEnCours] = useState<'decaler' | 'annuler' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const quoi = ligne.type === 'avis' ? 'la demande d’avis' : 'la relance'

  async function agir(action: 'decaler' | 'annuler') {
    if (enCours) return
    setEnCours(action)
    setErreur(null)
    const r = await onAgir(action, action === 'decaler' ? jours : undefined)
    setEnCours(null)
    if (r.ok) onClose()
    else setErreur(r.erreur)
  }

  return (
    <Feuille
      titre={ligne.nom}
      sousTitre={`${ligne.type === 'avis' ? 'Demande d’avis' : 'Relance'} · ${ligne.droite}`}
      onClose={onClose}
      pied={
        <button
          type="button"
          onClick={() => agir('decaler')}
          disabled={enCours !== null}
          className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          {enCours === 'decaler' ? 'Enregistrement…' : `Décaler de ${libelleJours(jours)}`}
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <h3 className={`text-[15px] ${corpsFort}`}>Décaler l’envoi</h3>
          <p className={`mt-1 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            {ligne.type === 'avis'
              ? 'Votre client recevra la demande plus tard que prévu.'
              : 'Votre client sera relancé plus tard, s’il n’a pas repris rendez-vous d’ici là.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Décalage">
            {choix.map(j => (
              <button
                key={j}
                type="button"
                role="radio"
                aria-checked={jours === j}
                onClick={() => setJours(j)}
                className={puce(jours === j)}
              >
                {libelleJours(j)}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[color:var(--v2-filet)] pt-3">
          <button
            type="button"
            onClick={() => agir('annuler')}
            disabled={enCours !== null}
            className={`flex min-h-11 items-center text-[15px] ${corpsFort} disabled:opacity-50`}
            style={{ color: 'var(--v2-color-rouge)' }}
          >
            {enCours === 'annuler' ? 'Enregistrement…' : `Ne pas envoyer ${quoi}`}
          </button>
          <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Seulement ce message. Pour ne plus jamais écrire à ce client, utilisez « Ne plus contacter » dans sa fiche.
          </p>
        </div>

        {erreur && (
          <p role="alert" className={`text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>
        )}
      </div>
    </Feuille>
  )
}
