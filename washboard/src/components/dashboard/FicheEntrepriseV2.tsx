'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, MoreHorizontal, Phone, Plus } from 'lucide-react'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, nom } from '@/components/dashboard/PrestationsUiV2'
import type { EntrepriseProfile, Site } from '@/lib/entrepriseProfile'
import type { ResumeClient } from '@/lib/listeClients'
import { rechercherClients } from '@/lib/listeClients'
import {
  ajouterSite, creerEntreprise, modifierEntreprise, modifierSite, rattacherEntreprise, supprimerSite,
} from '@/lib/clientsApi'
import { FUSEAU } from '@/lib/dateUtils'

// Fiche entreprise — proposition de Yanis (canevas du 2026-09-28), construite le même jour.
// Réservée à la PWA installée, comme le reste de Clients (voir ClientsView.tsx).
//
// Toute l'agrégation (chiffre d'affaires, véhicules, derniers passages) vient de
// `buildEntrepriseProfile` (lib/entrepriseProfile.ts), calculée dans le navigateur à partir
// des MÊMES réservations et documents que le reste de l'écran — cet écran n'a sa propre requête
// que pour ce qui n'existe nulle part ailleurs : le nom, le délai de paiement, les sites, et le
// rattachement des contacts (tables `entreprises`, `sites`, `clients.entreprise_id`).
//
// Chaque écriture (site, entreprise, rattachement) se suit d'un `router.refresh()` : les
// données viennent d'un composant serveur (`clients/page.tsx`), pas d'une lecture propre à cet
// écran — même schéma que `ProfilV2.tsx`.
//
// Écart assumé : le total « au total » est TOUT L'HISTORIQUE, pas « cette année » comme le
// canevas de Yanis — aucun autre chiffre de la fiche client ne se borne à l'année en cours
// (`ClientProfile.totalRevenue` non plus), introduire cette seule exception ici aurait été
// incohérent avec le reste du produit.

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

function dateCourte(iso: string, maintenant: number): string {
  const d = new Date(iso)
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }), timeZone: FUSEAU,
  })
}

// ── Rattacher un contact ─────────────────────────────────────────────────────

/** Un contact est un client déjà connu (au moins une réservation ou un document) — voir
 *  l'en-tête de `lib/entrepriseProfile.ts` pour pourquoi on ne peut pas en créer un de zéro
 *  ici. La recherche porte sur le même fichier clients que l'écran Clients. */
function FeuilleAjouterContactV2({
  candidats, onEnregistrer, onClose,
}: {
  candidats: ResumeClient[]
  onEnregistrer: (cle: string, role: string) => Promise<string | null>
  onClose: () => void
}) {
  const [recherche, setRecherche] = useState('')
  const [choisi, setChoisi] = useState<ResumeClient | null>(null)
  const [role, setRole] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const resultats = rechercherClients(candidats, recherche).slice(0, 20)

  async function soumettre() {
    if (!choisi || enCours) return
    setEnCours(true)
    setErreur(null)
    const message = await onEnregistrer(choisi.cle, role)
    setEnCours(false)
    if (message) setErreur(message)
  }

  return (
    <Feuille
      titre="Rattacher un contact"
      sousTitre={choisi ? undefined : 'Choisissez un client déjà connu'}
      onClose={onClose}
      pied={choisi ? (
        <button type="button" onClick={() => void soumettre()} disabled={enCours} className={`${BOUTON} w-full text-white`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
          {enCours ? 'Rattachement…' : 'Rattacher'}
        </button>
      ) : undefined}
    >
      {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      {choisi ? (
        <div className="space-y-4">
          <div className="rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3">
            <p className={`text-[15px] ${nom}`}>{choisi.name}</p>
            <p className={`mt-0.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{choisi.phone || choisi.email}</p>
          </div>
          <div>
            <label htmlFor="role-contact" className={ETIQUETTE}>Son rôle (facultatif)</label>
            <input
              id="role-contact" className={CHAMP} value={role} onChange={e => setRole(e.target.value)}
              placeholder="Chef d’atelier, comptabilité…" maxLength={200}
            />
          </div>
          <button type="button" onClick={() => setChoisi(null)} className={`text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
            Choisir un autre client
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="search" inputMode="search" value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Nom, téléphone, adresse" aria-label="Rechercher un client" className={CHAMP} autoFocus
          />
          {candidats.length === 0 ? (
            <p className={`py-4 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Tous vos clients sont déjà rattachés à une entreprise.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--v2-filet)]">
              {resultats.map(c => (
                <li key={c.cle}>
                  <button type="button" onClick={() => setChoisi(c)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] ${corpsFort} bg-[color:var(--v2-filet)]`}>
                      {initiales(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14.5px] ${nom}`}>{c.name}</span>
                      <span className={`block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{c.phone || c.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Feuille>
  )
}

// ── Ajouter / modifier un site ───────────────────────────────────────────────

function FeuilleSiteV2({
  site, entrepriseId, onEnregistre, onSupprime, onClose,
}: {
  /** `null` : création. */
  site: Site | null
  entrepriseId: string
  onEnregistre: () => void
  onSupprime: () => void
  onClose: () => void
}) {
  const [adresse, setAdresse] = useState(site?.adresse ?? '')
  const [note, setNote] = useState(site?.note ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [suppression, setSuppression] = useState(false)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null)

  async function enregistrer() {
    if (enCours) return
    if (!adresse.trim()) { setErreur('Indiquez l’adresse du site.'); return }
    setEnCours(true)
    setErreur(null)
    const r = site
      ? await modifierSite(site.id, adresse, note)
      : await ajouterSite(entrepriseId, adresse, note)
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    onEnregistre()
  }

  async function confirmerSuppression() {
    if (!site || suppressionEnCours) return
    setSuppressionEnCours(true)
    setSuppressionErreur(null)
    const r = await supprimerSite(site.id)
    setSuppressionEnCours(false)
    if (!r.ok) { setSuppressionErreur(r.message); return }
    onSupprime()
  }

  if (suppression && site) {
    return (
      <ConfirmationSuppression
        titre="Supprimer ce site ?"
        texte="Son adresse et ses instructions d’accès disparaissent."
        enCours={suppressionEnCours}
        erreur={suppressionErreur}
        onConfirmer={() => void confirmerSuppression()}
        onClose={() => setSuppression(false)}
      />
    )
  }

  return (
    <Feuille
      titre={site ? 'Modifier le site' : 'Nouveau site'}
      onClose={onClose}
      pied={
        <button type="button" onClick={() => void enregistrer()} disabled={enCours} className={`${BOUTON} w-full text-white`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      }
    >
      <div className="space-y-4">
        {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        <div>
          <label htmlFor="site-adresse" className={ETIQUETTE}>Adresse</label>
          <AddressAutocomplete value={adresse} onChange={setAdresse} className={CHAMP} placeholder="12 avenue de la Somme, Mérignac" />
        </div>
        <div>
          <label htmlFor="site-note" className={ETIQUETTE}>Instructions d’accès (facultatif)</label>
          <textarea
            id="site-note" value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500}
            placeholder="Parking arrière, point d’eau à droite…"
            className={`w-full min-w-0 resize-none rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 py-2.5 text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
          />
        </div>
        {site && (
          <button type="button" onClick={() => setSuppression(true)} className={`text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-rouge)' }}>
            Supprimer ce site
          </button>
        )}
      </div>
    </Feuille>
  )
}

// ── Modifier le nom / délai de paiement ──────────────────────────────────────

function FeuilleInfosEntrepriseV2({
  id, nom: nomActuel, delaiPaiementJours, onEnregistre, onClose,
}: {
  id: string
  nom: string
  delaiPaiementJours: number | null
  onEnregistre: () => void
  onClose: () => void
}) {
  const [nomSaisi, setNomSaisi] = useState(nomActuel)
  const [delai, setDelai] = useState(delaiPaiementJours !== null ? String(delaiPaiementJours) : '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    if (enCours) return
    if (!nomSaisi.trim()) { setErreur('Indiquez le nom de l’entreprise.'); return }
    setEnCours(true)
    setErreur(null)
    const r = await modifierEntreprise(id, {
      nom: nomSaisi.trim(),
      delaiPaiementJours: delai.trim() ? Number(delai) : null,
    })
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    onEnregistre()
  }

  return (
    <Feuille
      titre="Modifier l’entreprise"
      onClose={onClose}
      pied={
        <button type="button" onClick={() => void enregistrer()} disabled={enCours} className={`${BOUTON} w-full text-white`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      }
    >
      <div className="space-y-4">
        {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        <div>
          <label htmlFor="entreprise-nom" className={ETIQUETTE}>Nom</label>
          <input id="entreprise-nom" className={CHAMP} value={nomSaisi} onChange={e => setNomSaisi(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label htmlFor="entreprise-delai" className={ETIQUETTE}>Délai de paiement, en jours (facultatif)</label>
          <input
            id="entreprise-delai" type="number" inputMode="numeric" min={0} max={3650} className={CHAMP}
            value={delai} onChange={e => setDelai(e.target.value)} placeholder="30"
          />
        </div>
      </div>
    </Feuille>
  )
}

// ── Écran principal ───────────────────────────────────────────────────────────

type SousFeuille =
  | { quoi: 'options' }
  | { quoi: 'infos' }
  | { quoi: 'contact' }
  | { quoi: 'site'; site: Site | null }

export default function FicheEntrepriseV2({
  profil, clientsDisponibles, onOuvrirContact, onClose,
}: {
  profil: EntrepriseProfile
  /** Clients pas encore rattachés à CETTE entreprise — voir `FeuilleAjouterContactV2`. */
  clientsDisponibles: ResumeClient[]
  onOuvrirContact: (cle: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [maintenant] = useState(() => Date.now())
  const [feuille, setFeuille] = useState<SousFeuille | null>(null)
  const { entreprise, sites, contacts, totalRevenue, vehicules, derniersPassages, devisEnAttente } = profil

  function apresEcriture() {
    setFeuille(null)
    router.refresh()
  }

  // Premier contact joignable : c'est lui que le bouton Appeler compose, faute d'un contact
  // « principal » désigné (rien dans le canevas de Yanis ne distingue un contact des autres).
  const premierTelephone = contacts.find(c => c.profile?.phone)?.profile?.phone ?? null

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <button type="button" onClick={onClose} aria-label="Retour à Clients" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]">
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-[24px] leading-none ${titre}`}>{entreprise.nom}</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {sites.length} site{sites.length > 1 ? 's' : ''} · {contacts.length} contact{contacts.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button" onClick={() => setFeuille({ quoi: 'options' })} aria-label="Options de l’entreprise"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
        >
          <MoreHorizontal size={20} strokeWidth={2} />
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-3 mt-3">
        <div className="flex flex-col-reverse">
          <dt className={`m-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>au total</dt>
          <dd className={`m-0 text-[24px] leading-none ${corpsFort} tabular-nums`}>{euros.format(totalRevenue)}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className={`m-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>véhicules</dt>
          <dd className={`m-0 text-[24px] leading-none ${corpsFort} tabular-nums`}>{vehicules}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className={`m-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>paiement</dt>
          <dd className={`m-0 text-[24px] leading-none ${corpsFort} tabular-nums`}>
            {entreprise.delaiPaiementJours !== null ? `${entreprise.delaiPaiementJours} j` : '—'}
          </dd>
        </div>
      </dl>

      {devisEnAttente.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-color-ambre)]/30 bg-[color:var(--v2-color-surface)] px-3.5 py-3">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--v2-color-ambre)' }} aria-hidden />
          <p className={`text-[13px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>
            {devisEnAttente.length === 1 ? (
              <>Le devis envoyé il y a {devisEnAttente[0].jours} j n’a pas eu de réponse.</>
            ) : (
              <>{devisEnAttente.length} devis envoyés sont sans réponse, le plus ancien depuis {devisEnAttente[0].jours} j.</>
            )}
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-2.5">
        {premierTelephone && (
          <a href={`tel:${premierTelephone}`} className={`${BOUTON} flex-1 gap-2 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`} style={PRESSION}>
            <Phone size={16} strokeWidth={2} aria-hidden />
            Appeler
          </a>
        )}
        <a
          href="/dashboard/chiffres/documents?nouveau=1"
          className={`${BOUTON} flex-1 gap-2 text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          <Plus size={16} strokeWidth={2.4} aria-hidden />
          Devis
        </a>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between pb-1.5">
          <h2 className={`text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Contacts</h2>
          <button type="button" onClick={() => setFeuille({ quoi: 'contact' })} className={`text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
            + Contact
          </button>
        </div>
        {contacts.length === 0 ? (
          <p className={`py-3 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>Aucun contact rattaché.</p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] px-4">
            {contacts.map(c => (
              <li key={c.cle}>
                <button type="button" onClick={() => onOuvrirContact(c.cle)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] ${corpsFort} bg-[color:var(--v2-filet)]`}>
                    {initiales(c.profile?.name ?? c.cle)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14.5px] ${nom}`}>{c.profile?.name ?? c.cle}</span>
                    {c.role && <span className={`block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{c.role}</span>}
                  </span>
                  {c.profile?.phone && (
                    <a href={`tel:${c.profile.phone}`} onClick={e => e.stopPropagation()} aria-label={`Appeler ${c.profile.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] hover:bg-[color:var(--v2-filet)]">
                      <Phone size={15} strokeWidth={2} />
                    </a>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between pb-1.5">
          <h2 className={`text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Sites</h2>
          <button type="button" onClick={() => setFeuille({ quoi: 'site', site: null })} className={`text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
            + Site
          </button>
        </div>
        {sites.length === 0 ? (
          <p className={`py-3 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>Aucun site pour l’instant.</p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] px-4">
            {sites.map(s => (
              <li key={s.id}>
                <button type="button" onClick={() => setFeuille({ quoi: 'site', site: s })} className="flex w-full items-start gap-1 py-2.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14.5px] leading-snug ${nom}`}>{s.adresse}</span>
                    {s.note && <span className={`mt-0.5 block text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{s.note}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {derniersPassages.length > 0 && (
        <section className="mt-6 border-t border-[color:var(--v2-filet)] pt-1">
          <h2 className="sr-only">Derniers passages</h2>
          <ol>
            {derniersPassages.slice(0, 10).map(b => (
              <li key={b.id} className="flex items-baseline justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className={`text-[14.5px] ${nom}`}>{b.services?.name ?? 'Prestation'}</span>
                  <span className={`ml-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{dateCourte(b.scheduled_at, maintenant)}</span>
                </span>
                <span className={`shrink-0 text-[14px] ${corpsFort} tabular-nums`}>{b.booked_price ?? b.services?.price ?? 0} €</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {feuille?.quoi === 'options' && (
        <Feuille titre={entreprise.nom} onClose={() => setFeuille(null)}>
          <button
            type="button"
            onClick={() => setFeuille({ quoi: 'infos' })}
            className={`flex h-11 w-full items-center text-left text-[15px] ${corpsFort}`}
          >
            Modifier le nom et le délai de paiement
          </button>
        </Feuille>
      )}

      {feuille?.quoi === 'infos' && (
        <FeuilleInfosEntrepriseV2
          id={entreprise.id} nom={entreprise.nom} delaiPaiementJours={entreprise.delaiPaiementJours}
          onEnregistre={apresEcriture} onClose={() => setFeuille(null)}
        />
      )}

      {feuille?.quoi === 'contact' && (
        <FeuilleAjouterContactV2
          candidats={clientsDisponibles}
          onEnregistrer={async (cle, role) => {
            const r = await rattacherEntreprise(cle, entreprise.id, role)
            if (!r.ok) return r.message
            apresEcriture()
            return null
          }}
          onClose={() => setFeuille(null)}
        />
      )}

      {feuille?.quoi === 'site' && (
        <FeuilleSiteV2
          site={feuille.site} entrepriseId={entreprise.id}
          onEnregistre={apresEcriture} onSupprime={apresEcriture} onClose={() => setFeuille(null)}
        />
      )}
    </div>
  )
}

/** Crée une entreprise puis y rattache le contact — utilisé par la Fiche client quand aucune
 *  entreprise n'existe encore (voir ClientProfileModalV2.tsx, « Rattacher à une entreprise »). */
export async function creerEtRattacher(nomEntreprise: string, cle: string, role: string): Promise<{ id: string } | string> {
  const creation = await creerEntreprise(nomEntreprise, null)
  if (!creation.ok) return creation.message
  const rattachement = await rattacherEntreprise(cle, creation.data.id, role)
  if (!rattachement.ok) return rattachement.message
  return creation.data
}
