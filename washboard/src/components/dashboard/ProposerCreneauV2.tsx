'use client'

import { useMemo, useState } from 'react'
import type { ClientBooking } from '@/lib/clientProfile'
import { listeClients, rechercherClients, type ResumeClient } from '@/lib/listeClients'
import { whatsappDigits } from '@/lib/phone'
import { formatHeure } from '@/lib/calendarLayout'
import { Feuille, CHAMP, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import type { Booking } from '@/components/dashboard/CalendrierDashboardV1'

// « Proposer » un créneau libre de l'agenda v2 à un client, par message —
// demande d'Alexandre du 2026-09-24. La ligne « X de libre » de
// CalendrierDashboardV2.tsx pointe ici. La maquette (`project/Agenda.dc.html`)
// montre un lien « Proposer » sur cette ligne sans dire vers quoi ; le sous-lot
// 3 de la passe 7 l'avait donc laissé sans action (voir son grand commentaire
// d'en-tête, « Ce que ce sous-lot ne fait pas »).
//
// Ce que fait cet écran, et seulement ça : lister les clients du laveur
// (réutilise `listeClients`/`rechercherClients`, déjà utilisés par
// ClientsViewV2.tsx — aucun nouveau calcul), laisser en choisir un, puis
// ouvrir WhatsApp ou l'app SMS du téléphone avec un message déjà écrit,
// modifiable avant envoi. Rien n'est envoyé depuis WashBoard : ce sont des
// liens `wa.me` / `sms:`, exactement comme les boutons Appeler/Message de
// ClientProfileModalV2.tsx. Aucune écriture en base, aucune route API.

/** `bookings` arrive au format `Booking` de l'agenda (CalendrierDashboardV1.tsx),
 *  pas `ClientBooking` (clientProfile.ts) qu'attend `listeClients` : l'agenda ne
 *  charge pas `company_name`, un champ que cet écran n'affiche de toute façon
 *  pas (le message tutoie le prénom du contact, jamais l'entreprise). Adapté
 *  champ à champ, avec un repli pour ce qui manque ou est optionnel côté
 *  agenda ; aucune requête ajoutée. */
function versClientBooking(b: Booking): ClientBooking {
  return {
    id: b.id,
    client_name: b.client_name,
    client_email: b.client_email,
    client_phone: b.client_phone,
    address: b.address,
    scheduled_at: b.scheduled_at,
    status: b.status,
    closed_late: b.closed_late ?? false,
    booked_price: b.booked_price,
    is_professional: b.is_professional ?? false,
    company_name: null,
    services: b.services ? { name: b.services.name, price: b.services.price, duration_minutes: b.services.duration_minutes } : null,
  }
}

/** Premier prénom d'un nom complet, pour le tutoiement du message — jamais un
 *  nom de famille accolé (« Julie Martin » → « Julie »). */
function prenom(nomComplet: string): string {
  const p = nomComplet.trim().split(/\s+/)[0]
  return p || nomComplet
}

/** Message suggéré, court, modifiable avant envoi dans WhatsApp/SMS — décision
 *  d'Alexandre du 2026-09-24 (« Proposer » n'avait pas de comportement défini).
 *  Ne mentionne pas la ville : le rendez-vous qui précède le trou la donne déjà
 *  dans la ligne du créneau (quand l'adresse la fournit), ce serait redondant. */
function messageCreneau(nomClient: string, debut: Date, fin: Date): string {
  const jour = debut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `Bonjour ${prenom(nomClient)}, j'ai un créneau libre ${jour} de ${formatHeure(debut)} à ${formatHeure(fin)}. Ça vous intéresse ?`
}

/** iOS et Android n'acceptent pas le même séparateur avant `body` dans un lien
 *  `sms:` (`&` sur iOS, `?` sur Android) — un défaut bien connu du schéma
 *  `sms:`, pas propre à ce produit. Sans ce choix, le message arrive prérempli
 *  sur l'un des deux systèmes et vide sur l'autre. */
function smsHref(phone: string, message: string): string {
  const estIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  return `sms:${phone}${estIOS ? '&' : '?'}body=${encodeURIComponent(message)}`
}

/** Ligne d'appui sous le nom : dernière visite si le client en a une (le cas
 *  courant), sinon prochain rendez-vous déjà pris (un prospect en cours), sinon
 *  rien de connu. Aucun nouveau calcul : `derniere`/`prochain` viennent déjà de
 *  `listeClients`. */
function sousLigneActivite(c: ResumeClient, maintenant: number): string {
  if (c.derniere) {
    const jours = Math.floor((maintenant - new Date(c.derniere.date).getTime()) / 86_400_000)
    if (jours <= 0) return 'Vu aujourd’hui'
    if (jours === 1) return 'Vu hier'
    return `Vu il y a ${jours} jours`
  }
  if (c.prochain) {
    return `Prochain rendez-vous le ${new Date(c.prochain.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
  }
  return 'Pas encore de visite'
}

const boutonEnvoi = `flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`
const stylePression = { transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }

export default function ProposerCreneauV2({
  bookings,
  debut,
  fin,
  ville,
  onClose,
}: {
  bookings: Booking[]
  debut: Date
  fin: Date
  ville: string | null
  onClose: () => void
}) {
  const [maintenant] = useState(() => Date.now())
  const [recherche, setRecherche] = useState('')

  const clients = useMemo(
    () => listeClients(bookings.map(versClientBooking), new Date(maintenant)),
    [bookings, maintenant],
  )

  // Le plus pertinent en premier pour remplir un trou : le client sans
  // nouvelle depuis le plus longtemps, pas celui vu le plus récemment (ordre
  // par défaut de `listeClients`, pensé pour une liste à consulter, pas pour
  // en choisir un à relancer). Proposer ce créneau EST une relance déguisée —
  // un client revenu récemment, ou qui a déjà un rendez-vous à venir, n'a pas
  // besoin qu'on lui en propose un autre : son `activite` (RDV à venir compris)
  // est alors récente, et le fait naturellement descendre en fin de liste.
  // Aucun nouveau calcul : simple inversion du tri existant sur le même champ.
  const clientsTries = useMemo(
    () => [...clients].sort((a, b) => new Date(a.activite).getTime() - new Date(b.activite).getTime()),
    [clients],
  )

  const clientsAffiches = useMemo(() => rechercherClients(clientsTries, recherche), [clientsTries, recherche])

  const jour = debut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const sousTitre = `${jour} · ${formatHeure(debut)}–${formatHeure(fin)}${ville ? ` · ${ville}` : ''}`

  return (
    <Feuille titre="Proposer ce créneau" sousTitre={sousTitre} onClose={onClose}>
      <label htmlFor="proposer-recherche" className="sr-only">Chercher un client</label>
      <input
        id="proposer-recherche"
        type="search"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder="Chercher un client…"
        className={CHAMP}
      />

      {clients.length === 0 ? (
        <p className={`py-8 text-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Aucun client enregistré pour l’instant.
        </p>
      ) : clientsAffiches.length === 0 ? (
        <p className={`py-8 text-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Aucun client ne correspond à « {recherche} ».
        </p>
      ) : (
        <ul className="mt-1">
          {clientsAffiches.map(c => {
            const message = messageCreneau(c.name, debut, fin)
            return (
              <li key={c.email} className="border-t border-[color:var(--v2-filet)] py-3 first:border-t-0 first:pt-1">
                <p className={`truncate text-[15px] ${corpsFort}`}>{c.name}</p>
                <p className={`mt-0.5 truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                  {sousLigneActivite(c, maintenant)}
                </p>
                {/* Un client sans téléphone ne peut pas recevoir ce message :
                    montré quand même (le masquer aurait laissé croire qu'il
                    n'existe pas), mais sans lien qui échouerait en silence. */}
                {c.phone ? (
                  <div className="mt-2.5 flex gap-2">
                    <a
                      href={`https://wa.me/${whatsappDigits(c.phone)}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noopener"
                      aria-label={`Proposer ce créneau à ${c.name} sur WhatsApp`}
                      className={boutonEnvoi}
                      style={stylePression}
                    >
                      WhatsApp
                    </a>
                    <a
                      href={smsHref(c.phone, message)}
                      aria-label={`Proposer ce créneau à ${c.name} par SMS`}
                      className={boutonEnvoi}
                      style={stylePression}
                    >
                      SMS
                    </a>
                  </div>
                ) : (
                  <p className={`mt-2 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    Pas de téléphone — impossible de le lui proposer ainsi.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Feuille>
  )
}
