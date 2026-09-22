'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import { buildClientProfile, type ClientBooking } from '@/lib/clientProfile'
import { listeClients, rechercherClients, type ResumeClient } from '@/lib/listeClients'
import { FUSEAU } from '@/lib/dateUtils'

// Fichier clients du laveur : chacun de ses clients, sa dernière prestation, et
// une recherche pour le retrouver vite — typiquement au téléphone, quand un
// client rappelle et qu'il faut retrouver ce qu'on lui a fait la dernière fois.
//
// Écran pilote de la refonte 2026 (passe 2) : premier écran en jetons v2,
// à l'intérieur d'un châssis (DashboardShell) encore en v1 — voir le compte
// rendu de la passe pour ce que ça donne et pourquoi ce n'est pas rattrapé
// ici. La logique (listeClients, rechercherClients, buildClientProfile, le
// calcul de `maintenant`, l'ouverture de la fiche) n'a pas bougé : seule la
// présentation change.

// Rôle "corps" (14/450) et "corps fort" (15/550), largeur 100 — planche
// Système. Les tailles en px viennent de `specs/03_Clients.txt` (position et
// taille exactes de chaque ligne de texte de cet écran), pas d'une estimation.
const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

function dateCourte(iso: string, maintenant: number): string {
  const d = new Date(iso)
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }), timeZone: FUSEAU,
  })
}

// Un jour de semaine ("jeudi") pour un rendez-vous proche : c'est ce que lit
// la maquette ("RDV jeudi"). Au-delà d'une semaine, la date courte reste plus
// lisible qu'un jour de semaine ambigu.
function jourCourt(iso: string, maintenant: number): string {
  const diffJours = Math.round((new Date(iso).getTime() - maintenant) / 86_400_000)
  if (diffJours >= 0 && diffJours < 7) {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: FUSEAU })
  }
  return dateCourte(iso, maintenant)
}

// Initiales d'avatar : premier mot + dernier mot, un seul mot sinon. Même
// règle pour une personne ("Claire Martin" → CM) et une entreprise
// ("Garage Renault Mérignac" → GM) — la maquette prend les deux premiers
// mots d'une entreprise ("GR"), une règle propre à cet exemple plutôt que
// généralisable (elle donnerait de moins bons résultats sur un nom à quatre
// mots) : un seul algorithme pour tout le monde plutôt que d'en inventer un
// second pour ce seul cas.
function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

// Le contenu de la ligne secondaire : le contact (pour un pro) puis la
// dernière prestation réellement faite, ou l'état "pas encore" existant.
function ligneSecondaire(c: ResumeClient, maintenant: number): string {
  const contact = c.isProfessional && c.companyName ? c.name : null
  const prestation = c.derniere
    ? `${c.derniere.service} · ${dateCourte(c.derniere.date, maintenant)}`
    : 'Pas encore de prestation faite'
  return [contact, prestation].filter(Boolean).join(' · ')
}

// La pastille de droite : un seul signal par ligne ("un écran = un héros, le
// reste en petit", appliqué à la ligne). Un rendez-vous à venir prime — c'est
// ce qu'il cherche au téléphone — sinon le nombre de lavages, qui existe pour
// tout le monde, y compris 0. Ce que la maquette montre à cet endroit pour
// d'autres lignes (devis en attente, revenu mensuel, jours depuis la
// dernière visite) n'est pas dans les réservations : voir le compte rendu.
function pastilleDroite(c: ResumeClient, maintenant: number): { texte: string; couleur: string } {
  if (c.prochain) {
    return { texte: `RDV ${jourCourt(c.prochain.date, maintenant)}`, couleur: 'text-[color:var(--v2-color-vert)]' }
  }
  return {
    texte: `${c.honoredCount} lavage${c.honoredCount > 1 ? 's' : ''}`,
    couleur: 'text-[color:var(--v2-color-gris)]',
  }
}

type Filtre = 'tous' | 'pros'

export default function ClientsView({ bookings }: { bookings: ClientBooking[] }) {
  // L'instant présent, lu une seule fois : le serveur et le navigateur doivent
  // calculer la même liste.
  const [maintenant] = useState(() => Date.now())
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [ouvert, setOuvert] = useState<string | null>(null)

  const clients = useMemo(() => listeClients(bookings, new Date(maintenant)), [bookings, maintenant])
  const pros = useMemo(() => clients.filter(c => c.isProfessional).length, [clients])
  const parFiltre = useMemo(
    () => (filtre === 'pros' ? clients.filter(c => c.isProfessional) : clients),
    [clients, filtre],
  )
  const affiches = useMemo(() => rechercherClients(parFiltre, recherche), [parFiltre, recherche])
  const fiche = ouvert ? buildClientProfile(bookings, ouvert) : null

  return (
    <div
      className={`max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={`text-[21px] ${titre}`}>Clients</h1>
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1`}>
          {clients.length === 0
            ? 'Vos clients apparaîtront ici dès leur première réservation.'
            : pros > 0
              ? <span className="tabular-nums">{clients.length} client{clients.length > 1 ? 's' : ''} · {pros} pro{pros > 1 ? 's' : ''}</span>
              : <span className="tabular-nums">{clients.length} client{clients.length > 1 ? 's' : ''}</span>}
        </p>
      </div>

      {clients.length > 0 && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--v2-color-gris)] pointer-events-none" aria-hidden />
            <input
              id="recherche-clients"
              type="search"
              inputMode="search"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="Nom, téléphone, adresse"
              aria-label="Rechercher un client"
              autoComplete="off"
              className={`w-full h-11 pl-11 pr-11 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40 [&::-webkit-search-cancel-button]:hidden`}
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche('')}
                aria-label="Effacer la recherche"
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {(['tous', 'pros'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                aria-pressed={filtre === f}
                className={`shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} transition-colors ${
                  filtre === f
                    ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]'
                    : 'bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] border border-[color:var(--v2-filet-fort)]'
                }`}
              >
                {f === 'tous' ? 'Tous' : 'Pros'}
              </button>
            ))}
          </div>

          {(recherche.trim() || affiches.length === 0) && (
            <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`} aria-live="polite">
              {affiches.length === 0
                ? recherche.trim()
                  ? `Aucun client ne correspond à « ${recherche.trim()} ».`
                  : 'Aucun client professionnel pour l’instant.'
                : `${affiches.length} client${affiches.length > 1 ? 's' : ''} trouvé${affiches.length > 1 ? 's' : ''}`}
            </p>
          )}

          {affiches.length > 0 && (
            <ul aria-label="Liste des clients" className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] overflow-hidden">
              {affiches.map(c => (
                <LigneClient key={c.email} client={c} maintenant={maintenant} onOuvrir={() => setOuvert(c.email)} />
              ))}
            </ul>
          )}
        </>
      )}

      {fiche && <ClientProfileModal profile={fiche} onClose={() => setOuvert(null)} />}
    </div>
  )
}

function LigneClient({ client: c, maintenant, onOuvrir }: { client: ResumeClient; maintenant: number; onOuvrir: () => void }) {
  const titreClient = c.isProfessional && c.companyName ? c.companyName : c.name
  const pastille = pastilleDroite(c, maintenant)

  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Voir la fiche de ${titreClient}`}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[color:var(--v2-filet)] focus:outline-none focus-visible:bg-[color:var(--v2-filet)] transition-colors"
      >
        <span
          className={`w-9 h-9 shrink-0 flex items-center justify-center text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)] ${
            c.isProfessional ? 'rounded-[var(--v2-radius-carte)]' : 'rounded-full'
          }`}
        >
          {initiales(titreClient)}
        </span>

        <span className="flex-1 min-w-0">
          <span className={`block text-[15px] ${nom} truncate`}>{titreClient}</span>
          <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>
            {ligneSecondaire(c, maintenant)}
          </span>
        </span>

        <span className={`shrink-0 text-right text-[12.5px] ${corpsFort} tabular-nums ${pastille.couleur}`}>
          {pastille.texte}
        </span>
      </button>
    </li>
  )
}
