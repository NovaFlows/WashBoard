'use client'

import { useState } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { formatPrice } from '@/lib/pricing'

// L'acompte d'un rendez-vous, dans sa fiche (téléphone et ordinateur). Le client le paie par
// le lien du laveur (lib/acompte.ts) : WashBoard ne voit pas le paiement, c'est le laveur
// qui confirme l'avoir reçu — d'un toucher, et il peut revenir en arrière en cas d'erreur.

export type AcompteRdv = {
  id: string
  acompte_montant?: number | null
  acompte_statut?: 'en_attente' | 'recu' | null
  acompte_echeance?: string | null
}

export default function LigneAcompteV2({ rdv, modifiable }: { rdv: AcompteRdv; modifiable: boolean }) {
  const [statut, setStatut] = useState(rdv.acompte_statut ?? null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  if (!statut || !rdv.acompte_montant) return null

  const recu = statut === 'recu'
  const couleur = recu ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)'
  const echeance = rdv.acompte_echeance && !recu
    ? new Date(rdv.acompte_echeance).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  async function basculer() {
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/bookings/${rdv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acompte_recu: !recu }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErreur(json?.error ?? 'La modification a échoué.'); return }
      setStatut(recu ? 'en_attente' : 'recu')
    } catch {
      setErreur('La modification a échoué. Vérifiez votre connexion.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="mt-3 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[14px] ${corps}`}>Acompte · {formatPrice(Number(rdv.acompte_montant))}</p>
          <p className={`mt-0.5 flex items-center gap-1.5 text-[12.5px] ${corpsFort}`} style={{ color: couleur }}>
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: couleur }} aria-hidden />
            {recu ? 'Reçu' : echeance ? `En attente · avant ${echeance}` : 'En attente'}
          </p>
        </div>
        {modifiable && (
          <button
            type="button"
            onClick={basculer}
            disabled={enCours}
            className={`h-10 shrink-0 rounded-[var(--v2-radius-bouton)] border px-3.5 text-[13.5px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
            style={recu
              ? { borderColor: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }
              : { borderColor: 'var(--v2-color-vert)', color: 'var(--v2-color-vert)' }}
          >
            {enCours ? '…' : recu ? 'Annuler' : 'Acompte reçu'}
          </button>
        )}
      </div>
      {erreur && <p role="alert" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>}
    </div>
  )
}
