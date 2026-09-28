'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import FicheEntrepriseV2 from '@/components/dashboard/FicheEntrepriseV2'
import { buildClientProfile, type ClientBooking, type ClientDocument, type ClientReglages } from '@/lib/clientProfile'
import { listeClients, rechercherClients, type ResumeClient } from '@/lib/listeClients'
import { clientsARelancer, type LigneARelancer, type ReglagesRelance } from '@/lib/clientsARelancer'
import { buildEntrepriseProfile, type EntrepriseListItem } from '@/lib/entrepriseProfile'
import type { RdvMessage } from '@/lib/messagesAutomatiques'
import { FUSEAU } from '@/lib/dateUtils'

// Fichier clients du laveur, présentation v2 — réservée à la PWA installée en
// mode standalone (voir ClientsView.tsx, le point de branchement ; décision
// d'Alexandre, 2026-09-22 : le site reste v1 sans exception). Anciennement
// l'écran pilote de la refonte 2026 (passe 2), à l'intérieur d'un châssis
// (DashboardShell) encore en v1 — voir le compte rendu de la passe pour ce
// que ça donne et pourquoi ce n'est pas rattrapé ici. La logique
// (listeClients, rechercherClients, buildClientProfile, le calcul de
// `maintenant`, l'ouverture de la fiche) n'a pas bougé : seule la
// présentation change, et elle n'est pas dupliquée avec ClientsViewV1.tsx.
//
// Onglet « À relancer » (2026-09-28, proposition de Yanis discutée avec Alexandre) : premier
// morceau d'un vrai CRM, avant les prospects et les fiches entreprise (voir le compte rendu de
// la discussion). Tout son calcul vit dans `lib/clientsARelancer.ts`, qui réutilise la règle
// exacte du cron de relance — cet écran ne fait qu'afficher.

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

type Filtre = 'tous' | 'pros' | 'relancer' | 'entreprises'

/** `ClientBooking` porte déjà tout ce que `RdvMessage` demande (voir son en-tête) — sauf
 *  `client_email` non nullable, alors que le formulaire de réservation ne l'exige pas toujours
 *  d'après son type. Une chaîne vide s'exclut d'elle-même du regroupement par client. */
function versRdvMessage(b: ClientBooking): RdvMessage {
  return {
    id: b.id, client_name: b.client_name, client_email: b.client_email || null, client_phone: b.client_phone,
    scheduled_at: b.scheduled_at, created_at: b.created_at ?? b.scheduled_at, status: b.status,
    is_professional: b.is_professional, company_name: b.company_name, services: b.services,
    followup_sent_at: b.followup_sent_at,
  }
}

export default function ClientsViewV2({ bookings, documents = [], reglages = [], reglagesMessages, entreprises = [] }: {
  bookings: ClientBooking[]
  /** Devis et factures écrits à la main : ils font naître des clients qui n'ont jamais
   *  réservé (Alexandre, 2026-09-27 — « un client comme un autre »). */
  documents?: ClientDocument[]
  /** « Ne plus contacter », écrit à la main (2026-09-28). */
  reglages?: ClientReglages[]
  /** Réglages de relance du laveur : sans eux, pas d'onglet « À relancer » (bookings passés
   *  sans cette prop dans les autres écrans qui réutilisent ClientsViewV2 — aucun aujourd'hui). */
  reglagesMessages?: ReglagesRelance
  /** Fiches entreprise (2026-09-28), sites et contacts déjà joints. */
  entreprises?: EntrepriseListItem[]
}) {
  // L'instant présent, lu une seule fois : le serveur et le navigateur doivent
  // calculer la même liste.
  const [maintenant] = useState(() => Date.now())
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [entrepriseOuverteId, setEntrepriseOuverteId] = useState<string | null>(null)

  const clients = useMemo(
    () => listeClients(bookings, new Date(maintenant), documents, reglages),
    [bookings, documents, reglages, maintenant],
  )
  const pros = useMemo(() => clients.filter(c => c.isProfessional).length, [clients])

  // Qui est déjà rattaché à une entreprise, et à laquelle — pour la Fiche client (menu « … »)
  // et pour exclure ces clients de la liste des contacts à rattacher.
  const entrepriseParCle = useMemo(() => {
    const m = new Map<string, { id: string; nom: string; role: string | null }>()
    for (const e of entreprises) for (const c of e.contacts) m.set(c.cle, { id: e.id, nom: e.nom, role: c.role })
    return m
  }, [entreprises])
  const entreprisesOptions = useMemo(() => entreprises.map(e => ({ id: e.id, nom: e.nom })), [entreprises])
  const entrepriseOuverte = entrepriseOuverteId ? entreprises.find(e => e.id === entrepriseOuverteId) ?? null : null
  const entrepriseProfil = entrepriseOuverte
    ? buildEntrepriseProfile(entrepriseOuverte, entrepriseOuverte.sites, entrepriseOuverte.contacts, bookings, documents, new Date(maintenant), reglages)
    : null
  // Candidats au rattachement : tout le monde sauf les contacts DÉJÀ dans l'entreprise ouverte
  // (un client lié à une AUTRE entreprise reste proposé — le réassigner est permis, juste pas
  // vérifié comme un cas normal, voir `lib/entrepriseProfile.ts`).
  const contactsDisponibles = useMemo(
    () => clients.filter(c => entrepriseParCle.get(c.cle)?.id !== entrepriseOuverteId),
    [clients, entrepriseParCle, entrepriseOuverteId],
  )
  const aRelancer: LigneARelancer[] = useMemo(
    () => reglagesMessages
      ? clientsARelancer(bookings.map(versRdvMessage), reglagesMessages, reglages, maintenant)
      : [],
    [bookings, reglagesMessages, reglages, maintenant],
  )
  const parFiltre = useMemo(
    () => (filtre === 'pros' ? clients.filter(c => c.isProfessional) : clients),
    [clients, filtre],
  )
  const affiches = useMemo(() => rechercherClients(parFiltre, recherche), [parFiltre, recherche])
  const fiche = ouvert ? buildClientProfile(bookings, ouvert, new Date(maintenant), documents, reglages) : null

  // La Fiche entreprise REMPLACE l'écran Clients (comme une destination à part), pas une
  // feuille par-dessus : c'est un fichier en soi (contacts, sites), pas le détail d'une ligne.
  // La Fiche d'UN CONTACT, elle, reste une feuille qui monte par-dessus — cohérent avec le reste
  // de l'écran, et elle sait y revenir (`onOuvrirEntreprise`).
  if (entrepriseProfil) {
    return (
      <>
        <FicheEntrepriseV2
          profil={entrepriseProfil}
          clientsDisponibles={contactsDisponibles}
          onOuvrirContact={cle => { setEntrepriseOuverteId(null); setOuvert(cle) }}
          onClose={() => setEntrepriseOuverteId(null)}
        />
        {fiche && (
          <ClientProfileModal
            profile={fiche}
            onClose={() => setOuvert(null)}
            entrepriseDuContact={entrepriseParCle.get(fiche.cle) ?? null}
            entreprisesDisponibles={entreprisesOptions}
            onOuvrirEntreprise={id => { setOuvert(null); setEntrepriseOuverteId(id) }}
          />
        )}
      </>
    )
  }

  return (
    <div
      className={`max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={`text-[21px] ${titre}`}>Clients</h1>
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1`}>
          {filtre === 'relancer' ? (
            <span className="tabular-nums">{aRelancer.length} client{aRelancer.length > 1 ? 's' : ''} pas revenu{aRelancer.length > 1 ? 's' : ''}</span>
          ) : filtre === 'entreprises' ? (
            <span className="tabular-nums">{entreprises.length} entreprise{entreprises.length > 1 ? 's' : ''}</span>
          ) : clients.length === 0 ? (
            'Vos clients apparaîtront ici dès leur première réservation.'
          ) : pros > 0 ? (
            <span className="tabular-nums">{clients.length} client{clients.length > 1 ? 's' : ''} · {pros} pro{pros > 1 ? 's' : ''}</span>
          ) : (
            <span className="tabular-nums">{clients.length} client{clients.length > 1 ? 's' : ''}</span>
          )}
        </p>
      </div>

      {clients.length > 0 && (
        <>
          {filtre !== 'relancer' && filtre !== 'entreprises' && (
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
          )}

          <div className="flex gap-2 overflow-x-auto">
            {([
              ['tous', 'Tous'],
              ['pros', 'Pros'],
              // Le laveur qui n'a pas encore réglé de relance a quand même le droit de voir qui
              // n'est pas revenu : voir le mode « pas de relance programmée » de clientsARelancer.
              ...(reglagesMessages ? [['relancer', 'À relancer'] as const] : []),
              // Masqué tant qu'aucune entreprise n'existe : un onglet vide n'aiderait personne
              // (Alexandre, 2026-09-28 — sans lui, une entreprise ne se retrouvait qu'en
              // rouvrant le contact qui a servi à la créer).
              ...(entreprises.length > 0 ? [['entreprises', 'Entreprises'] as const] : []),
            ] as const).map(([f, libelle]) => (
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
                {libelle}
              </button>
            ))}
          </div>

          {filtre === 'relancer' ? (
            aRelancer.length === 0 ? (
              <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                Tous vos clients sont revenus, ou n’ont pas encore de quoi être relancés.
              </p>
            ) : (
              <ul aria-label="Clients à relancer" className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] overflow-hidden">
                {aRelancer.map(l => (
                  <LigneARelancerVue key={l.cle} ligne={l} onOuvrir={() => setOuvert(l.cle)} />
                ))}
              </ul>
            )
          ) : filtre === 'entreprises' ? (
            <ul aria-label="Entreprises" className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] overflow-hidden">
              {entreprises.map(e => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEntrepriseOuverteId(e.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[color:var(--v2-filet)] focus:outline-none focus-visible:bg-[color:var(--v2-filet)] transition-colors"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--v2-radius-carte)] text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)]`}>
                      {initiales(e.nom)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] ${nom} truncate`}>{e.nom}</span>
                      <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>
                        {e.contacts.length} contact{e.contacts.length > 1 ? 's' : ''}
                        {e.sites.length > 0 && ` · ${e.sites.length} site${e.sites.length > 1 ? 's' : ''}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
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
                    <LigneClient key={c.cle} client={c} maintenant={maintenant} onOuvrir={() => setOuvert(c.cle)} />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {fiche && (
        <ClientProfileModal
          profile={fiche}
          onClose={() => setOuvert(null)}
          entrepriseDuContact={entrepriseParCle.get(fiche.cle) ?? null}
          entreprisesDisponibles={entreprisesOptions}
          onOuvrirEntreprise={id => { setOuvert(null); setEntrepriseOuverteId(id) }}
        />
      )}
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

/** Couleur du statut : rouge pour ce qui attend un appel maintenant, gris pour ce qui n'attend
 *  plus d'action automatique (relance déjà partie, client qui ne veut plus), vert sinon —
 *  une relance programmée est une bonne nouvelle en soi, elle n'a pas besoin d'un appel. */
function couleurStatut(l: LigneARelancer): string {
  if (l.urgent) return 'text-[color:var(--v2-color-rouge)]'
  if (l.nePlusContacter || l.statut.startsWith('Relancé')) return 'text-[color:var(--v2-color-gris)]'
  return 'text-[color:var(--v2-color-vert)]'
}

function LigneARelancerVue({ ligne: l, onOuvrir }: { ligne: LigneARelancer; onOuvrir: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Voir la fiche de ${l.nom}`}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[color:var(--v2-filet)] focus:outline-none focus-visible:bg-[color:var(--v2-filet)] transition-colors"
      >
        <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)]`}>
          {initiales(l.nom)}
        </span>

        <span className="flex-1 min-w-0">
          <span className={`block text-[15px] ${nom} truncate`}>{l.nom}</span>
          <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5 truncate`}>
            {l.detail}
          </span>
        </span>

        <span className="shrink-0 flex flex-col items-end gap-0.5">
          <span className={`text-[12.5px] ${corpsFort} tabular-nums text-[color:var(--v2-color-gris)]`}>
            {l.jours} j
          </span>
          <span className={`text-[11.5px] ${corpsFort} ${couleurStatut(l)}`}>{l.statut}</span>
        </span>
      </button>
    </li>
  )
}
