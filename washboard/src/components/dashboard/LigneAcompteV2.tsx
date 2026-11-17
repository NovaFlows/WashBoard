'use client'

import { useState } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { formatPrice } from '@/lib/pricing'
import { PROLONGATIONS_ACOMPTE } from '@/lib/acompte'
import { useT , useLocale } from '@/components/i18n/I18nProvider'

// L'acompte d'un rendez-vous, dans sa fiche (téléphone et ordinateur). Le client le paie par
// le lien du laveur (lib/acompte.ts) : WashBoard ne voit pas le paiement, c'est le laveur
// qui confirme l'avoir reçu — d'un toucher, et il peut revenir en arrière en cas d'erreur.

export type AcompteRdv = {
  id: string
  status?: 'pending' | 'confirmed' | 'cancelled' | 'done'
  scheduled_at?: string
  acompte_montant?: number | null
  acompte_statut?: 'en_attente' | 'recu' | null
  acompte_echeance?: string | null
}

export type ProlongationAcompte = { status: 'pending'; acompte_echeance: string | null }

export default function LigneAcompteV2({ rdv, modifiable, onProlonge }: { rdv: AcompteRdv; modifiable: boolean; onProlonge?: (champs: ProlongationAcompte) => void }) {
  const loc = useLocale()
  const t = useT()
  const [statut, setStatut] = useState(rdv.acompte_statut ?? null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [echeanceLocale, setEcheanceLocale] = useState<string | null | undefined>(undefined)
  const [retablie, setRetablie] = useState(false)
  const [maintenant] = useState(() => Date.now())
  const [choixRallonge, setChoixRallonge] = useState(false)
  if (!statut || !rdv.acompte_montant) return null

  const recu = statut === 'recu'
  const couleur = recu ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)'
  const echeanceBrute = echeanceLocale === undefined ? rdv.acompte_echeance : echeanceLocale
  const annuleeFauteDePaiement = !retablie && !recu && rdv.status === 'cancelled' && !!echeanceBrute
    && new Date(echeanceBrute).getTime() < maintenant
    && (!rdv.scheduled_at || new Date(rdv.scheduled_at).getTime() > maintenant)
  const prolongeable = !recu && (annuleeFauteDePaiement || (modifiable && !!echeanceBrute && (rdv.status === 'pending' || retablie)))
  const echeance = echeanceBrute && !recu
    ? new Date(echeanceBrute).toLocaleString(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  async function prolonger(heures: number) {
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/bookings/${rdv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prolonger_acompte_heures: heures }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErreur(json?.error ?? t('La modification a échoué.')); return }
      setEcheanceLocale(json.acompte_echeance ?? null)
      setRetablie(true)
      setChoixRallonge(false)
      onProlonge?.({ status: 'pending', acompte_echeance: json.acompte_echeance ?? null })
    } catch {
      setErreur(t('La modification a échoué. Vérifiez votre connexion.'))
    } finally {
      setEnCours(false)
    }
  }

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
      if (!res.ok) { setErreur(json?.error ?? t('La modification a échoué.')); return }
      setStatut(recu ? 'en_attente' : 'recu')
    } catch {
      setErreur(t('La modification a échoué. Vérifiez votre connexion.'))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="mt-3 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[14px] ${corps}`}>{t('Acompte · {formatPrice}', { formatPrice: formatPrice(Number(rdv.acompte_montant)) })}</p>
          <p className={`mt-0.5 flex items-center gap-1.5 text-[12.5px] ${corpsFort}`} style={{ color: couleur }}>
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: couleur }} aria-hidden />
            {recu ? t('Reçu') : echeance ? t('En attente · avant {echeance}', { echeance }) : t('En attente')}
          </p>
        </div>
        {modifiable && !annuleeFauteDePaiement && (
          <button
            type="button"
            onClick={basculer}
            disabled={enCours}
            className={`h-10 shrink-0 rounded-[var(--v2-radius-bouton)] border px-3.5 text-[13.5px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
            style={recu
              ? { borderColor: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }
              : { borderColor: 'var(--v2-color-vert)', color: 'var(--v2-color-vert)' }}
          >
            {enCours ? '…' : recu ? t('Annuler') : t('Acompte reçu')}
          </button>
        )}
      </div>
      {prolongeable && (
        <div className="mt-3">
          {annuleeFauteDePaiement && (
            <p className={`mb-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>
              {t('Annulée : acompte non réglé à temps. Vous pouvez la rétablir en laissant un nouveau délai au client.')}
            </p>
          )}
          {choixRallonge ? (
            <div className="flex flex-wrap items-center gap-2">
              {PROLONGATIONS_ACOMPTE.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => prolonger(h)}
                  disabled={enCours}
                  className={`h-10 rounded-[var(--v2-radius-bouton)] border px-3.5 text-[13.5px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
                  style={{ borderColor: 'var(--v2-color-vert)', color: 'var(--v2-color-vert)' }}
                >
                  {enCours ? '…' : t('+ {h} h', { h })}
                </button>
              ))}
              <button type="button" onClick={() => setChoixRallonge(false)} className={`h-10 px-2 text-[13.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-gris)' }}>{t('Fermer')}</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChoixRallonge(true)}
              className={`h-10 rounded-[var(--v2-radius-bouton)] border px-3.5 text-[13.5px] ${corpsFort} transition-transform active:scale-[.97]`}
              style={{ borderColor: 'var(--v2-filet-fort)', color: 'var(--v2-color-encre)' }}
            >
              {annuleeFauteDePaiement ? t('Rétablir et prolonger le délai') : t('Prolonger le délai')}
            </button>
          )}
        </div>
      )}
      {erreur && <p role="alert" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>}
    </div>
  )
}
