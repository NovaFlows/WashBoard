'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Phone, Mail, MapPin } from 'lucide-react'
import type { ClientBooking, ClientProfile } from '@/lib/clientProfile'
import { FUSEAU } from '@/lib/dateUtils'

// La fiche client : une feuille qui monte du bas (mobile) ou une carte
// centrée (ordinateur), au-dessus de la liste Clients ou de l'ancien CRM
// (CrmDashboard.tsx la réutilise telle quelle — voir le compte rendu de la
// passe 3 pour ce que ça implique). Passe 3 de la refonte 2026 : seule la
// présentation change, buildClientProfile et ClientProfile n'ont pas bougé.
//
// La maquette (specs/08_Fiche-feuille.txt, page_08.png) montre des données
// que le profil ne calcule pas : le rythme du client, un menu d'options
// ("..."), un bouton "Rendez-vous", des contacts et sites multiples pour un
// pro, des devis et factures. Rien de tout ça n'est inventé ici — voir le
// compte rendu de la passe pour la liste précise et ce qu'il faudrait
// construire.

// Rôles de police — mêmes constantes que ClientsView.tsx (passe 2), plus
// `hero` pour les trois chiffres de la fiche (planche Système : "chiffre
// héros" 650/largeur 118/-0.045em/tabular-nums — même rôle qu'à l'accueil,
// une taille plus petite ici).
const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

// Statuts d'un rendez-vous : un point plein + le mot, jamais une pastille
// pastel (planche Système, panneau Couleurs — "les statuts sont un point
// plein + le mot, jamais une pastille pastel"). Couleurs reprises du
// panneau "Composants" de la planche : Confirmé vert, En attente ambre,
// Terminé GRIS (pas bleu — l'ancienne fiche l'inventait), Annulé rouge.
// "Délai dépassé" n'existe pas dans la planche (propre au produit) : posé
// en ambre par cohérence avec "en attente", à confirmer.
const STATUT: Record<'pending' | 'confirmed' | 'done' | 'cancelled' | 'closed_late', { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  closed_late: { couleur: 'var(--v2-color-ambre)', label: 'Délai dépassé' },
}

// Éléments qu'un Tab peut atteindre à l'intérieur de la feuille — sert au
// piège de focus (le Tab ne doit pas s'échapper vers la liste derrière).
const SELECTEUR_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function dateCourte(iso: string, maintenant: number): string {
  const d = new Date(iso)
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }), timeZone: FUSEAU,
  })
}

const depuis = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: FUSEAU })

export default function ClientProfileModal({
  profile,
  onClose,
}: {
  profile: ClientProfile
  onClose: () => void
}) {
  const [maintenant] = useState(() => Date.now())
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feuilleRef = useRef<HTMLDivElement>(null)
  const focusPrecedent = useRef<HTMLElement | null>(null)

  // Entrée animée : un cran après le montage pour que le navigateur parte
  // bien de l'état initial (translate-y-full / opacity-0) avant de
  // transitionner — sans ce décalage, la feuille apparaît déjà en place.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Focus à l'ouverture, et surtout son retour à la fermeture : la ligne de
  // la liste qui a ouvert la fiche (ou le bouton qui l'a ouverte depuis
  // l'ancien CRM) reprend le focus, au lieu de le laisser tomber sur
  // <body>. document.activeElement est lu avant le .focus() du bouton
  // fermer ci-dessous, dans un effet séparé qui s'exécute avant (ordre de
  // déclaration) : au moment de la lecture, le focus est encore sur
  // l'élément d'origine.
  useEffect(() => {
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus()
    }
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Le bouton WhatsApp flottant du châssis est au même z-index que la
  // feuille et se pose par-dessus son bas. Même mécanisme que SupportPanel,
  // AssistanceContent et SupportInbox, qui le masquent déjà pendant qu'un
  // panneau couvre l'écran (voir globals.css, body.wb-hide-fab).
  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  // Échap pour fermer, Tab piégé dans la feuille : un menu ouvert au clavier
  // ne doit pas laisser échapper la tabulation vers la liste derrière.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const titreClient = profile.isProfessional && profile.companyName ? profile.companyName : profile.name

  // Sous-titre : "Client depuis {mois} · {adresse}" — la maquette écrit un
  // nom de ville court ("· Pessac"), mais l'adresse est un champ libre sans
  // découpage rue/ville garanti (voir StepContact.tsx du flux de
  // réservation) : en extraire une ville serait deviner un format qui n'est
  // pas garanti. L'adresse complète la plus récente est affichée à la
  // place, tronquée si besoin.
  const depuisTexte = profile.firstVisit ? `Client depuis ${depuis(profile.firstVisit)}` : null
  const sousTitre = [depuisTexte, profile.addresses[0] ?? null].filter(Boolean).join(' · ')

  const statistiques = [
    { label: 'lavages', valeur: String(profile.honoredCount) },
    { label: 'au total', valeur: `${profile.totalRevenue} €` },
    { label: 'panier moyen', valeur: `${profile.averageBasket} €` },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${titreClient}`}
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      />

      <div
        ref={feuilleRef}
        className={`relative flex w-full max-h-[88dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
          visible
            ? 'translate-y-0 sm:scale-100 sm:opacity-100'
            : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-[24px] ${titre}`}>{titreClient}</h2>
            {sousTitre && (
              <p className={`mt-1 truncate text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>
            )}
            {profile.isProfessional && profile.companyName && (
              <p className={`mt-0.5 truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                Contact · {profile.name}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 pt-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        >
          <dl className="grid grid-cols-3 gap-3">
            {statistiques.map(s => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className={`m-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{s.label}</dt>
                <dd className={`m-0 text-[26px] leading-none ${hero}`}>{s.valeur}</dd>
              </div>
            ))}
          </dl>
          {profile.cancelledCount > 0 && (
            <p className={`mt-2 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
              dont {profile.cancelledCount} annulé{profile.cancelledCount > 1 ? 's' : ''}
            </p>
          )}

          {/* Coordonnées : l'email est garanti (seul champ obligatoire de la
              fiche client), toujours affiché — y compris quand le
              téléphone manque et que les boutons Appeler/Message
              disparaissent, pour qu'il reste un moyen de contact visible.
              Les adresses au-delà de la première (déjà dans le sous-titre)
              s'ajoutent ici : le cas d'un professionnel à plusieurs sites. */}
          <div className={`mt-4 space-y-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            <a
              href={`mailto:${profile.email}`}
              className="flex items-center gap-2 transition-colors hover:text-[color:var(--v2-color-encre)]"
            >
              <Mail size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{profile.email}</span>
            </a>
            {profile.addresses.slice(1).map(a => (
              <p key={a} className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>{a}</span>
              </p>
            ))}
          </div>

          {profile.daysSinceLastVisit !== null && profile.daysSinceLastVisit >= 90 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-color-ambre)]/30 bg-[color:var(--v2-color-surface)] px-3.5 py-3">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--v2-color-ambre)' }}
                aria-hidden
              />
              <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-ambre)]`}>
                Pas revenu depuis {profile.daysSinceLastVisit} jours — bon candidat à une relance.
              </p>
            </div>
          )}

          {/* Appeler / Message : des liens tel: / sms:, du déclenchement, pas
              de l'écriture — légitimes dès maintenant si le téléphone
              existe. "Rendez-vous" (dans la maquette) suppose le rendez-vous
              manuel (étape 3 du plan CRM, pas encore construit) : absent
              volontairement, pas de bouton mort. */}
          {profile.phone && (
            <div className="mt-6 flex gap-2.5">
              <a
                href={`tel:${profile.phone}`}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                <Phone size={16} strokeWidth={2} aria-hidden />
                Appeler
              </a>
              <a
                href={`sms:${profile.phone}`}
                className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Message
              </a>
            </div>
          )}

          <div className="mt-6 border-t border-[color:var(--v2-filet)] pt-1">
            <h3 className="sr-only">Historique</h3>
            <ol>
              {profile.bookings.map((b: ClientBooking, i) => {
                const s = STATUT[b.closed_late ? 'closed_late' : b.status]
                const dernier = i === profile.bookings.length - 1
                const prix = b.booked_price ?? b.services?.price ?? 0
                return (
                  <li key={b.id} className="flex gap-3 py-3">
                    <span className="relative flex w-2.5 shrink-0 justify-center">
                      <span
                        className="absolute top-1.5 h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: s.couleur }}
                        aria-hidden
                      />
                      {!dernier && (
                        <span
                          className="absolute top-3 w-px bg-[color:var(--v2-filet)]"
                          style={{ height: 'calc(100% + 0.75rem)' }}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[14.5px] ${nom}`}>{b.services?.name ?? 'Prestation'}</span>
                        <span className={`shrink-0 text-[14px] ${corpsFort} tabular-nums`}>{prix} €</span>
                      </span>
                      <span className={`mt-0.5 block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                        {dateCourte(b.scheduled_at, maintenant)} · {s.label}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
