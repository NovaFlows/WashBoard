'use client'

import { useState } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { formatPrice } from '@/lib/pricing'
import { lireMontant, montantPrevu } from '@/lib/cloture'
import { prixAvantRemiseLaveur, type RdvRemisable } from '@/lib/remiseLaveur'
import { useT } from '@/components/i18n/I18nProvider'

// Remise du laveur sur un rendez-vous, dans sa fiche (téléphone et ordinateur) : seulement à la
// baisse, tant que la facture n'est pas émise (lib/remiseLaveur.ts).

export type RdvRemise = RdvRemisable & {
  id: string
  client_email?: string | null
  saisie_par_laveur?: boolean | null
}

export default function LigneRemiseV2({ rdv, onMaj }: {
  rdv: RdvRemise
  onMaj: (champs: { booked_price: number; remise_laveur: number }) => void
}) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const remise = Math.max(0, Number(rdv.remise_laveur ?? 0))
  const prixActuel = montantPrevu(rdv)
  const modifiable = rdv.status !== 'cancelled' && !rdv.facture_numero
  if (!modifiable && remise === 0) return null

  const prixSaisi = lireMontant(saisie)
  const remiseSaisie = prixSaisi !== null && prixSaisi < prixActuel ? Math.round((prixActuel - prixSaisi) * 100) / 100 : null
  const clientPrevenu = !rdv.saisie_par_laveur && !!rdv.client_email?.trim()

  function fermer() {
    setOuvert(false)
    setSaisie('')
    setErreur(null)
  }

  async function enregistrer() {
    if (remiseSaisie === null) {
      setErreur(t('Indiquez un prix plus bas que {formatPrice}.', { formatPrice: formatPrice(prixActuel) }))
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/bookings/${rdv.id}/remise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prix: prixSaisi }),
      })
      const json = await res.json().catch(() => null) as { error?: string; booked_price?: number; remise_laveur?: number; client_prevenu?: boolean } | null
      if (!res.ok || typeof json?.booked_price !== 'number') { setErreur(json?.error ?? t('La modification a échoué.')); return }
      onMaj({ booked_price: json.booked_price, remise_laveur: Number(json.remise_laveur ?? 0) })
      setInfo(json.client_prevenu ? t('Remise enregistrée. Le client est prévenu par email.') : t('Remise enregistrée.'))
      fermer()
    } catch {
      setErreur(t('La modification a échoué. Vérifiez votre connexion.'))
    } finally {
      setEnCours(false)
    }
  }

  // Sans remise, un simple lien : la fiche ne s'alourdit pas d'une case vide.
  if (remise === 0 && !ouvert && !info) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={`mt-2 px-1 text-[13px] ${corpsFort}`}
        style={{ color: 'var(--v2-color-accent)' }}
      >
        {t('Faire une remise')}
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {remise > 0 ? (
            <>
              <p className={`text-[14px] ${corps}`}>{t('Remise accordée · −')}{formatPrice(remise)}</p>
              <p className={`mt-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('Prix de départ :')} {formatPrice(prixAvantRemiseLaveur(rdv))}</p>
            </>
          ) : (
            <p className={`text-[14px] ${corps}`}>{t('Faire une remise')}</p>
          )}
        </div>
        {modifiable && !ouvert && (
          <button
            type="button"
            onClick={() => { setOuvert(true); setInfo(null) }}
            className={`h-10 shrink-0 rounded-[var(--v2-radius-bouton)] border px-3.5 text-[13.5px] ${corpsFort} transition-transform active:scale-[.97]`}
            style={{ borderColor: 'var(--v2-color-accent)', color: 'var(--v2-color-accent)' }}
          >
            {t('Faire une remise')}
          </button>
        )}
      </div>

      {ouvert && (
        <div className="mt-3">
          <label htmlFor={`remise-${rdv.id}`} className={`mb-1.5 block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {t('Nouveau prix (€) · actuellement')} {formatPrice(prixActuel)}
          </label>
          <input
            id={`remise-${rdv.id}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={saisie}
            onChange={e => { setSaisie(e.target.value); setErreur(null) }}
            onKeyDown={e => { if (e.key === 'Enter') enregistrer() }}
            placeholder={String(prixActuel)}
            className={`h-11 w-full rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[16px] ${corps} text-[color:var(--v2-color-encre)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
          />
          <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {remiseSaisie !== null ? t('Remise de {formatPrice}. ', { formatPrice: formatPrice(remiseSaisie) }) : t('Seulement à la baisse. ')}
            {clientPrevenu ? t('Le client sera prévenu par email.') : t('Le client ne reçoit pas de message.')}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={enregistrer}
              disabled={enCours || remiseSaisie === null}
              className={`h-10 flex-1 rounded-[var(--v2-radius-bouton)] text-[13.5px] ${corpsFort} text-white disabled:opacity-50 transition-transform active:scale-[.97]`}
              style={{ background: 'var(--v2-color-accent)' }}
            >
              {enCours ? t('Enregistrement…') : t('Enregistrer')}
            </button>
            <button
              type="button"
              onClick={fermer}
              className={`h-10 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-4 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
            >
              {t('Annuler')}
            </button>
          </div>
        </div>
      )}
      {erreur && <p role="alert" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>}
      {info && <p role="status" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>{info}</p>}
    </div>
  )
}
