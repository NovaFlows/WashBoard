'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Mail, Phone, X } from 'lucide-react'
import { effectiveDuration, addonsDuration, formatPrice } from '@/lib/pricing'
import { haversineKm, estimateTravelMinutes } from '@/lib/geo'
import { getWeekStart, dayKey, formatHeure, cleStatut, type StatutClef } from '@/lib/calendarLayout'
import type { Booking, CalendrierProps } from '@/components/dashboard/CalendrierDashboardV1'

// Agenda, présentation v2 — réservée à la PWA installée en mode standalone
// (voir CalendrierDashboard.tsx, le point de branchement ; décision
// d'Alexandre, 2026-09-22 : le site reste v1 sans exception). Passe 7 de la
// refonte 2026, sous-lot 1 sur (au moins) trois — voir le compte rendu de la
// passe pour le découpage complet et ce qui reste.
//
// Planche `project/Agenda.dc.html` : une journée à la fois (bandeau de 7
// jours en haut, pas de bascule mois/semaine/jour comme en v1), une ligne de
// temps verticale, le temps de route estimé entre deux jobs, un résumé en
// bas de journée. C'est une FORME totalement différente de la grille
// mois/semaine/jour de v1 : usePwaStandalone() plutôt qu'une classe CSS, même
// raisonnement que ClientsView.tsx / ClientProfileModal.tsx.
//
// Logique réutilisée telle quelle, jamais dupliquée : `cleStatut` et le
// calcul « km → minutes de trajet » viennent de `@/lib/calendarLayout` et
// `@/lib/geo` (extraits de CalendrierDashboardV1.tsx pendant cette passe,
// comportement inchangé — voir les tests). `Booking`/`CalendrierProps`
// viennent aussi de CalendrierDashboardV1.tsx : une seule définition de la
// forme des données envoyées par `calendrier/page.tsx`.
//
// **Ce que ce sous-lot NE fait PAS** (voir le compte rendu de la passe pour
// le détail et pourquoi) :
//   - Pas de création de rendez-vous manuel (le « + » de la maquette), pas de
//     congés/indisponibilités : la maquette ne montre ni l'un ni l'autre sur
//     cet écran, et les construire correctement en v2 (feuilles dédiées,
//     jetons v2) est un sous-lot à part entière — v1 (le site) garde ces deux
//     fonctions intactes, et un laveur PWA-bêta peut toujours les faire
//     depuis le menu latéral (Sidebar) en attendant.
//   - La fiche ouverte en tapant un rendez-vous est EN LECTURE SEULE (nom,
//     horaire, prestation, prix, adresse, contact, statut). Changer le
//     statut, reprogrammer, écrire une note ou émettre une facture depuis
//     l'agenda v2 n'est pas encore construit — cette interaction existe
//     intégralement dans CalendrierDashboardV1.tsx (state `selected` et les
//     fonctions `updateStatus`/`saveReschedule`/`saveNotes`/
//     `emettreFactureManuelle`), fortement couplée à la liste complète des
//     rendez-vous et des congés : l'extraire proprement en composant partagé
//     est le premier chantier du sous-lot suivant plutôt qu'un copier-coller
//     à la hâte qui aurait dupliqué ~400 lignes de logique d'état.
//   - Pas de bouton « Proposer » sur un créneau libre (la maquette en montre
//     un) : rien dans le code ne sait proposer un créneau à un client
//     (aucune table, aucune route). Le créneau libre s'affiche donc en
//     information seule, sans action.
//   - Pas de nom de ville par rendez-vous (la maquette en affiche un —
//     « Pessac », « Mérignac »...) : `ClientProfileModalV2.tsx` a déjà tranché
//     cette question pour la fiche client (« extraire une ville serait
//     deviner un format qui n'est pas garanti », l'adresse est un champ
//     libre). Même règle reprise ici, pour la même raison.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

const JOURS_INITIALE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Même convention que ClientProfileModalV2.tsx (planche Système : « les
// statuts sont un point plein + le mot, jamais une pastille pastel ») —
// Terminé en gris, pas en bleu comme l'ancienne fiche l'inventait. Dupliqué
// ici volontairement (présentation, pas calcul) : les deux écrans n'ont pas
// encore de source commune pour ce tableau de libellés/couleurs.
const STATUT: Record<StatutClef, { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  closed_late: { couleur: 'var(--v2-color-ambre)', label: 'Délai dépassé' },
}

// En dessous, un gain de temps n'est pas montré : la maquette ne montre
// qu'un seul créneau libre notable (2 h), pas les petits écarts entre deux
// jobs enchaînés.
const SEUIL_LIBRE_MIN = 30

function dureeLisible(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

/** Montant réellement facturé pour ce rendez-vous — même logique que le
 *  modal de détail v1 (`booked_price` prime, remise smart slot déduite). */
function montant(b: Booking): number {
  const base = b.booked_price ?? b.services?.price ?? 0
  return b.is_smart_slot && Number(b.smart_discount) > 0 ? base - Number(b.smart_discount) : base
}

function prixAffiche(b: Booking): string {
  return b.is_smart_slot && Number(b.smart_discount) > 0 ? formatPrice(montant(b)) : `${montant(b)} €`
}

/** Catégorie · nom de la prestation — même repli que le modal de détail v1
 *  (`selected.services.service_categories?.name` puis `.name`), pas le
 *  véhicule/l'option que montre la maquette au cas par cas : les déduire
 *  demanderait une règle de mise en forme différente pour chaque type de
 *  prestation, non couverte par une fonction existante. */
function lignePrestation(b: Booking): string {
  if (!b.services) return 'Prestation'
  return b.services.service_categories?.name
    ? `${b.services.service_categories.name} · ${b.services.name}`
    : b.services.name
}

function finRendezVous(b: Booking): Date {
  const duree = effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count)
  return new Date(new Date(b.scheduled_at).getTime() + duree * 60_000)
}

type Trajet = { minutes: number; km: number } | null

function trajetEntre(a: Booking, b: Booking): Trajet {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng)
  return { minutes: estimateTravelMinutes(km), km }
}

export default function CalendrierDashboardV2({ bookings }: CalendrierProps) {
  const [today] = useState(() => new Date())
  const [dayDate, setDayDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [detail, setDetail] = useState<Booking | null>(null)

  const weekStart = useMemo(() => getWeekStart(dayDate), [dayDate])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }),
    [weekStart],
  )

  const byDate = useMemo(() => {
    const m = new Map<string, Booking[]>()
    bookings.forEach(b => {
      const k = dayKey(new Date(b.scheduled_at))
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(b)
    })
    return m
  }, [bookings])

  const jour = useMemo(
    () => [...(byDate.get(dayKey(dayDate)) ?? [])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [byDate, dayDate],
  )
  // Un rendez-vous annulé n'occupe plus de temps : il reste visible dans la
  // liste (jamais escamoté), mais n'entre dans aucun calcul de trajet, de
  // créneau libre ou de total.
  const actifs = useMemo(() => jour.filter(b => b.status !== 'cancelled'), [jour])

  const totalRoute = useMemo(() => {
    let somme = 0
    let connu = false
    for (let i = 0; i < actifs.length - 1; i++) {
      const t = trajetEntre(actifs[i], actifs[i + 1])
      if (t) { somme += t.minutes; connu = true }
    }
    return connu ? somme : null
  }, [actifs])
  const totalPrix = useMemo(() => actifs.reduce((s, b) => s + montant(b), 0), [actifs])

  function allerSemaine(delta: number) {
    setDayDate(d => { const n = new Date(d); n.setDate(n.getDate() + delta * 7); return n })
  }

  const estAujourdhui = dayDate.getFullYear() === today.getFullYear() && dayDate.getMonth() === today.getMonth() && dayDate.getDate() === today.getDate()
  const sousTitre = estAujourdhui
    ? `Aujourd’hui · ${dayDate.toLocaleDateString('fr-FR', { day: 'numeric' })}`
    : dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })

  return (
    <div
      className={`max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={`text-[21px] ${titre} capitalize`}>{MOIS[dayDate.getMonth()]}</h1>
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1 capitalize`}>{sousTitre}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => allerSemaine(-1)}
          aria-label="Semaine précédente"
          className="shrink-0 flex h-11 w-8 items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <div className="flex flex-1 justify-between gap-1 overflow-x-auto">
          {weekDays.map((d, i) => {
            const actif = d.getFullYear() === dayDate.getFullYear() && d.getMonth() === dayDate.getMonth() && d.getDate() === dayDate.getDate()
            const estJourReel = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
            return (
              <button
                key={dayKey(d)}
                type="button"
                onClick={() => setDayDate(d)}
                aria-current={actif ? 'date' : undefined}
                aria-label={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                className={`flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--v2-radius-bouton)] ${
                  actif ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]' : 'text-[color:var(--v2-color-encre)]'
                }`}
              >
                <span className={`text-[11px] ${corps} opacity-70`}>{JOURS_INITIALE[i]}</span>
                <span className={`text-[16px] ${corpsFort} tabular-nums ${!actif && estJourReel ? 'text-[color:var(--v2-color-accent)]' : ''}`}>
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => allerSemaine(1)}
          aria-label="Semaine suivante"
          className="shrink-0 flex h-11 w-8 items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      {!estAujourdhui && (
        <button
          type="button"
          onClick={() => setDayDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
          className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
        >
          Revenir à aujourd’hui
        </button>
      )}

      {jour.length === 0 ? (
        <p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] text-center py-10`}>
          Aucun rendez-vous ce jour.
        </p>
      ) : (
        <div className="flex flex-col">
          {jour.map(b => {
            const cancelled = b.status === 'cancelled'
            const indexActif = actifs.indexOf(b)
            const suivant = !cancelled && indexActif >= 0 ? actifs[indexActif + 1] : undefined
            const gapMin = suivant ? Math.round((new Date(suivant.scheduled_at).getTime() - finRendezVous(b).getTime()) / 60_000) : null
            const trajet = suivant ? trajetEntre(b, suivant) : null
            return (
              <div key={b.id}>
                <RendezVousCarte booking={b} onOuvrir={() => setDetail(b)} estompe={cancelled} />
                {gapMin !== null && gapMin >= SEUIL_LIBRE_MIN && (
                  <div className="flex items-center gap-3 py-1.5">
                    <span className={`w-10 shrink-0 text-right text-[12px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
                      {formatHeure(finRendezVous(b))}
                    </span>
                    <span className={`flex-1 rounded-[var(--v2-radius-carte)] border border-dashed border-[color:var(--v2-filet-fort)] px-3.5 py-2.5 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                      {dureeLisible(gapMin)} de libre
                    </span>
                  </div>
                )}
                {suivant && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="w-10 shrink-0" />
                    <span
                      aria-hidden
                      className="h-[18px] w-px"
                      style={{
                        background: 'repeating-linear-gradient(to bottom, var(--v2-filet-fort) 0 4px, transparent 4px 8px)',
                        marginLeft: 20,
                      }}
                    />
                    {trajet && (
                      <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
                        ~{trajet.minutes} min de route · ~{Math.round(trajet.km)} km
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {actifs.length > 0 && (
        <div className="flex items-center justify-between border-t border-[color:var(--v2-filet)] pt-3.5">
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
            {actifs.length} rendez-vous{totalRoute !== null ? ` · ${totalRoute} min de route` : ''}
          </span>
          <span className={`text-[14px] ${corpsFort} tabular-nums`}>{totalPrix} €</span>
        </div>
      )}

      {detail && <DetailRendezVous booking={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function RendezVousCarte({ booking: b, onOuvrir, estompe }: { booking: Booking; onOuvrir: () => void; estompe: boolean }) {
  const statut = STATUT[cleStatut(b)]
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 shrink-0 flex flex-col items-end pt-3 gap-0.5">
        <span className={`text-[14px] ${corpsFort} tabular-nums`}>{formatHeure(new Date(b.scheduled_at))}</span>
        <span className={`text-[11px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>{formatHeure(finRendezVous(b))}</span>
      </div>
      <span
        aria-hidden
        className="w-[3px] self-stretch my-1.5 rounded-full"
        style={{ background: statut.couleur }}
      />
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Voir le rendez-vous de ${b.client_name}`}
        className={`flex-1 min-w-0 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-3.5 py-3 text-left flex flex-col gap-1 ${estompe ? 'opacity-50' : ''}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={`text-[15px] ${nom} truncate`}>{b.client_name}</span>
          <span className={`shrink-0 text-[14.5px] ${corpsFort} tabular-nums`}>{prixAffiche(b)}</span>
        </span>
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>{lignePrestation(b)}</span>
        <span className="flex items-center gap-1.5 pt-0.5">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: statut.couleur }} aria-hidden />
          <span className={`text-[12.5px] ${corpsFort}`} style={{ color: statut.couleur }}>{statut.label}</span>
        </span>
      </button>
    </div>
  )
}

// Fiche de rendez-vous en lecture seule — pas encore d'actions (statut,
// reprogrammation, note, facture) : voir le grand commentaire en tête de
// fichier pour pourquoi ce sous-lot s'arrête là. Même mécanique
// d'accessibilité que ClientProfileModalV2.tsx (feuille qui monte du bas,
// Échap, piège de focus, retour du focus, masque le bouton WhatsApp flottant).
const SELECTEUR_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function DetailRendezVous({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feuilleRef = useRef<HTMLDivElement>(null)
  const focusPrecedent = useRef<HTMLElement | null>(null)
  const statut = STATUT[cleStatut(b)]

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => { if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus() }
  }, [])

  useEffect(() => { closeRef.current?.focus() }, [])

  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const prix = montant(b)
  const remise = b.is_smart_slot && Number(b.smart_discount) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Rendez-vous de ${b.client_name}`}>
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      />
      <div
        ref={feuilleRef}
        className={`relative flex w-full max-h-[88dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
          visible ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-5">
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: statut.couleur }} aria-hidden />
              <span className={`text-[12.5px] ${corpsFort}`} style={{ color: statut.couleur }}>{statut.label}</span>
            </span>
            <h2 className={`truncate text-[22px] ${titre}`}>{b.client_name}</h2>
            <p className={`mt-1 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {new Date(b.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatHeure(new Date(b.scheduled_at))}–{formatHeure(finRendezVous(b))}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          <div className={`flex items-center justify-between rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3`}>
            <span className={`text-[14px] ${corps}`}>{lignePrestation(b)}</span>
            <span className={`text-[15px] ${corpsFort} tabular-nums`}>
              {remise ? formatPrice(prix) : `${prix} €`}
            </span>
          </div>

          <p className={`mt-4 text-[13.5px] ${corps} text-[color:var(--v2-color-encre)]`}>{b.address}</p>

          {b.notes && (
            <p className={`mt-3 text-[13px] ${corps} text-[color:var(--v2-color-gris)] whitespace-pre-wrap`}>{b.notes}</p>
          )}

          <div className={`mt-5 space-y-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            <a href={`mailto:${b.client_email}`} className="flex items-center gap-2 transition-colors hover:text-[color:var(--v2-color-encre)]">
              <Mail size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{b.client_email}</span>
            </a>
          </div>

          {b.client_phone && (
            <div className="mt-5 flex gap-2.5">
              <a
                href={`tel:${b.client_phone}`}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                <Phone size={16} strokeWidth={2} aria-hidden />
                Appeler
              </a>
              <a
                href={`sms:${b.client_phone}`}
                className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Message
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
