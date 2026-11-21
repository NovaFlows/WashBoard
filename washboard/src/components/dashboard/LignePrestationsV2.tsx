'use client'

import { useState } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { formatPrice } from '@/lib/pricing'
import { formatHeure } from '@/lib/dateUtils'
import { MAX_PRESTATIONS, type PrestationCatalogue } from '@/lib/plusieursPrestations'
import {
  ajouterPrestation,
  prestationsAjoutees,
  prixAjout,
  refusModification,
  retirerPrestation,
  type ColonnesPrestations,
  type RdvAvecPrestations,
} from '@/lib/prestationsRendezVous'
import { useT } from '@/components/i18n/I18nProvider'

// Ajouter ou retirer une prestation sur un rendez-vous déjà pris, dans sa fiche (téléphone et
// ordinateur). Le calcul affiché est celui du serveur (lib/prestationsRendezVous.ts), qui refait
// tout à partir du catalogue.

export type RdvPrestations = RdvAvecPrestations & {
  id: string
  ends_at?: string | null
  client_email?: string | null
  saisie_par_laveur?: boolean | null
}

export type PrestationProposee = Omit<PrestationCatalogue, 'washer_id'> & { washer_id?: string }

type Choix = { sens: 'ajout'; prestation: PrestationProposee } | { sens: 'retrait'; id: string; nom: string }

// L'aperçu ne vérifie pas le laveur : le catalogue reçu est déjà le sien, et le serveur le revérifie.
const APERCU = '-'
const pourApercu = (p: PrestationProposee): PrestationCatalogue => ({ ...p, washer_id: APERCU })
// Même écriture que le détail du prix juste au-dessus : « 80 € ».
const euros = (n: number) => formatPrice(n).replace(/€$/, ' €')

export default function LignePrestationsV2({ rdv, catalogue, debutSuivant, onMaj }: {
  rdv: RdvPrestations
  /** Prestations du laveur. */
  catalogue: PrestationProposee[]
  /** Début du rendez-vous suivant le même jour, quand le laveur travaille seul : pour prévenir d'un chevauchement. */
  debutSuivant?: string | null
  onMaj: (champs: Pick<ColonnesPrestations, 'booked_price' | 'vehicles_detail' | 'selected_addons' | 'ends_at'>) => void
}) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const [choix, setChoix] = useState<Choix | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (refusModification(rdv)) return null

  const ajoutees = prestationsAjoutees(rdv)
  const nomAjoutee = (id: string) => {
    const option = [...(rdv.vehicles_detail ?? []).flatMap(v => v.addons ?? []), ...(rdv.selected_addons ?? [])]
      .find(o => o.id === `prestation:${id}`)
    return option?.label ?? catalogue.find(p => p.id === id)?.name ?? t('Prestation')
  }
  const complet = ajoutees.length + 1 >= MAX_PRESTATIONS
  // En veille à la fin : le laveur peut les ajouter, mais elles ne sont plus son offre courante.
  const proposees = catalogue
    .filter(p => p.id !== rdv.service_id && !ajoutees.includes(p.id))
    .sort((a, b) => Number(!!a.en_veille) - Number(!!b.en_veille))
  const clientPrevenu = !rdv.saisie_par_laveur && !!rdv.client_email?.trim()

  const apercu = choix
    ? choix.sens === 'ajout' ? ajouterPrestation(rdv, pourApercu(choix.prestation), APERCU) : retirerPrestation(rdv, choix.id)
    : null
  const finActuelle = rdv.ends_at ?? null
  const chevauche = apercu?.ok && debutSuivant && apercu.ecart >= 0
    && new Date(apercu.colonnes.ends_at).getTime() > new Date(debutSuivant).getTime()
    && (!finActuelle || new Date(finActuelle).getTime() <= new Date(debutSuivant).getTime())

  function fermer() {
    setOuvert(false)
    setChoix(null)
    setErreur(null)
  }

  async function valider() {
    if (!choix || !apercu?.ok) return
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/bookings/${rdv.id}/prestations`, {
        method: choix.sens === 'ajout' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: choix.sens === 'ajout' ? choix.prestation.id : choix.id }),
      })
      const json = await res.json().catch(() => null) as (Partial<ColonnesPrestations> & { error?: string; client_prevenu?: boolean }) | null
      if (!res.ok || typeof json?.booked_price !== 'number' || !json.ends_at) {
        setErreur(json?.error ?? t('La modification a échoué.'))
        return
      }
      onMaj({ booked_price: json.booked_price, vehicles_detail: json.vehicles_detail ?? null, selected_addons: json.selected_addons ?? [], ends_at: json.ends_at })
      const fait = choix.sens === 'ajout' ? t('Prestation ajoutée.') : t('Prestation retirée.')
      setInfo(json.client_prevenu ? `${fait} ${t('Le client est prévenu par email.')}` : fait)
      fermer()
    } catch {
      setErreur(t('La modification a échoué. Vérifiez votre connexion.'))
    } finally {
      setEnCours(false)
    }
  }

  if (!ouvert) {
    return (
      <div className="mt-2 px-1">
        <button
          type="button"
          onClick={() => { setOuvert(true); setInfo(null) }}
          className={`min-h-11 text-[13px] ${corpsFort}`}
          style={{ color: 'var(--v2-color-accent)' }}
          aria-expanded={false}
        >
          {ajoutees.length > 0 ? t('Ajouter ou retirer une prestation') : t('Ajouter une prestation')}
        </button>
        {info && <p role="status" className={`text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>{info}</p>}
      </div>
    )
  }

  const ligne = `flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--v2-radius-bouton)] px-3 py-2 text-left text-[14px] ${corps} text-[color:var(--v2-color-encre)] transition-colors`

  return (
    <div className="mt-3 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3" role="group" aria-label={t('Prestations du rendez-vous')}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[14px] ${corpsFort}`}>{choix ? (choix.sens === 'ajout' ? t('Ajouter « {nom} »', { nom: choix.prestation.name }) : t('Retirer « {nom} »', { nom: choix.nom })) : ajoutees.length > 0 ? t('Prestations du rendez-vous') : t('Ajouter une prestation')}</p>
        <button type="button" onClick={fermer} className={`min-h-11 shrink-0 px-1 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
          {t('Fermer')}
        </button>
      </div>

      {!choix && (
        <>
          {ajoutees.length > 0 && (
            <ul className="mt-2 space-y-1">
              {ajoutees.map(id => (
                <li key={id} className={`${ligne} bg-[color:var(--v2-filet)]/40`}>
                  <span className="min-w-0 truncate">{nomAjoutee(id)}</span>
                  <button
                    type="button"
                    onClick={() => { setChoix({ sens: 'retrait', id, nom: nomAjoutee(id) }); setErreur(null) }}
                    className={`min-h-11 shrink-0 px-1 text-[13px] ${corpsFort}`}
                    style={{ color: 'var(--v2-color-rouge)' }}
                    aria-label={t('Retirer « {nom} »', { nom: nomAjoutee(id) })}
                  >
                    {t('Retirer')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Sous-titre seulement quand des prestations à retirer précèdent la liste. */}
          {(complet || ajoutees.length > 0) && (
            <p className={`mt-3 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {complet ? t('{max} prestations au plus par rendez-vous.', { max: MAX_PRESTATIONS }) : t('Ajouter une prestation de votre catalogue')}
            </p>
          )}
          {!complet && (proposees.length === 0 ? (
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('Aucune autre prestation dans votre catalogue.')}</p>
          ) : (
            // Sans hauteur maximale : la fiche défile déjà, une liste qui défile dedans piège le pouce.
            <ul className="mt-2 space-y-1">
              {proposees.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setChoix({ sens: 'ajout', prestation: p }); setErreur(null) }}
                    className={`${ligne} border border-[color:var(--v2-filet)] hover:border-[color:var(--v2-filet-fort)] active:scale-[.99]`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{p.name}</span>
                      {p.en_veille && <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('En veille')}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-[color:var(--v2-color-gris)]">+{euros(prixAjout(rdv, p))}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </>
      )}

      {choix && apercu && (
        <div className="mt-2">
          {apercu.ok ? (
            <>
              <p className={`text-[14px] ${corps}`}>
                {t('Prix :')} <span className="tabular-nums">{euros(apercu.ancienPrix)}</span> → <span className={`tabular-nums ${corpsFort}`}>{euros(apercu.nouveauPrix)}</span>
              </p>
              <p className={`mt-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                {t('Fin prévue :')} {formatHeure(new Date(apercu.colonnes.ends_at))}. {clientPrevenu ? t('Le client sera prévenu par email.') : t('Le client ne reçoit pas de message.')}
              </p>
              {chevauche && (
                <p className={`mt-2 text-[13.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-ambre)' }}>
                  {t('Attention : le rendez-vous suivant commence à {heure}.', { heure: formatHeure(new Date(debutSuivant!)) })}
                </p>
              )}
            </>
          ) : (
            <p role="alert" className={`text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{apercu.erreur}</p>
          )}
          <div className="mt-2.5 flex gap-2">
            {/* Aperçu refusé : seulement « Retour », pas un bouton grisé sans explication. */}
            {apercu.ok && (
              <button
                type="button"
                onClick={valider}
                disabled={enCours}
                className={`h-11 flex-1 rounded-[var(--v2-radius-bouton)] text-[13.5px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
                style={choix.sens === 'ajout'
                  ? { background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }
                  : { background: 'var(--v2-color-rouge)', color: '#fff' }}
              >
                {enCours ? t('Enregistrement…') : choix.sens === 'ajout' ? t('Ajouter') : t('Retirer')}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setChoix(null); setErreur(null) }}
              className={`h-11 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-4 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
            >
              {t('Retour')}
            </button>
          </div>
        </div>
      )}

      {erreur && <p role="alert" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>}
    </div>
  )
}
