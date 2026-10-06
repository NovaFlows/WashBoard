'use client'

import { useMemo, useState } from 'react'
import type { ClientBooking } from '@/lib/clientProfile'
import type { Device } from '@/lib/funnelTracking'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ChiffresArgent from '@/components/dashboard/ChiffresArgent'
import ChiffresAcquisition from '@/components/dashboard/ChiffresAcquisition'
import ChiffresClients from '@/components/dashboard/ChiffresClients'
import { OffreVerrouilleeV2 } from '@/components/dashboard/OffreVerrouilleeV2'
import SelecteurPeriodeV2 from '@/components/dashboard/SelecteurPeriodeV2'
import { aujourdhuiParis, type PeriodeChiffres } from '@/lib/chiffresPeriode'
import type { FactureManuelle } from '@/lib/chiffresArgent'

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
// garde-fou qui réserve cette route à la PWA installée et, depuis le
// 2026-10-06, au site sur grand écran avec `washer.beta_refonte` actif.
//
// La PÉRIODE (type + jour de référence, flèches précédent/suivant) vit ICI,
// pas dans un onglet : un seul sélecteur pour Argent, Acquisition et Clients,
// et elle survit au changement d'onglet (les onglets sont démontés/remontés,
// leur état local non). Décision d'Alexandre, 2026-09-24 : les graphiques
// doivent suivre la période. Défaut : le mois en cours, à l'heure de Paris.
//
// PASSE BUREAU (2026-10-06) : cet écran RESPIRE au-delà de `useGrandEcran()`
// (260px + large colonne), comme ClientsViewV2.tsx — même raisonnement, pas
// de troisième fichier (voir son en-tête) : les trois onglets gardent la même
// architecture d'information, ils ont simplement plus de place. Monté à la
// fois par la PWA (toute largeur) et, depuis cette passe, par le SITE sur
// grand écran avec `washer.beta_refonte` actif — voir Chiffres.tsx, le
// garde-fou, qui décide lequel des deux publics atteint ce composant.

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
  /** Factures écrites à la main et marquées payées : elles complètent l'encaissé de l'onglet
   *  Argent, et n'entrent nulle part ailleurs (l'onglet Clients compte les réservations). */
  facturesManuelles?: FactureManuelle[]
  events: ChiffresEvent[]
  websiteHost?: string
  /** Acquisition et Clients (Starter et au-dessus). */
  hasCrm: boolean
  /** Le chiffre d'affaires (Starter et au-dessus). */
  hasCa: boolean
  /** La comptabilité : dépenses, résultat, factures (Pro et au-dessus). */
  hasCompta: boolean
  facturesCount: number
  /** Factures écrites à la main, pas encore marquées payées (`estPayee()`, `lib/documents.ts`).
   *  Colonne de gauche de l'onglet Argent sur grand écran (écran 7 de la maquette) — absent de
   *  la présentation mobile, qui ne montrait déjà pas ce nombre avant cette passe. */
  facturesImpayees?: number
  /** Début (ISO) de la fenêtre de visites chargée : avant, pas de donnée. */
  evenementsDepuis?: string | null
  /** La lecture des réservations / des visites a échoué en cours de route. */
  reservationsIncompletes?: boolean
  evenementsIncomplets?: boolean
}

export default function ChiffresV2({
  bookings, facturesManuelles, events, websiteHost, hasCrm, hasCa, hasCompta, facturesCount,
  facturesImpayees, evenementsDepuis, reservationsIncompletes, evenementsIncomplets,
}: ChiffresProps) {
  const [onglet, setOnglet] = useState<Onglet>('argent')
  // Lu une seule fois : tout l'écran calcule sur le même « maintenant ».
  const [maintenant] = useState(() => Date.now())
  const aujourdhui = useMemo(() => aujourdhuiParis(maintenant), [maintenant])
  const [periode, setPeriode] = useState<PeriodeChiffres>(() => ({ type: 'mois', ref: aujourdhuiParis(maintenant) }))
  // Qui voit la disposition à deux colonnes : UNIQUEMENT une largeur ≥ `SEUIL_GRAND_ECRAN_PX`
  // (1024px, `grandEcran.ts`) — même garde que ClientsViewV2.tsx. `Chiffres.tsx` a déjà décidé
  // plus haut si cet écran se montre du tout (PWA, ou site + grand écran + `washer.beta_refonte`) ;
  // ici la seule question est « ai-je la place ».
  const grandEcran = useGrandEcran()

  const ongletsPills = (
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
  )
  const selecteurPeriode = <SelecteurPeriodeV2 periode={periode} aujourdhui={aujourdhui} onChange={setPeriode} />

  return (
    <div
      className={`${grandEcran ? '' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6'} space-y-5 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={`text-[21px] ${titre}`}>Chiffres</h1>
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1`}>
          Argent, acquisition et clients — au même endroit
        </p>
      </div>

      {/* Bureau : les onglets et la période partagent une ligne (écran 7/8/40 de la maquette) —
          mobile : deux lignes empilées, inchangé (un `<div>` enrobant les deux pour le cas
          bureau aurait cassé le `space-y-5` du conteneur en mobile — les deux lignes ne sont
          plus des enfants directs du même parent — d'où le `<Fragment>` qui ne touche pas au
          DOM). La ligne Jour/Semaine/Mois/Année de `SelecteurPeriodeV2` reste visible dans les
          deux cas : la maquette ne montre que le mois sur ses captures bureau, mais retirer les
          trois autres granularités aurait coupé une fonction réelle pour un seul pixel-match —
          déviation assumée, voir le rapport. */}
      {grandEcran ? (
        <div className="flex items-start justify-between gap-6">
          {ongletsPills}
          <div className="shrink-0">{selecteurPeriode}</div>
        </div>
      ) : (
        <>
          {ongletsPills}
          {selecteurPeriode}
        </>
      )}

      {onglet === 'argent' && (
        <ChiffresArgent
          hasCa={hasCa}
          hasCompta={hasCompta}
          facturesCount={facturesCount}
          facturesImpayees={facturesImpayees}
          bookings={bookings}
          facturesManuelles={facturesManuelles}
          periode={periode}
          maintenant={maintenant}
          reservationsIncompletes={reservationsIncompletes}
          grandEcran={grandEcran}
        />
      )}
      {onglet === 'acquisition' && !hasCrm && (
        <OffreVerrouilleeV2
          titre="Sachez d’où viennent vos clients"
          description="Visites de votre page, réservations, sources : tout ce qui mène à un rendez-vous."
          feature="crm"
        />
      )}
      {onglet === 'clients' && !hasCrm && (
        <OffreVerrouilleeV2
          titre="Connaissez vos clients"
          description="Vos meilleurs clients, ceux à relancer, la part de pros et de particuliers."
          feature="crm"
        />
      )}
      {onglet === 'acquisition' && hasCrm && (
        <ChiffresAcquisition
          events={events}
          websiteHost={websiteHost}
          periode={periode}
          maintenant={maintenant}
          evenementsDepuis={evenementsDepuis}
          evenementsIncomplets={evenementsIncomplets}
          grandEcran={grandEcran}
        />
      )}
      {onglet === 'clients' && hasCrm && (
        <ChiffresClients
          bookings={bookings}
          periode={periode}
          maintenant={maintenant}
          reservationsIncompletes={reservationsIncompletes}
          grandEcran={grandEcran}
        />
      )}
    </div>
  )
}
