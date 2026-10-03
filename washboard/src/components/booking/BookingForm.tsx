'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Service, ServiceCategory, Availability, BookingFormData } from '@/types'
import { dureeTotale, formatPrice } from '@/lib/pricing'
import { resumePrestation, resumeCreneau, montantMinimal, montantEstime } from '@/lib/bookingSummary'
import { trackFunnelStep, type FunnelStep, resolveCampagne, resolveCreation } from '@/lib/funnelTracking'
import { evenementPixel } from '@/lib/metaPixel'
import StepPrestation from './StepPrestation'
import BookingAction from './BookingAction'
import './booking.css'
import StepSlot from './StepSlot'
import ContactDetails from './ContactDetails'
import StepConfirmation from './StepConfirmation'

// Trois cartes, options intégrées et une seule action dans la barre fixe.
// Les étapes restent montées quand elles sont repliées pour préserver la saisie.
// Le bouton de chaque étape est porté dans la barre par BookingAction : sa
// validation et son gestionnaire restent au même endroit que ses champs.

// Mappe l'étape réelle sur le nom d'étape suivi côté analytics (inchangé,
// voir migration 003 booking_funnel_events) : la numérotation logique reste
// la même, seule sa présentation a changé.
const FUNNEL_STEP_NAMES: Record<number, FunnelStep> = {
  1: 'prestation',
  2: 'options',
  3: 'creneau',
  4: 'coordonnees',
  5: 'confirmation',
}

type ExistingBooking = { scheduled_at: string; vehicle_count: number | null; selected_addons?: { duration_minutes?: number }[] | null; services: { duration_minutes: number } | null }
type Unavailability  = { id: string; start_date: string; end_date: string; team_members_off?: number | null }

type Props = {
  // Volontairement PAS le `Washer` complet.
  //
  // Next.js sérialise dans le HTML toutes les props qui franchissent la
  // frontière serveur→client, utilisées ou non. Passer l'objet entier publiait
  // donc `google_refresh_token`, `stripe_customer_id` et `user_id` dans le
  // code source de chaque page de réservation — lisible par un simple
  // « Afficher le code source » (constaté le 2026-09-05 : le
  // `stripe_customer_id` y était en clair).
  //
  // Ce type liste ce dont le formulaire a réellement besoin, et rien d'autre.
  // Y ajouter un champ doit rester un geste conscient.
  washer: WasherPublic
  services: Service[]
  categories: ServiceCategory[]
  availabilities: Availability[]
  /** Disponibilités fournies directement, au lieu d'être chargées depuis la
   *  base : réservé aux démonstrations et aux captures, qui tournent sur un
   *  laveur fictif absent de la base. En production, on ne les passe pas. */
  disponibilites?: Disponibilites
  accent?: string
  /** Lien `wa.me` déjà formaté, ou `null` si le laveur n'a pas de téléphone ou
   *  a atteint son plafond de réservations du mois (voir page.tsx — le même
   *  calcul commande déjà le bouton WhatsApp du bas de page, pas de raison de
   *  le refaire ici). Affiche le lien « Une question avant de réserver ? »
   *  de la maquette, juste sous la carte en cours. */
  whatsappHref?: string | null
}

/** Rendez-vous à venir et congés, chargés à la demande.
 *
 *  Ils arrivaient autrefois en props, lus par la page à chaque visite. Comme
 *  ils ne servent qu'à l'étape des créneaux et que la plupart des visiteurs
 *  n'y arrivent jamais, ils sont désormais demandés au premier geste du
 *  visiteur — donc bien avant qu'il en ait besoin, et jamais pour quelqu'un
 *  qui ne fait que passer. */
type Disponibilites = { bookings: ExistingBooking[]; unavailabilities: Unavailability[] }

/** Les seuls champs du laveur qui ont le droit d'atteindre le navigateur. */
export type WasherPublic = {
  id: string
  name: string
  base_address: string | null
  team_size: number | null
  travel_fee_mode: 'base' | 'previous'
  travel_fee_tiers: { max_minutes: number; fee: number }[] | null
  /** Le laveur accepte-t-il qu'on réserve pour aujourd'hui ? Sans ce champ,
   *  StepSlot retombe sur son défaut (à partir de demain) — jamais sur
   *  « oui » par erreur. */
  reservation_jour_meme?: boolean
  /** Page « proposition » : construite pour un laveur qui n'a pas encore de
   *  compte, pour qu'il voie son outil avant de s'inscrire. Elle se parcourt
   *  entièrement mais ne prend aucune réservation — publier un lien réservable
   *  au nom de quelqu'un qui n'a rien demandé l'engagerait sur des rendez-vous
   *  qu'il n'a jamais acceptés. */
  is_preview?: boolean
  /** Informations de facturation complètes : un booléen, jamais le SIRET ni
   *  l'adresse eux-mêmes, qui n'ont rien à faire dans la page publique. */
  facturation_prete?: boolean
  /** Le laveur peut recevoir des clients PROFESSIONNELS : fiche société,
   *  facture, suivi. L'offre gratuite ne l'a pas, l'onglet ne s'affiche donc
   *  pas — plutôt que de le montrer barré, ce qui ferait porter au CLIENT le
   *  refus d'une limite qui n'est pas la sienne. */
  clients_pro?: boolean
  // (les autres champs de `Washer` n'ont rien a faire dans le navigateur)
}

export type FormState = Partial<BookingFormData>

/** Les trois cartes de l'accordéon. */
type Section = 1 | 2 | 3

export default function BookingForm({ washer, services, categories, availabilities, disponibilites, accent = '#2563eb', whatsappHref = null }: Props) {
  const [section, setSection] = useState<Section>(1)
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null)
  const priceDialog = useRef<HTMLDialogElement>(null)
  const [slotVersion, setSlotVersion] = useState(0)
  const [prestationComplete, setPrestationComplete] = useState(false)
  const [screen, setScreen] = useState<'form' | 'done'>('form')
  const [form, setForm] = useState<FormState>({})
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dispos, setDispos] = useState<Disponibilites | null>(disponibilites ?? null)
  const [disposEnEchec, setDisposEnEchec] = useState(false)
  const disposDemandees = useRef(!!disponibilites)

  /** Une seule fois par page, sauf après un échec où l'on autorise un nouvel
   *  essai. Ne jamais retomber sur des listes vides : le formulaire afficherait
   *  tous les créneaux libres et ignorerait les congés. */
  const chargerDispos = useCallback(() => {
    if (disposDemandees.current) return
    disposDemandees.current = true
    setDisposEnEchec(false)
    fetch(`/api/booking-availability?washer_id=${washer.id}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((d: Partial<Disponibilites>) => setDispos({
        bookings: d.bookings ?? [],
        unavailabilities: d.unavailabilities ?? [],
      }))
      .catch(() => { disposDemandees.current = false; setDisposEnEchec(true) })
  }, [washer.id])

  // Filet : si le visiteur arrive à la carte des créneaux sans avoir déclenché
  // le chargement (clavier, lecteur d'écran, navigation inattendue), on le
  // lance ici plutôt que de le laisser devant un écran qui n'avance pas.
  useEffect(() => { if (section >= 2) chargerDispos() }, [section, chargerDispos])

  const selectedService = services.find(s => s.id === form.service_id)

  // Numéro d'étape « logique », pour l'analytics et le Pixel uniquement — la
  // numérotation ne change pas avec la refonte visuelle, voir FUNNEL_STEP_NAMES.
  const effectiveStep =
    screen === 'done' ? 5 :
    section === 3 ? 4 :
    section === 2 ? 3 :
    form.service_id && (selectedService?.addons.length ?? 0) > 0 ? 2 : 1

  // Un événement par étape franchie, y compris à l'arrivée sur la page
  // (effectiveStep === 1 dès le montage). Ne bloque jamais le parcours si ça échoue.
  useEffect(() => {
    trackFunnelStep(washer.id, FUNNEL_STEP_NAMES[effectiveStep])
  }, [effectiveStep, washer.id])

  // ── Pixel Meta : « réservation commencée » ────────────────────────────────
  //
  // À la DEUXIÈME étape logique, pas à l'arrivée sur la page. Arriver n'est
  // pas commencer : le PageView couvre déjà la visite, et envoyer
  // InitiateCheckout dès le montage rendrait les deux événements identiques —
  // Meta optimiserait alors pour des gens qui ouvrent la page et repartent.
  const checkoutEnvoye = useRef(false)
  useEffect(() => {
    if (effectiveStep < 2 || checkoutEnvoye.current) return
    checkoutEnvoye.current = true
    evenementPixel('InitiateCheckout')
  }, [effectiveStep])

  const updateForm = useCallback((data: Partial<BookingFormData>) => {
    setForm(prev => Object.entries(data).every(([key, value]) => JSON.stringify(prev[key as keyof FormState]) === JSON.stringify(value)) ? prev : { ...prev, ...data })
  }, [])

  function updatePrestation(data: FormState) {
    updateForm({ ...data, scheduled_at: undefined, is_smart_slot: false, smart_discount: 0, travel_fee: undefined })
    setPrestationComplete(false)
    setSlotVersion(v => v + 1)
  }

  async function submitBooking(contactData: Pick<BookingFormData, 'client_name' | 'client_email' | 'client_phone'> & { notes?: string; hp?: string }) {
    setLoading(true)
    setError(null)
    if (contactData.notes) updateForm({ notes: contactData.notes })
    const payload = {
      ...form,
      ...contactData,
      washer_id:      washer.id,
      is_smart_slot:  form.is_smart_slot ?? false,
      smart_discount: form.smart_discount ?? 0,
      // L'origine est figée ICI, au moment de la réservation, et jamais
      // recalculée ensuite. C'est ce qui permet de dire plus tard combien
      // d'argent une campagne a rapporté — les événements de visite, eux, ne
      // portent aucun prix et sont purgés à treize mois.
      utm_campaign:   resolveCampagne(typeof window === 'undefined' ? '' : window.location.search),
      utm_content:    resolveCreation(typeof window === 'undefined' ? '' : window.location.search),
    }
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la réservation')
      updateForm(contactData)
      setBookingId(json.data.id)
      setScreen('done')

      // ── Pixel Meta : « réservation confirmée » ──────────────────────────
      //
      // Le montant vient de la RÉPONSE du serveur, jamais du formulaire : le
      // prix envoyé par le client est délibérément ignoré à l'enregistrement
      // (voir api/bookings), et remonter à Meta un montant que WashBoard n'a
      // pas retenu fausserait l'optimisation du laveur sur toutes ses
      // campagnes.
      //
      // Appelé APRÈS l'affichage de la confirmation : un échec de mesure ne
      // doit jamais retarder ce que le client attend.
      const montant = Number(json.data?.booked_price)
      evenementPixel('Purchase', {
        currency: 'EUR',
        value: Number.isFinite(montant) && montant > 0 ? montant : undefined,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const estProposition = washer.is_preview === true

  // ── Barre de prix persistante (fidèle à la maquette) ──────────────────────
  const barLabel = !form.service_id
    ? 'À partir de'
    : (form.address && form.travel_fee !== undefined ? 'Total, à régler sur place' : 'Total estimé, à régler sur place')
  const barAmount = form.service_id ? montantEstime(form) : montantMinimal(services)

  const complete2 = !!(form.scheduled_at && form.address)

  function reouvrir(n: Section) {
    setSection(n)
    // Un clic sur « Modifier » doit ramener la vue sur la carte rouverte,
    // sinon le visiteur reste scrollé devant la carte qu'il vient de
    // refermer et ne voit pas ce qu'il a touché.
    requestAnimationFrame(() => {
      const card = document.getElementById(`wb-section-${n}`)
      card?.focus({ preventScroll: true })
      card?.scrollIntoView({ behavior: 'auto', block: 'start' })
    })
  }

  return (
    <div
      id="wb-booking-accordion"
      className="wb-booking flex flex-col gap-2.5"
      style={{ '--booking-accent': accent } as React.CSSProperties}
      // Au premier geste sur le formulaire — bien avant la carte des
      // créneaux, qui demande encore de choisir une prestation. Le temps que
      // le visiteur clique, les disponibilités sont là : il ne voit aucune
      // attente. Celui qui ne touche à rien (la grande majorité) ne
      // déclenche aucune lecture.
      onPointerDown={chargerDispos}
      onKeyDown={chargerDispos}
    >
      {screen === 'form' && (
        <>
          {/* Annoncé d'emblée, et pas seulement à la dernière carte : un
              visiteur qui remplit tout en croyant réserver, puis découvre que
              non, est un client perdu pour le laveur. */}
          {estProposition && (
            <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 text-sm">
              <p className="font-bold">Aperçu — cette page n&apos;est pas encore active</p>
              <p className="text-xs mt-0.5 leading-relaxed">
                Elle montre à quoi ressemblerait la page de réservation de {washer.name}.
                Aucune réservation ne peut être enregistrée pour l&apos;instant.
              </p>
            </div>
          )}

          <SectionCard
            id="wb-section-1"
            numero={1}
            titre="Prestation"
            etat={section === 1 ? 'open' : prestationComplete ? 'done' : 'locked'}
            resume={resumePrestation(form, services)}
            onModifier={() => reouvrir(1)}
          >
            <StepPrestation services={services} categories={categories} form={form} onChange={updatePrestation} />
            <BookingAction target={section === 1 ? actionTarget : null} accent={accent} disabled={!form.service_id || !form.vehicle_count}
              onClick={() => { setPrestationComplete(true); reouvrir(2) }}>
              {form.service_id ? 'Choisir le créneau' : 'Choisissez une prestation'}
            </BookingAction>
          </SectionCard>

          <SectionCard
            id="wb-section-2"
            numero={2}
            titre="Où et quand"
            etat={section === 2 ? 'open' : complete2 ? 'done' : 'locked'}
            resume={resumeCreneau(form)}
            onModifier={() => reouvrir(2)}
          >
            {/* Tant que les disponibilités ne sont pas là, StepSlot n'est pas
                monté du tout : avec des listes vides il montrerait tous les
                créneaux libres et les congés comme travaillés. Mieux vaut une
                seconde d'attente qu'une double réservation. En pratique
                l'attente est invisible, le chargement ayant démarré au
                premier geste. */}
            {!dispos ? (
              <div className="py-10 text-center">
                {disposEnEchec ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Impossible d&apos;afficher les disponibilités
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-5">
                      Vérifiez votre connexion : nous préférons ne rien proposer plutôt
                      qu&apos;un horaire déjà pris.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSection(1)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Retour
                      </button>
                      <button
                        type="button"
                        onClick={chargerDispos}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        Réessayer
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400" role="status">
                    Recherche des créneaux disponibles…
                  </p>
                )}
              </div>
            ) : (
              <StepSlot
                key={slotVersion}
                initialAddress={form.address}
                active={section === 2}
                actionTarget={section === 2 ? actionTarget : null}
                onDraft={updateForm}
                availabilities={availabilities}
                existingBookings={dispos.bookings}
                unavailabilities={dispos.unavailabilities}
                teamSize={washer.team_size ?? 1}
                // Règle unique, qui sait lire les deux formes : options rattachées
                // à chaque véhicule, ou liste commune des anciennes réservations.
                serviceDuration={dureeTotale(
                  services.find(s => s.id === form.service_id)?.duration_minutes ?? 60,
                  form.vehicles_detail,
                  form.selected_addons,
                  form.vehicle_count,
                )}
                servicePrice={form.booked_price ?? services.find(s => s.id === form.service_id)?.price ?? 0}
                washerId={washer.id}
                hasTravelFee={(washer.travel_fee_tiers ?? []).length > 0 && !!washer.base_address}
                travelFeeMode={washer.travel_fee_mode ?? 'base'}
                reservationJourMeme={washer.reservation_jour_meme === true}
                onNext={(data) => { updateForm(data); reouvrir(3) }}
                accent={accent}
              />
            )}
          </SectionCard>

          <SectionCard
            id="wb-section-3"
            numero={3}
            titre="Vos coordonnées"
            etat={section === 3 ? 'open' : 'locked'}
            resume=""
            onModifier={() => reouvrir(3)}
          >
            {/* Sur une proposition, on s'arrête AVANT le formulaire de contact.
                Le visiteur a vu les prestations, les tarifs et les créneaux —
                c'est tout l'intérêt de la démonstration. Lui demander ensuite
                son nom, son téléphone et son adresse collecterait des données
                personnelles pour un laveur qui n'a rien accepté, et pour un
                rendez-vous qui n'existera jamais. */}
            {estProposition ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Voilà à quoi ressemblerait votre page
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto mb-6">
                  Vos prestations, vos tarifs et vos horaires y sont déjà. Activez-la
                  pour que vos clients puissent réserver et que les rendez-vous
                  tombent dans votre agenda.
                </p>
                <a
                  href="/signup"
                  className="inline-block px-6 py-3 text-white text-sm font-semibold rounded-xl transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  Activer ma page — 1 mois offert
                </a>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Sans carte bancaire</p>
                <button
                  onClick={() => setSection(2)}
                  className="block mx-auto mt-5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ← Revenir aux créneaux
                </button>
              </div>
            ) : (
              <ContactDetails
                actionTarget={section === 3 ? actionTarget : null}
                clientsProAutorises={washer.clients_pro !== false}
                factureApresPrestation={washer.facturation_prete === true}
                vehicles={form.vehicles_detail ?? []}
                onChange={updateForm}
                total={barAmount ?? 0}
                whatsappHref={whatsappHref}
                isProfessional={form.is_professional ?? false}
                loading={loading}
                error={error}
                onSubmit={submitBooking}
                accent={accent}
              />
            )}
          </SectionCard>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm leading-relaxed text-zinc-900 dark:text-zinc-200 py-2 px-1"
            >
              Une question avant de réserver ?{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200 underline underline-offset-2">
                Écrire sur WhatsApp
              </span>
            </a>
          )}

          {barAmount !== null && !(estProposition && section === 3) && (
            <div className="wb-booking-footer">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div aria-live="polite"><p className="text-xs text-zinc-500 dark:text-zinc-400">{barLabel}</p>
                  <p className="text-[28px] leading-tight font-bold tracking-tight tabular-nums">{formatPrice(barAmount)}</p></div>
                {form.service_id && <button type="button" className="text-xs underline underline-offset-2 min-h-11" onClick={() => priceDialog.current?.showModal()}>Détail du prix</button>}
              </div>
              <div ref={setActionTarget} />
              {section === 2 && !dispos && <button type="button" disabled className="wb-booking-continue">Chargement des disponibilités…</button>}
            </div>
          )}
          <dialog ref={priceDialog} className="wb-booking-price-dialog" aria-labelledby="booking-price-title" onClick={e => { if (e.target === e.currentTarget) priceDialog.current?.close() }}>
            <div className="flex items-center justify-between mb-5"><h2 id="booking-price-title" className="text-lg font-bold">Détail du prix</h2>
              <button type="button" aria-label="Fermer le détail du prix" onClick={() => priceDialog.current?.close()} className="w-11 h-11 text-xl">×</button></div>
            <div className="space-y-3 text-sm">
              {(form.vehicles_detail ?? []).map((v, i) => <div key={i}>
                <div className="flex justify-between gap-3"><span>{selectedService?.name} · {v.label ?? v.type}</span><span>{formatPrice(v.unit_price * v.count)}</span></div>
                {(v.addons ?? []).map(a => <div key={a.id} className="flex justify-between gap-3 text-zinc-500 mt-2"><span>{a.label}</span><span>+{formatPrice(a.price)}</span></div>)}
              </div>)}
              <div className="flex justify-between gap-3"><span>Déplacement</span><span>{form.travel_fee !== undefined ? formatPrice(form.travel_fee) : 'À confirmer avec l’adresse'}</span></div>
              {!!form.smart_discount && <div className="flex justify-between text-emerald-700"><span>Créneau avantageux</span><span>−{formatPrice(form.smart_discount)}</span></div>}
              <div className="flex justify-between border-t border-zinc-200 pt-4 text-base font-bold"><span>Total estimé</span><span>{formatPrice(barAmount ?? 0)}</span></div>
              <p className="text-xs text-zinc-500">À régler sur place, après la prestation.</p>
            </div>
          </dialog>
        </>
      )}

      {screen === 'done' && bookingId && (
        <StepConfirmation
          washerName={washer.name}
          bookingId={bookingId}
          form={form}
          services={services}
          whatsappHref={whatsappHref}
        />
      )}
    </div>
  )
}

/** Chrome commun aux trois cartes de l'accordéon : ouverte (son contenu),
 *  validée (une ligne résumé + « Modifier »), ou verrouillée (un repère
 *  numéroté, en pointillés — on ne montre pas un contenu qu'il n'est pas
 *  encore temps de remplir). */
function SectionCard({
  id, numero, titre, etat, resume, onModifier, children,
}: {
  id: string
  numero: number
  titre: string
  etat: 'open' | 'done' | 'locked'
  resume: string
  onModifier: () => void
  children: React.ReactNode
}) {
  return <section id={id} tabIndex={-1} aria-label={titre} className={
    'scroll-mt-4 outline-none rounded-2xl ' + (etat === 'locked'
      ? 'border border-dashed border-zinc-300 dark:border-zinc-700'
      : 'border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900')
  }>
    {etat !== 'open' && <div className="min-h-[58px] px-4 py-2 flex items-center gap-3">
      <span aria-hidden="true" className={'shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs ' + (etat === 'done' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-zinc-300 text-zinc-500')}>
        {etat === 'done' ? '✓' : numero}
      </span>
      <div className="min-w-0 flex-1"><p className={etat === 'done' ? 'text-xs text-zinc-500' : 'text-sm text-zinc-500 font-medium'}>{titre}</p>
        {etat === 'done' && <p className="text-sm truncate">{resume}</p>}</div>
      {etat === 'done' && <button type="button" aria-label={`Modifier : ${titre}`} aria-expanded={false} aria-controls={id + '-content'} onClick={onModifier} className="text-sm underline underline-offset-2 min-h-11">Modifier</button>}
    </div>}
    <div id={id + '-content'} hidden={etat !== 'open'} className="p-4 sm:p-5">{children}</div>
  </section>
}
