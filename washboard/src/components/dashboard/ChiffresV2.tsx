'use client'

import { useMemo, useState } from 'react'
import type { ClientBooking } from '@/lib/clientProfile'
import type { Device } from '@/lib/funnelTracking'
import ChiffresArgent from '@/components/dashboard/ChiffresArgent'
import ChiffresAcquisition from '@/components/dashboard/ChiffresAcquisition'
import ChiffresClients from '@/components/dashboard/ChiffresClients'
import SelecteurPeriodeV2 from '@/components/dashboard/SelecteurPeriodeV2'
import { aujourdhuiParis, type PeriodeChiffres } from '@/lib/chiffresPeriode'

// « Chiffres » — refonte 2026, passe 5. Fusionne l'ancien CRM
// (visiteurs/entonnoir/sources, aujourd'hui /dashboard/crm) et la
// Comptabilité (CA/dépenses/résultat, aujourd'hui /dashboard/compta) en trois
// onglets d'un même écran — planche `project/Chiffres*.dc.html` de la
// maquette v2. Le mot « CRM » n'apparaît nulle part ici : voir
// `.claude/agents/refonte.md`, « il ne veut rien dire pour un laveur ».
//
// /dashboard/crm et /dashboard/compta ne bougent pas : ce sont des écrans
// séparés, avec leur logique de données propre (`CrmDashboard.tsx`,
// `ComptaDashboard.tsx`), toujours atteignables depuis le menu latéral. Cet
// écran ne les remplace pas, il vit à côté — voir Chiffres.tsx pour le
// garde-fou qui réserve cette route à la PWA installée.
//
// La PÉRIODE (type + jour de référence, flèches précédent/suivant) vit ICI,
// pas dans un onglet : un seul sélecteur pour Argent, Acquisition et Clients,
// et elle survit au changement d'onglet (les onglets sont démontés/remontés,
// leur état local non). Décision d'Alexandre, 2026-09-24 : les graphiques
// doivent suivre la période. Défaut : le mois en cours, à l'heure de Paris.

export type ChiffresBooking = ClientBooking & {
  // Lus par le calcul de l'encaissé (`revenuNet`) ; la page charge `*`, mais
  // `ClientBooking` ne les déclarait pas.
  smart_discount?: number | null
  is_smart_slot?: boolean | null
}
export type ChiffresEvent = {
  step: 'prestation' | 'options' | 'creneau' | 'coordonnees' | 'confirmation'
  session_id: string
  created_at: string
  referrer_host?: string | null
  device?: Device | null
}

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

type Onglet = 'argent' | 'acquisition' | 'clients'

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'argent', libelle: 'Argent' },
  { cle: 'acquisition', libelle: 'Acquisition' },
  { cle: 'clients', libelle: 'Clients' },
]

export type ChiffresProps = {
  bookings: ChiffresBooking[]
  events: ChiffresEvent[]
  websiteHost?: string
  hasCompta: boolean
  comptaPlanLabel: string
  facturesCount: number
  /** Début (ISO) de la fenêtre de visites chargée : avant, pas de donnée. */
  evenementsDepuis?: string | null
  /** La lecture des réservations / des visites a échoué en cours de route. */
  reservationsIncompletes?: boolean
  evenementsIncomplets?: boolean
}

export default function ChiffresV2({
  bookings, events, websiteHost, hasCompta, comptaPlanLabel, facturesCount,
  evenementsDepuis, reservationsIncompletes, evenementsIncomplets,
}: ChiffresProps) {
  const [onglet, setOnglet] = useState<Onglet>('argent')
  // Lu une seule fois : tout l'écran calcule sur le même « maintenant ».
  const [maintenant] = useState(() => Date.now())
  const aujourdhui = useMemo(() => aujourdhuiParis(maintenant), [maintenant])
  const [periode, setPeriode] = useState<PeriodeChiffres>(() => ({ type: 'mois', ref: aujourdhuiParis(maintenant) }))

  return (
    <div
      className={`max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={`text-[21px] ${titre}`}>Chiffres</h1>
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1`}>
          Argent, acquisition et clients — au même endroit
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Chiffres">
        {ONGLETS.map(o => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={onglet === o.cle}
            onClick={() => setOnglet(o.cle)}
            className={`shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} transition-colors ${
              onglet === o.cle
                ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border border-[color:var(--v2-color-encre)]'
                : 'bg-transparent text-[color:var(--v2-color-gris)] border border-[color:var(--v2-filet-fort)]'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <SelecteurPeriodeV2 periode={periode} aujourdhui={aujourdhui} onChange={setPeriode} />

      {onglet === 'argent' && (
        <ChiffresArgent
          hasCompta={hasCompta}
          comptaPlanLabel={comptaPlanLabel}
          facturesCount={facturesCount}
          bookings={bookings}
          periode={periode}
          maintenant={maintenant}
          reservationsIncompletes={reservationsIncompletes}
        />
      )}
      {onglet === 'acquisition' && (
        <ChiffresAcquisition
          events={events}
          websiteHost={websiteHost}
          periode={periode}
          maintenant={maintenant}
          evenementsDepuis={evenementsDepuis}
          evenementsIncomplets={evenementsIncomplets}
        />
      )}
      {onglet === 'clients' && (
        <ChiffresClients
          bookings={bookings}
          periode={periode}
          maintenant={maintenant}
          reservationsIncompletes={reservationsIncompletes}
        />
      )}
    </div>
  )
}
