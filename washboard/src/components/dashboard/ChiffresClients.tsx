'use client'

import { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import { buildClientProfile } from '@/lib/clientProfile'
import { formaterJour, type PeriodeChiffres } from '@/lib/chiffresPeriode'
import { reservationsDeLaPeriode, statsClients, type FiltreClients } from '@/lib/chiffresClients'
import { repartitionSources } from '@/lib/sourceDecouverte'
import { finitAvant, premierJourDeDonnee } from '@/lib/chiffresArgent'
import type { ChiffresBooking } from '@/components/dashboard/ChiffresV2'

// Onglet « Clients » de Chiffres (refonte 2026, passe 5, repris au
// 2026-09-24). Reprend `listeClients`/`buildClientProfile` (déjà utilisés par
// l'écran Clients v2 et par l'ancien CRM) plutôt que d'écrire un nouveau calcul
// par client — aucune requête supplémentaire, les réservations sont déjà
// chargées par `page.tsx` (page par page : jamais tronquées).
//
// La période est celle de l'écran (choisie dans ChiffresV2, partagée avec les
// deux autres onglets) : les clients « actifs », leur valeur moyenne, le
// classement et la part des pros portent sur les rendez-vous de la période
// (jours de Paris). Le filtre Tous / Particuliers / Pros porte sur
// `is_professional` de chaque réservation, comme l'ancien CRM — voir
// `chiffresClients.ts`.
//
// Définition du chiffre d'affaires : celle du CRM (confirmé + terminé, prix
// `booked_price ?? services.price`), PAS celle de l'onglet Argent (terminé
// seulement, net de remise). Les deux totaux peuvent donc différer ; la ligne
// de bas de page le dit.
//
// Portée volontairement réduite par rapport à la maquette
// (`project/ChiffresClients.dc.html`), signalé dans le compte rendu de la
// passe :
// - pas de cohortes « reviennent, par mois d'arrivée » ni de « gagnés/perdus
//   ce mois » : calculer ces cohortes correctement (fenêtre glissante de
//   6 mois par client, cas des mois trop récents pour conclure) est une
//   vraie nouvelle logique métier, pas une présentation d'une donnée déjà
//   calculée ailleurs — hors du principe « garde la logique, remplace la
//   présentation » de cette refonte ;
// - pas de section « Les relances qui marchent » : rien dans la base
//   n'enregistre aujourd'hui le canal d'une relance ni si le client est
//   revenu grâce à elle (voir `.claude/agents/refonte.md`, « Les deux
//   automatismes de message » — cette liaison fait partie de l'étape 4 du
//   plan CRM, pas encore construite). Afficher un faux taux de retour aurait
//   été pire que ne rien afficher.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const euros = (v: number) => `${nombre.format(Math.round(v))} €`

const FILTRES: { cle: FiltreClients; libelle: string }[] = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'particuliers', libelle: 'Particuliers' },
  { cle: 'pros', libelle: 'Pros' },
]

export default function ChiffresClients({ bookings, periode, maintenant, reservationsIncompletes, grandEcran }: {
  bookings: ChiffresBooking[]
  periode: PeriodeChiffres
  maintenant: number
  reservationsIncompletes?: boolean
  /** `useGrandEcran()`, lu une seule fois par ChiffresV2 et partagé entre les trois onglets.
   *  Bascule entre la pile mobile (inchangée) et les deux colonnes de l'écran 40 de la
   *  maquette (260px héros + détail à gauche, meilleurs clients + relances à droite). */
  grandEcran?: boolean
}) {
  const [filtre, setFiltre] = useState<FiltreClients>('tous')
  const [ouvert, setOuvert] = useState<string | null>(null)

  const stats = useMemo(
    () => statsClients(bookings, periode, filtre, new Date(maintenant)),
    [bookings, periode, filtre, maintenant],
  )
  const premierJour = useMemo(() => premierJourDeDonnee(bookings), [bookings])
  const sources = useMemo(() => {
    const dePeriode = reservationsDeLaPeriode(bookings, periode)
    return { ...repartitionSources(dePeriode), total: dePeriode.length }
  }, [bookings, periode])

  const fiche = ouvert ? buildClientProfile(bookings, ouvert) : null
  const libelleFiltre = filtre === 'pros' ? 'professionnel' : filtre === 'particuliers' ? 'particulier' : ''

  // Blocs partagés par les deux dispositions — seule leur RÉPARTITION change entre mobile
  // (empilés, inchangé) et grand écran (écran 40 de la maquette : héros + détail à gauche,
  // meilleurs clients + relances à droite).

  const blocHero = (
    <div className="flex flex-col gap-[3px]">
      <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Valeur moyenne par client</span>
      <span className={`${grandEcran ? 'text-[50px]' : 'text-[44px] sm:text-[52px]'} leading-none ${hero}`}>{euros(stats.valeurMoyenne)}</span>
      <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
        sur {nombre.format(stats.actifs.length)} client{stats.actifs.length > 1 ? 's' : ''} actif{stats.actifs.length > 1 ? 's' : ''} sur la période
      </span>
    </div>
  )

  const blocMeilleursClients = (
    <div>
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Vos meilleurs clients</span>
        <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          {Math.round((stats.meilleurs.reduce((s, c) => s + c.totalRevenue, 0) / (stats.totalCA || 1)) * 100)} % du chiffre d’affaires
        </span>
      </div>
      <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 divide-y divide-[color:var(--v2-filet)]">
        {stats.meilleurs.map((c, i) => {
          const titreClient = c.isProfessional && c.companyName ? c.companyName : c.name
          const part = stats.totalCA > 0 ? Math.round((c.totalRevenue / stats.totalCA) * 100) : 0
          return (
            <button
              key={c.email}
              type="button"
              onClick={() => setOuvert(c.email)}
              aria-label={`Voir la fiche de ${titreClient}`}
              className="w-full min-h-11 grid grid-cols-[18px_1fr_auto_40px] gap-2.5 items-center py-2.5 text-left"
            >
              <span className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{i + 1}</span>
              <span className="min-w-0 flex items-center gap-1.5">
                {c.isProfessional && <Building2 size={13} strokeWidth={2} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />}
                <span className={`text-[14.5px] ${corpsFort} truncate`}>{titreClient}</span>
              </span>
              <span className={`text-[14.5px] ${corpsFort} tabular-nums text-right`}>{euros(c.totalRevenue)}</span>
              <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] text-right`}>{part} %</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const blocProSplit = filtre === 'tous' && (
    <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed px-1`}>
      Les clients professionnels font {stats.partCaPro} % du chiffre d’affaires pour {stats.partRdvPro} % des rendez-vous.
    </p>
  )

  const blocDefinitionCa = (
    <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed px-1`}>
      Ici, le chiffre d’affaires compte les rendez-vous confirmés et terminés ; l’onglet Argent ne compte que les terminés, remises déduites.
    </p>
  )

  const blocRelances = (
    <div className="rounded-[var(--v2-radius-surface)] border border-dashed border-[color:var(--v2-filet-fort)] px-4 py-3.5">
      <p className={`text-[13px] ${corpsFort}`}>Les relances qui marchent</p>
      <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed mt-1`}>
        Pas encore suivi : WashBoard ne relie pas encore une relance envoyée à son canal et à son résultat. Réglages actuels dans Plus › Messages automatiques.
      </p>
    </div>
  )

  return (
    <div className="space-y-5">
      {reservationsIncompletes && (
        <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-ambre)]`} role="status">
          Une partie de vos rendez-vous n’a pas pu être chargée : ces chiffres peuvent être incomplets.
        </p>
      )}

      {sources.reponses > 0 && (
        <div>
          <div className="flex items-baseline justify-between px-0.5 pb-2">
            <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>D’où viennent vos clients</span>
            <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {nombre.format(sources.reponses)} réponse{sources.reponses > 1 ? 's' : ''} sur {nombre.format(sources.total)} rendez-vous
            </span>
          </div>
          <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 divide-y divide-[color:var(--v2-filet)]">
            {sources.lignes.map(l => (
              <div key={l.valeur} className="grid grid-cols-[1fr_auto] gap-2.5 items-center py-2.5">
                <span className={`text-[14.5px] ${corpsFort}`}>{l.libelle}</span>
                <span className={`text-[14.5px] ${corpsFort} tabular-nums text-right`}>
                  {nombre.format(l.nombre)} · {Math.round((l.nombre / sources.reponses) * 100)} %
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Type de client">
        {FILTRES.map(f => (
          <button
            key={f.cle}
            type="button"
            aria-pressed={filtre === f.cle}
            onClick={() => setFiltre(f.cle)}
            className={`shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} transition-colors ${
              filtre === f.cle
                ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border border-[color:var(--v2-color-encre)]'
                : 'bg-transparent text-[color:var(--v2-color-gris)] border border-[color:var(--v2-filet-fort)]'
            }`}
          >
            {f.libelle}
          </button>
        ))}
      </div>

      {stats.actifs.length === 0 ? (
        <>
          <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed`} aria-live="polite">
            {finitAvant(periode, premierJour)
              ? `Pas de données avant le ${formaterJour(premierJour!)}, date de votre premier rendez-vous.`
              : `Aucune prestation honorée${libelleFiltre ? ` pour un client ${libelleFiltre}` : ''} sur cette période.`}
          </p>
          {blocRelances}
        </>
      ) : grandEcran ? (
        // Grand écran (écran 40 de la maquette) : héros + détail dans la colonne étroite,
        // meilleurs clients + relances dans la matière large.
        <div className="grid gap-[26px]" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div className="flex flex-col gap-[14px]">
            {blocHero}
            {blocProSplit}
            {blocDefinitionCa}
          </div>
          <div className="space-y-5">
            {blocMeilleursClients}
            {blocRelances}
          </div>
        </div>
      ) : (
        <>
          {blocHero}
          {blocMeilleursClients}
          {blocProSplit}
          {blocDefinitionCa}
          {blocRelances}
        </>
      )}

      {fiche && <ClientProfileModal profile={fiche} onClose={() => setOuvert(null)} />}
    </div>
  )
}
