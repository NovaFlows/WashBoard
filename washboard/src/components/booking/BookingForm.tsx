'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Service, ServiceCategory, Availability, BookingFormData } from '@/types'
import { dureeTotale } from '@/lib/pricing'
import { resumePrestation, resumeCreneau, montantMinimal, montantEstime } from '@/lib/bookingSummary'
import { trackFunnelStep, type FunnelStep, resolveCampagne, resolveCreation } from '@/lib/funnelTracking'
import { evenementPixel } from '@/lib/metaPixel'
import StepService from './StepService'
import StepOptions from './StepOptions'
import StepSlot from './StepSlot'
import StepContact from './StepContact'
import StepConfirmation from './StepConfirmation'

// ─────────────────────────────────────────────────────────────────────────
// Refonte 2026-10 : d'un assistant à écrans pleins (une étape = un écran qui
// remplace le précédent) vers un ACCORDÉON à défilement continu (une étape =
// une carte qui se replie en résumé validé une fois franchie, la suivante
// s'ouvrant dessous). Décision prise sans aller-retour, documentée ici — voir
// le commit qui introduit ce fichier pour le détail du raisonnement :
//
// la maquette (Claude Artifacts, 9 écrans) montrait trois cartes qui
// défilent : Prestation, Où et quand, Coordonnées. Ça correspond exactement
// aux trois premiers `step` qui existaient déjà (`hasAddons` faisait déjà
// cohabiter deux micro-écrans — service puis options — DANS la même étape
// logique). Le changement est donc avant tout un changement de CONTENEUR : on
// garde `StepService`, `StepOptions`, `StepSlot`, `StepContact` strictement
// inchangés (tout leur calcul de prix, de durée, de zone, de créneaux
// intelligents reste la même logique testée) ; seule la manière de les
// empiler change. « Garde la logique, remplace la présentation ».
//
// Le micro-enchaînement service → options reste un petit assistant à deux
// temps À L'INTÉRIEUR de la carte « Prestation » (`substepPrestation`) : les
// options dépendent du véhicule choisi, les fondre dans un seul écran plat
// aurait demandé de réécrire StepService et StepOptions en profondeur pour un
// gain d'ergonomie marginal (la plupart des prestations n'ont pas d'options).
//
// La barre de prix persistante en bas d'écran (fidèle à la maquette) est
// volontairement INFORMATIVE SEULE : pas de bouton d'action dupliqué. Chaque
// carte garde SON bouton Continuer/Retour, seule source de vérité pour la
// validation de cette étape — dupliquer la validation dans un second composant
// aurait multiplié les chemins possibles pour un même état. Le « Détail du
// prix » façon tiroir de la maquette n'a pas été reconstruit non plus : le
// détail (véhicules, options, frais de déplacement) est déjà visible dans la
// carte ouverte au-dessus de la barre.
// ─────────────────────────────────────────────────────────────────────────

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
/** Micro-étape à l'intérieur de la carte « Prestation ». */
type SubstepPrestation = 'service' | 'options'

export default function BookingForm({ washer, services, categories, availabilities, disponibilites, accent = '#2563eb', whatsappHref = null }: Props) {
  const [section, setSection] = useState<Section>(1)
  const [substepPrestation, setSubstepPrestation] = useState<SubstepPrestation>('service')
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
    substepPrestation === 'options' ? 2 : 1

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

  function updateForm(data: Partial<BookingFormData>) {
    setForm(prev => ({ ...prev, ...data }))
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
    : (form.address ? 'Total, à régler sur place' : 'Total estimé, à régler sur place')
  const barAmount = form.service_id ? montantEstime(form) : montantMinimal(services)

  const complete2 = !!(form.scheduled_at && form.address)

  function reouvrir(n: Section) {
    setSection(n)
    // Un clic sur « Modifier » doit ramener la vue sur la carte rouverte,
    // sinon le visiteur reste scrollé devant la carte qu'il vient de
    // refermer et ne voit pas ce qu'il a touché.
    requestAnimationFrame(() => {
      document.getElementById(`wb-section-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div
      id="wb-booking-accordion"
      className="flex flex-col gap-3"
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
            {substepPrestation === 'service' ? (
              <StepService
                services={services}
                categories={categories}
                factureApresPrestation={washer.facturation_prete === true}
                clientsProAutorises={washer.clients_pro !== false}
                selected={{ service_id: form.service_id, vehicle_type: form.vehicle_type }}
                onNext={(data) => {
                  // Changer de prestation invalide les options de la
                  // précédente : les garder fausserait le prix et la durée,
                  // d'autant qu'on peut revenir ici d'un clic sur « Modifier ».
                  const changeDePrestation = data.service_id !== form.service_id
                  updateForm(changeDePrestation ? { ...data, selected_addons: [] } : data)
                  const svc = services.find(s => s.id === data.service_id)
                  if ((svc?.addons ?? []).length > 0) {
                    setSubstepPrestation('options')
                  } else {
                    setPrestationComplete(true)
                    setSection(2)
                  }
                }}
                accent={accent}
              />
            ) : selectedService && (
              <StepOptions
                service={selectedService}
                vehicules={form.vehicles_detail ?? []}
                basePrice={form.booked_price ?? selectedService.price}
                baseDuration={selectedService.duration_minutes}
                onNext={(data) => {
                  updateForm(data)
                  setPrestationComplete(true)
                  setSection(2)
                }}
                onBack={() => setSubstepPrestation('service')}
                accent={accent}
              />
            )}
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
                onNext={(data) => { updateForm(data); setSection(3) }}
                onBack={() => setSection(1)}
                accent={accent}
              />
            )}
          </SectionCard>

          <SectionCard
            id="wb-section-3"
            numero={3}
            titre="Coordonnées"
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
              <StepContact
                isProfessional={form.is_professional ?? false}
                loading={loading}
                error={error}
                onSubmit={submitBooking}
                onBack={() => setSection(2)}
                accent={accent}
              />
            )}
          </SectionCard>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm text-slate-500 dark:text-slate-400 py-1"
            >
              Une question avant de réserver ?{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200 underline underline-offset-2">
                Écrire sur WhatsApp
              </span>
            </a>
          )}

          {/* Barre de prix persistante — purement informative, voir l'en-tête
              de ce fichier. `barAmount` est `null` seulement si le catalogue
              du laveur est vide, cas déjà couvert ailleurs (StepService
              affiche alors son propre message « aucune prestation »). */}
          {barAmount !== null && (
            <div
              className="sticky bottom-0 -mx-4 sm:-mx-6 mt-1 px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex items-baseline justify-between gap-3"
              aria-live="polite"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{barLabel}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{barAmount}€</span>
            </div>
          )}
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
  if (etat === 'locked') {
    return (
      <div
        id={id}
        className="min-h-[58px] px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center gap-3 text-slate-400 dark:text-slate-500"
      >
        <span
          aria-hidden="true"
          className="shrink-0 w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center"
        >
          {numero}
        </span>
        <span className="text-sm font-medium">{titre}</span>
      </div>
    )
  }

  if (etat === 'done') {
    return (
      <div
        id={id}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2.5 flex items-center gap-3"
      >
        <span aria-hidden="true" className="shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-400 dark:text-slate-500">{titre}</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{resume}</div>
        </div>
        <button
          type="button"
          onClick={onModifier}
          className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:opacity-70"
        >
          Modifier
        </button>
      </div>
    )
  }

  return (
    <div
      id={id}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      <div className="px-4 sm:px-6 pt-5 pb-1">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{titre}</h2>
      </div>
      <div className="p-4 sm:p-6 pt-2">{children}</div>
    </div>
  )
}
