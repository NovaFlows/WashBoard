'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import type { ServiceFull } from '@/components/dashboard/CalendrierDashboardV1'
import { VEHICLE_TYPES, type ManualBooking } from '@/hooks/useRendezVousManuel'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'

// Ajout d'un rendez-vous à la main, présentation v2 — réservée à la PWA
// installée (voir CalendrierDashboardV2.tsx). Passe 7, sous-lot 3. Toute la
// logique (validation, capacité d'équipe, avertissement de faisabilité du
// trajet, création) vient de `useRendezVousManuel`
// (`src/hooks/useRendezVousManuel.ts`), la même que celle de
// `CalendrierDashboardV1.tsx` : ce fichier ne contient que de la
// présentation. Mêmes champs, mêmes libellés d'erreur, mêmes obligations
// (l'email reste obligatoire : le rendre facultatif est l'étape 3 du plan CRM,
// un chantier `dev` séparé, pas cette refonte visuelle).
//
// Pas dans la maquette `Agenda.dc.html` : construit avec les conventions v2
// déjà posées. Les titres de section en capitales espacées de v1 disparaissent
// (« titre de section en phrase, ou rien ») au profit de filets et d'espace ;
// les erreurs et l'avertissement de faisabilité sont un point plein + le mot,
// jamais un bandeau pastel — le texte reste en encre : le rouge et l'ambre
// seuls, sur le fond sombre, ne donnent pas un contraste lisible pour du texte.

function Titre({ children }: { children: string }) {
  return <h3 className={`text-[15px] ${corpsFort}`}>{children}</h3>
}

function Champ({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={ETIQUETTE}>{label}</label>
      {children}
    </div>
  )
}

export default function RendezVousManuelV2({
  form,
  setForm,
  services,
  serviceTypes,
  updateManual,
  saving,
  err,
  feasibilityWarn,
  onAnnulerAvertissement,
  onConfirmerQuandMeme,
  onSubmit,
  onClose,
}: {
  form: ManualBooking
  setForm: Dispatch<SetStateAction<ManualBooking | null>>
  services: ServiceFull[]
  serviceTypes: (serviceId: string) => { id: string; name: string }[]
  updateManual: <K extends keyof ManualBooking>(key: K, value: ManualBooking[K]) => void
  saving: boolean
  err: string | null
  feasibilityWarn: string | null
  onAnnulerAvertissement: () => void
  onConfirmerQuandMeme: () => void
  onSubmit: () => void
  onClose: () => void
}) {
  const typesDuService = serviceTypes(form.service_id)
  const optionsType = typesDuService.length > 0
    ? typesDuService.map(t => ({ value: t.id, label: t.name }))
    : VEHICLE_TYPES

  const pied = feasibilityWarn ? (
    <div>
      <p className="flex items-start gap-2">
        <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-ambre)' }} aria-hidden />
        <span className={`text-[14.5px] ${corpsFort}`}>Problème de faisabilité détecté</span>
      </p>
      <p role="alert" className={`mt-1 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>{feasibilityWarn}</p>
      <p className={`mt-2 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Créer ce rendez-vous quand même ?</p>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={onAnnulerAvertissement}
          className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
          style={PRESSION}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirmerQuandMeme}
          disabled={saving}
          className={`${BOUTON} flex-1 text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          {saving ? 'Création…' : 'Créer quand même'}
        </button>
      </div>
    </div>
  ) : (
    <div>
      {err && (
        <p role="alert" className="mb-3 flex items-start gap-2">
          <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-rouge)' }} aria-hidden />
          <span className={`text-[14px] ${corpsFort}`}>{err}</span>
        </p>
      )}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
          style={PRESSION}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className={`${BOUTON} flex-[1.6] text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          {saving ? 'Création…' : 'Créer le rendez-vous'}
        </button>
      </div>
    </div>
  )

  return (
    <Feuille titre="Nouveau rendez-vous" onClose={onClose} fermerSurFond={false} pied={pied}>
      <div className="space-y-6">
        <section className="space-y-3">
          <Titre>Quand</Titre>
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <Champ id="rdvm-date" label="Date">
                <input id="rdvm-date" type="date" value={form.date} onChange={e => updateManual('date', e.target.value)} className={CHAMP} />
              </Champ>
            </div>
            <div className="w-32 shrink-0">
              <Champ id="rdvm-heure" label="Heure">
                <input id="rdvm-heure" type="time" value={form.time} onChange={e => updateManual('time', e.target.value)} className={CHAMP} />
              </Champ>
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-[color:var(--v2-filet)] pt-5">
          <Titre>Prestation</Titre>
          <Champ id="rdvm-service" label="Service">
            <select id="rdvm-service" value={form.service_id} onChange={e => updateManual('service_id', e.target.value)} className={CHAMP}>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.price}€</option>)}
            </select>
          </Champ>
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <Champ id="rdvm-type" label="Type">
                <select id="rdvm-type" value={form.vehicle_type} onChange={e => updateManual('vehicle_type', e.target.value)} className={CHAMP}>
                  {optionsType.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </Champ>
            </div>
            <div className="w-24 shrink-0">
              <Champ id="rdvm-qte" label="Quantité">
                <input
                  id="rdvm-qte"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={form.vehicle_count}
                  onChange={e => updateManual('vehicle_count', Math.max(1, parseInt(e.target.value) || 1))}
                  className={CHAMP}
                />
              </Champ>
            </div>
          </div>
          <Champ id="rdvm-prix" label="Prix total (€)">
            <input
              id="rdvm-prix"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={form.booked_price}
              onChange={e => updateManual('booked_price', parseFloat(e.target.value) || 0)}
              className={CHAMP}
            />
            <p className={`mt-1.5 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>Calculé automatiquement, modifiable.</p>
          </Champ>
        </section>

        <section className="space-y-3 border-t border-[color:var(--v2-filet)] pt-5">
          <Titre>Client</Titre>
          <Champ id="rdvm-nom" label="Nom complet *">
            <input
              id="rdvm-nom"
              type="text"
              autoComplete="off"
              placeholder="Jean Dupont"
              value={form.client_name}
              onChange={e => updateManual('client_name', e.target.value)}
              className={CHAMP}
            />
          </Champ>
          <Champ id="rdvm-email" label="Email *">
            <input
              id="rdvm-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="jean@exemple.com"
              value={form.client_email}
              onChange={e => updateManual('client_email', e.target.value)}
              className={CHAMP}
            />
          </Champ>
          <Champ id="rdvm-tel" label="Téléphone *">
            <input
              id="rdvm-tel"
              type="tel"
              autoComplete="off"
              placeholder="06 00 00 00 00"
              value={form.client_phone}
              onChange={e => updateManual('client_phone', e.target.value)}
              className={CHAMP}
            />
          </Champ>
          <div role="group" aria-labelledby="rdvm-adresse-label">
            <p id="rdvm-adresse-label" className={ETIQUETTE}>Adresse d’intervention *</p>
            <AddressAutocomplete
              value={form.address}
              onChange={v => updateManual('address', v)}
              onSelectWithCoords={(label, lat, lng) => setForm(m => (m ? { ...m, address: label, lat, lng } : m))}
              placeholder="12 rue de la Paix, 75001 Paris"
              className={CHAMP}
            />
          </div>
        </section>

        <section className="border-t border-[color:var(--v2-filet)] pt-3">
          <button
            type="button"
            role="switch"
            aria-checked={form.is_professional}
            onClick={() => updateManual('is_professional', !form.is_professional)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
          >
            <span className={`text-[15px] ${corpsFort}`}>Client professionnel</span>
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
              style={{
                background: form.is_professional ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)',
                transitionDuration: 'var(--v2-duration-press)',
                transitionTimingFunction: 'var(--v2-ease-out)',
              }}
            >
              <span
                className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform"
                style={{
                  transform: form.is_professional ? 'translateX(23px)' : 'translateX(3px)',
                  transitionDuration: 'var(--v2-duration-press)',
                  transitionTimingFunction: 'var(--v2-ease-out)',
                }}
              />
            </span>
          </button>
          {form.is_professional && (
            <div className="mt-2 space-y-3">
              <Champ id="rdvm-societe" label="Nom de l’entreprise">
                <input
                  id="rdvm-societe"
                  type="text"
                  placeholder="Ma Société SAS"
                  value={form.company_name}
                  onChange={e => updateManual('company_name', e.target.value)}
                  className={CHAMP}
                />
              </Champ>
              <Champ id="rdvm-siret" label="SIRET (14 chiffres)">
                <input
                  id="rdvm-siret"
                  type="text"
                  inputMode="numeric"
                  placeholder="12345678901234"
                  value={form.siret}
                  onChange={e => updateManual('siret', e.target.value.replace(/\D/g, '').slice(0, 14))}
                  className={`${CHAMP} tabular-nums`}
                />
              </Champ>
              <Champ id="rdvm-facturation" label="Adresse de facturation">
                <input
                  id="rdvm-facturation"
                  type="text"
                  placeholder="Identique à l’adresse d’intervention si vide"
                  value={form.billing_address}
                  onChange={e => updateManual('billing_address', e.target.value)}
                  className={CHAMP}
                />
              </Champ>
            </div>
          )}
        </section>

        <section className="space-y-3 border-t border-[color:var(--v2-filet)] pt-5">
          <Titre>Statut et notes</Titre>
          <div>
            <p className={ETIQUETTE} id="rdvm-statut-label">Statut initial</p>
            <div className="flex gap-2.5" role="radiogroup" aria-labelledby="rdvm-statut-label">
              {(['confirmed', 'pending'] as const).map(s => {
                const actif = form.status === s
                const couleur = s === 'confirmed' ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)'
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => updateManual('status', s)}
                    className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border text-[15px] ${corpsFort} transition-transform active:scale-[.97] ${
                      actif
                        ? 'border-[color:var(--v2-color-encre)] text-[color:var(--v2-color-encre)]'
                        : 'border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]'
                    }`}
                    style={PRESSION}
                  >
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />
                    {s === 'confirmed' ? 'Confirmé' : 'En attente'}
                  </button>
                )
              })}
            </div>
          </div>
          <Champ id="rdvm-notes" label="Notes internes">
            <textarea
              id="rdvm-notes"
              rows={2}
              placeholder="Code portail, instructions particulières…"
              value={form.notes}
              onChange={e => updateManual('notes', e.target.value)}
              className={`${CHAMP} h-auto py-2.5 resize-none`}
            />
          </Champ>
        </section>
      </div>
    </Feuille>
  )
}
