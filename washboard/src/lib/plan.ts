// Offres WashBoard et contrôle d'accès aux fonctionnalités.
//
// Grille 2026 (remplace l'ancienne : Essentiel 49 € / Pro 69 €) :
//
//   - decouverte (0 €)   : essayer pour de vrai. 5 réservations/mois,
//                          3 prestations, page marquée WashBoard, agenda et
//                          fiches clients.
//   - starter    (19 €)  : + 15 réservations/mois, catalogue illimité, page
//                          personnalisée, CRM, suivi simple du chiffre d'affaires.
//   - pro        (49 €)  : + réservations illimitées, créneaux et trajets
//                          intelligents, comptabilité et facturation, avis
//                          Google (email et SMS, 150 inclus), relances.
//   - business   (129 €) : + planning collectif, 3 laveurs inclus,
//                          19 €/mois par laveur supplémentaire.
//
// Deux mécanismes distincts, à ne pas confondre :
//   - `hasFeature` : la fonctionnalité existe-t-elle dans l'offre ? (oui/non)
//   - les quotas   : la fonctionnalité existe, mais avec un plafond mensuel.
//
// Les laveurs `grandfathered` (clients historiques) ont tout débloqué et aucun
// plafond, quel que soit leur plan, pour ne jamais leur retirer un acquis.

import { minuitParisUTC } from '@/lib/dateUtils'

/** Domaine servi en production (celui vers lequel washboard.fr redirige). */
export const SITE_URL_FALLBACK = 'https://www.washboard.fr'

export type Plan = 'decouverte' | 'starter' | 'pro' | 'business'
export type Feature =
  | 'page_personnalisee'
  | 'crm'
  | 'ca_simple'
  | 'avis_email'
  | 'avis_sms'
  | 'compta'
  | 'facturation'
  | 'creneaux_intelligents'
  | 'frais_deplacement'
  | 'followup'
  | 'campagnes'
  | 'multi_laveurs'
export type BillingCycle = 'monthly' | 'yearly'

const PLANS: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const RANK: Record<Plan, number> = { decouverte: 0, starter: 1, pro: 2, business: 3 }

// Anciennes valeurs encore présentes en base. Un compte « essentiel » payait
// 49 € : il retrouve exactement ce tarif dans le nouveau Pro, avec davantage
// de fonctionnalités. Le repli se fait donc vers le haut — jamais vers une
// offre moins-disante, sinon un client perdrait un acquis le jour du déploiement.
const PLAN_ALIASES: Record<string, Plan> = {
  essentiel: 'pro',
}

const MIN_PLAN: Record<Feature, Plan> = {
  // Découverte : agenda, fiches clients et réservation. Rien de plus.
  page_personnalisee:    'starter',
  crm:                   'starter',
  ca_simple:             'starter',
  avis_email:            'pro',
  avis_sms:              'pro',
  compta:                'pro',
  facturation:           'pro',
  creneaux_intelligents: 'pro',
  // Ouvert dès l'offre gratuite : un laveur mobile qui se déplace à quinze
  // kilomètres et ne peut pas le facturer perd de l'argent à chaque course.
  // Lui vendre le droit de ne pas travailler à perte serait une drôle de
  // façon de commencer une relation.
  frais_deplacement:     'decouverte',
  followup:              'pro',
  // Suivi des campagnes publicitaires. Réservé au Pro : un laveur qui achète
  // de la publicité a dépassé le stade où il compte ses cinq réservations.
  campagnes:             'pro',
  multi_laveurs:         'business',
}

export const PLAN_LABELS: Record<Plan, string> = {
  decouverte: 'Découverte',
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
}

/** Une couleur par offre, pour la reconnaître d'un coup d'œil.
 *
 *  Le laveur croise son offre à cinq endroits — le badge de l'en-tête, le
 *  menu, la grille tarifaire, la jauge, les cartes verrouillées. Quatre noms
 *  qui se ressemblent (« Starter », « Pro ») se relisent à chaque fois ; une
 *  couleur se reconnaît sans lire.
 *
 *  L'ordre suit la montée en gamme, et c'est volontaire : gris pour le gratuit,
 *  puis les deux couleurs de la marque, puis le violet réservé au haut de
 *  gamme. On ne saute pas d'une famille de teintes à l'autre au milieu.
 *
 *  Une pastille est un REPÈRE, jamais la seule information : chaque endroit qui
 *  en pose garde le nom de l'offre à côté. Un laveur daltonien ne doit rien
 *  perdre. */
export const PLAN_COULEURS: Record<Plan, string> = {
  decouverte: '#94A3B8',  // ardoise : c'est gratuit, ça ne se met pas en avant
  starter:    '#00C4D4',  // cyan WashBoard
  pro:        '#1651E8',  // bleu WashBoard, celui des boutons
  business:   '#7C3AED',  // violet : la seule teinte qui ne sert à rien d'autre
}

export const PLAN_PRICES: Record<Plan, number> = {
  decouverte: 0,
  starter:    19,
  pro:        49,
  business:   129,
}

// ── Quotas mensuels ────────────────────────────────────────────────────────
//
// `null` = pas de plafond. On écrit `null` et pas `Infinity` : une valeur
// numérique invite à la comparer, et une comparaison oubliée sur `Infinity`
// passe inaperçue, là où un `null` fait échouer le typage.

/** Réservations acceptées par mois civil (fuseau Paris). */
export const BOOKING_QUOTA: Record<Plan, number | null> = {
  decouverte: 5,
  starter:    15,
  pro:        null,
  business:   null,
}

/** La première offre dont le catalogue n'a plus de plafond.
 *
 *  Calculée plutôt qu'écrite en dur : déplacer le catalogue illimité d'un
 *  palier à l'autre ne doit pas laisser les écrans proposer la mauvaise offre.
 *  Le laveur qui bute sur son plafond doit lire le nom de celle qui le lève,
 *  pas « l'offre supérieure » — qui ne lui dit ni laquelle ni combien. */
export function offreCatalogueIllimite(): Plan {
  return PLANS.find(p => SERVICE_QUOTA[p] === null) ?? 'starter'
}

/** Prestations au catalogue. Ce n'est pas un plafond mensuel : c'est le
 *  nombre de lignes que le laveur peut avoir en même temps. */
export const SERVICE_QUOTA: Record<Plan, number | null> = {
  decouverte: 3,
  starter:    null,
  pro:        null,
  business:   null,
}

/** SMS d'avis inclus par mois (0 = email uniquement). */
export const SMS_QUOTA: Record<Plan, number> = {
  decouverte: 0,
  starter:    0,
  pro:        150,
  business:   150,
}

/** Laveurs simultanés compris dans l'offre. Au-delà, c'est facturé
 *  (PRIX_LAVEUR_SUPPLEMENTAIRE) — ce n'est pas un blocage technique, mais le
 *  chiffre affiché au laveur avant qu'il augmente son équipe. */
export const TEAM_SIZE_INCLUS: Record<Plan, number> = {
  decouverte: 1,
  starter:    1,
  pro:        1,
  business:   3,
}

export const PRIX_LAVEUR_SUPPLEMENTAIRE = 19

/** Offre dont dispose un laveur pendant son essai gratuit.
 *
 *  L'essai montre le produit complet : le brider à l'offre gratuite en ferait
 *  une démonstration de ce qu'on ne vend pas. À la fin de l'essai, faute de
 *  paiement, le compte retombe sur la grille normale. */
export const PLAN_ESSAI: Plan = 'pro'

/** Offre à laquelle correspond le tarif des clients historiques
 *  (`grandfathered`). Ils payaient 49 € pour l'ancien Essentiel : c'est
 *  exactement le tarif du Pro dans la grille 2026, et ils ont tout débloqué.
 *  Sert à afficher LEUR prix, jamais celui de la première carte de la grille —
 *  qui est désormais l'offre gratuite. */
export const PLAN_HISTORIQUE: Plan = 'pro'

// ── Fin de l'essai : retour sur l'offre gratuite ────────────────────────────
//
// Règle 2026 : un laveur essaie le produit complet pendant 30 jours. À la fin,
// on lui demande quelle formule il veut. S'il ne choisit pas, il RETOMBE SUR
// DÉCOUVERTE — il n'est pas coupé. Un compte vivant à 5 réservations par mois
// vaut mieux qu'un compte mort : il continue à recevoir des clients, et le
// jour où son activité décolle, il paie.
//
// Avant cette règle, un essai terminé menait à la suspension de la page de
// réservation après 30 jours de grâce. C'est le comportement que gardent les
// comptes plus anciens, volontairement (voir la constante ci-dessous).

/** Un compte créé À PARTIR de cette date suit la règle 2026 ; les comptes plus
 *  anciens gardent le comportement qu'ils ont toujours connu.
 *
 *  Ce n'est pas une précaution technique mais une précaution COMMERCIALE : on
 *  ne change pas les règles sous les pieds de clients déjà en place, et on
 *  observe d'abord la bascule sur de vrais comptes neufs.
 *
 *  Deux leviers, un seul endroit :
 *    - étendre la règle à tout le monde → reculer la date ('2020-01-01') ;
 *    - la désactiver entièrement        → la placer dans le futur.
 *
 *  Pour l'ESSAYER sans attendre 30 jours : créer un compte (il sera forcément
 *  postérieur à cette date), puis reculer son `trial_ends_at` dans le passé. */
export const RETOUR_GRATUIT_POUR_COMPTES_CREES_DES = '2026-09-24T00:00:00.000Z'

/** Date à partir de laquelle le plafond de réservations masque quelque chose.
 *
 *  Le plafond ne vaut QUE pour l'avenir. Un laveur qui avait quarante-neuf
 *  clients la veille du déploiement les garde tous : ce sont des gens qu'il a
 *  lavés, appelés, facturés. Les lui cacher du jour au lendemain pour lui
 *  vendre une offre, ce n'est pas de la pression commerciale, c'est lui
 *  reprendre son propre travail — et c'est le meilleur moyen de perdre le
 *  client au lieu de le faire monter.
 *
 *  Mesuré sur `created_at` de la réservation, pas sur la date du rendez-vous :
 *  c'est le moment où la demande est arrivée qui compte, et lui seul ne bouge
 *  plus jamais.
 *
 *  À CALER SUR LA DATE DE DÉPLOIEMENT de la grille à quatre offres. Plus tôt
 *  elle est placée, plus d'historique se retrouve masqué ; la reculer à
 *  '2020-01-01' applique le plafond à tout le passé, la placer dans le futur
 *  le désactive complètement. */
export const PLAFOND_RESERVATIONS_APPLIQUE_DES = '2026-09-24T00:00:00.000Z'

/** Le plus tardif entre le début d'une période et l'entrée en vigueur du
 *  plafond. Sert à ne compter, et à ne masquer, que ce qui vient après. */
export function debutSoumisAuPlafond(debut: Date): Date {
  const entree = new Date(PLAFOND_RESERVATIONS_APPLIQUE_DES)
  if (Number.isNaN(entree.getTime())) return debut
  return entree.getTime() > debut.getTime() ? entree : debut
}

/** Comptes soumis à la règle 2026 QUELLE QUE SOIT leur date de création,
 *  désignés par le lien public de leur page de réservation (`slug`).
 *
 *  Sert à deux choses, dans cet ordre :
 *    1. ESSAYER la bascule sur un compte à soi, sans attendre un mois et sans
 *       réécrire la date de création d'une ligne de production — une date
 *       falsifiée est une information fausse qui reste en base pour toujours,
 *       et personne ne se souviendra pourquoi dans six mois ;
 *    2. plus tard, faire passer les clients existants un par un plutôt que
 *       tous d'un coup en reculant la date ci-dessus.
 *
 *  Un compte listé ici voit exactement ce que verra un compte neuf. La liste
 *  est dans le code, pas dans une variable d'environnement : c'est une règle
 *  qui décide qui est rétrogradé, elle doit se relire dans l'historique Git. */
export const COMPTES_TEST_RETOUR_GRATUIT: string[] = [
  // Exemple : 'mon-compte-de-test'
]

/** Ce qu'il faut savoir d'un compte pour trancher la fin d'essai. Tous les
 *  champs sont facultatifs : un appelant qui ne les lit pas obtient le
 *  comportement d'avant, jamais une perte d'accès par omission. */
export type AbonnementInfo = PlanInfo & {
  /** Lien public du laveur, pour la liste de bascule anticipée ci-dessus. */
  slug?: string | null
  created_at?: string | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  subscription_ends_at?: string | null
}

// ── Simulation, en développement UNIQUEMENT ────────────────────────────────
//
// Regarder de ses yeux ce que voit un laveur sur telle ou telle offre ne
// devrait pas obliger à modifier une ligne de la base de production. C'était
// pourtant la seule façon de le faire : reculer un `trial_ends_at`, ou
// éteindre un `grandfathered` — avec le risque d'oublier de le remettre et de
// retirer son accès complet à quelqu'un sans que personne ne s'en aperçoive.
//
// Ces deux variables donnent le même résultat sans rien écrire nulle part.
// Elles sont INERTES en production (`NODE_ENV`), y compris sur un déploiement
// de prévisualisation Vercel : elles ne servent qu'en local, `npm run dev`.

function enProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** `NEXT_PUBLIC_DEV_OFFRE=starter` — force l'offre vue par TOUS les comptes. */
function offreForceeEnDev(): Plan | null {
  if (enProduction()) return null
  const v = process.env.NEXT_PUBLIC_DEV_OFFRE
  return v && PLANS.includes(v as Plan) ? (v as Plan) : null
}

/** `NEXT_PUBLIC_DEV_FIN_ESSAI=1` — fait comme si l'essai venait de se terminer
 *  sans formule choisie : offre Découverte et invitation à choisir. */
function finEssaiSimuleeEnDev(): boolean {
  if (enProduction()) return false
  return process.env.NEXT_PUBLIC_DEV_FIN_ESSAI === '1'
}

/** Vrai dès qu'une des deux simulations est active. Sert à passer OUTRE le
 *  statut de client historique : sans ça, simuler depuis un compte
 *  `grandfathered` — celui de l'équipe, typiquement — ne montrerait rien. */
function simulationActive(): boolean {
  return offreForceeEnDev() !== null || finEssaiSimuleeEnDev()
}

/** Ce compte suit-il la règle 2026 ? */
export function suitRetourGratuit(
  w: AbonnementInfo | null | undefined,
  // La liste est un paramètre pour rester vérifiable : sans ça, un test ne
  // pourrait constater la bascule anticipée qu'en attendant qu'un vrai compte
  // y figure — c'est-à-dire jamais.
  liste: readonly string[] = COMPTES_TEST_RETOUR_GRATUIT,
): boolean {
  // Bascule anticipée, demandée explicitement compte par compte.
  if (w?.slug && liste.includes(w.slug)) return true

  // Sans date de création, on ne change rien : l'absence d'information ne doit
  // jamais faire basculer un compte dont on ne sait rien.
  if (!w?.created_at) return false
  const cree = new Date(w.created_at)
  if (Number.isNaN(cree.getTime())) return false
  return cree.getTime() >= new Date(RETOUR_GRATUIT_POUR_COMPTES_CREES_DES).getTime()
}

/** L'essai (ou la période payée) est terminé et aucune formule n'est réglée. */
export function essaiTermineSansFormule(
  w: AbonnementInfo | null | undefined,
  now: Date = new Date(),
): boolean {
  if (w?.grandfathered) return false
  // `past_due` = prélèvement en échec, relance Stripe en cours : l'accès est
  // conservé le temps de la relance, on ne rétrograde pas quelqu'un qui paie.
  if (w?.subscription_status === 'active' || w?.subscription_status === 'past_due') return false
  const fin = w?.subscription_ends_at ?? w?.trial_ends_at
  if (!fin) return false
  const echeance = new Date(fin)
  if (Number.isNaN(echeance.getTime())) return false
  return now.getTime() > echeance.getTime()
}

/** Vrai si ce compte a tout ouvert en tant que client historique.
 *
 *  Distinct de `grandfathered` lu brut : sous simulation locale, on veut voir
 *  ce que voit un laveur ordinaire. Sans ce détour, le bandeau affichait
 *  « Accès complet » pendant que toutes les sections étaient verrouillées —
 *  deux informations contradictoires sur le même écran. */
export function accesComplet(w: PlanInfo | null | undefined): boolean {
  return !!w?.grandfathered && !simulationActive()
}

/** L'offre qui s'applique RÉELLEMENT aujourd'hui.
 *
 *  `washerPlan` dit ce qui est écrit en base ; celle-ci dit ce à quoi le laveur
 *  a droit maintenant. Rien n'est réécrit en base : la bascule est un calcul,
 *  donc réversible à la seconde — reculer d'une case la constante ci-dessus
 *  suffit à tout remettre comme avant, sans migration de rattrapage. */
export function planEffectif(
  w: AbonnementInfo | null | undefined,
  now: Date = new Date(),
): Plan {
  const forcee = offreForceeEnDev()
  if (forcee) return forcee
  if (finEssaiSimuleeEnDev()) return 'decouverte'

  if (suitRetourGratuit(w) && essaiTermineSansFormule(w, now)) return 'decouverte'
  return washerPlan(w)
}

/** Vrai quand il faut demander au laveur de choisir sa formule : son essai est
 *  fini, il n'a rien réglé, et il est déjà retombé sur l'offre gratuite. */
export function doitChoisirFormule(
  w: AbonnementInfo | null | undefined,
  now: Date = new Date(),
): boolean {
  if (finEssaiSimuleeEnDev()) return true
  return suitRetourGratuit(w) && essaiTermineSansFormule(w, now)
}

// Les clients historiques avaient un quota illimité via l'ancien plan Business ;
// on le leur conserve explicitement maintenant que ce plan n'existe plus.
export const GRANDFATHERED_SMS_QUOTA = 100000

// Engagement annuel : 1 mois offert (on facture 11 mois pour 12).
export const YEARLY_FREE_MONTHS = 1

export function yearlyPrice(monthlyPrice: number): number {
  return monthlyPrice * (12 - YEARLY_FREE_MONTHS)
}

/** « 1 mois offert » / « 2 mois offerts ».
 *
 *  L'accord était écrit en dur au pluriel à cinq endroits : passer l'offre à
 *  un seul mois affichait « 1 mois offerts ». Une seule source évite d'en
 *  oublier un. */
export function freeMonthsLabel(): string {
  return YEARLY_FREE_MONTHS > 1
    ? `${YEARLY_FREE_MONTHS} mois offerts`
    : `${YEARLY_FREE_MONTHS} mois offert`
}

// Prix mensuel équivalent d'un engagement annuel, arrondi au centime.
export function yearlyMonthlyEquivalent(monthlyPrice: number): number {
  return Math.round((yearlyPrice(monthlyPrice) / 12) * 100) / 100
}

// Formatage FR d'un montant : "40,83" / "57,50" / "490". Un montant rond
// s'écrit sans centimes ; dès qu'il y en a, on affiche les deux décimales
// (sinon on obtiendrait "57,5 €", qui ne se lit pas comme un prix).
export function formatEuros(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Descriptif des offres (partagé entre la page Abonnement et la landing).
// `price` est toujours le tarif mensuel ; l'annuel s'en déduit via yearlyPrice().
//
// Règle de rédaction : on n'annonce ici que ce que le produit sait faire
// aujourd'hui. Une ligne de plus sur une carte, c'est une promesse de vente.
/** Durée du rendez-vous proposé sur l'offre Business, en minutes.
 *  Écrite ici parce qu'elle s'affiche sur le bouton et doit dire la vérité :
 *  si l'agenda passe à 45 minutes, c'est le bouton qui doit changer. */
export const RDV_BUSINESS_MINUTES = 30

/** La page de prise de rendez-vous de WashBoard, faite maison.
 *  Calendrier, créneaux libres, trente minutes : « Planifier un appel ». */
const PAGE_RENDEZ_VOUS = '/booking'

/** Où mène « Nous contacter » sur l'offre Business.
 *
 *  Vers notre propre page de rendez-vous : le prospect choisit sa date et son
 *  créneau, l'appel se pose dans l'agenda. Pas de message à échanger pour
 *  convenir d'une heure — c'est exactement le travail qu'un agenda supprime,
 *  et c'est pour ça qu'on ne renvoie ni vers WhatsApp ni vers un email.
 *
 *  `NEXT_PUBLIC_RDV_BUSINESS_URL` permet de basculer vers un agenda externe
 *  (Cal.com, Calendly, plage de rendez-vous Google) sans toucher au code, par
 *  exemple le jour où on veut le lien Meet automatique. Sans elle, c'est notre
 *  page qui sert. */
export function lienRendezVousBusiness(): string {
  return process.env.NEXT_PUBLIC_RDV_BUSINESS_URL || PAGE_RENDEZ_VOUS
}

/** Vrai si ce lien sort du site : seul ce cas justifie d'ouvrir un onglet. */
export function rendezVousExterne(lien: string): boolean {
  return !lien.startsWith('/')
}

/** Ce qu'affiche le bouton d'une offre sans tarif. */
export const LIBELLE_CONTACT = 'Nous contacter'
export const LIBELLE_RDV_BUSINESS = `Prendre rendez-vous — ${RDV_BUSINESS_MINUTES} min`

export type PlanCard = {
  key: Plan
  name: string
  price: number
  /** Tarif de départ (le prix dépend du nombre de laveurs). */
  from?: boolean
  /** Offre sans tarif affiché : on montre « Nous contacter » et on propose un
   *  rendez-vous. Le prix existe toujours dans `PLAN_PRICES` — il sert au
   *  calcul et à Stripe — mais il n'est plus annoncé publiquement. */
  surDevis?: boolean
  tagline: string
  features: string[]
  /** Offre mise en avant sur la grille. */
  highlight?: boolean
}

export const PLAN_CARDS: PlanCard[] = [
  {
    key: 'decouverte', name: 'Découverte', price: 0,
    tagline: 'Pour essayer avec de vrais clients.',
    features: [
      '5 réservations par mois',
      '3 prestations au catalogue',
      'Agenda et fiches clients',
      'Frais de déplacement facturés au client',
      'Page de réservation aux couleurs WashBoard',
    ],
  },
  {
    key: 'starter', name: 'Starter', price: 19,
    tagline: 'Pour remplir son planning sans y penser.',
    // Chaque offre payante s'ouvre sur « Tout le … » : sans cette ligne, un
    // laveur qui compare quatre colonnes croit que passer au Starter lui FAIT
    // PERDRE l'agenda et les fiches clients, puisqu'ils n'y sont plus écrits.
    // Le Business le disait déjà ; les deux autres ne le disaient pas.
    features: [
      'Tout le Découverte',
      '15 réservations par mois',
      'Catalogue de prestations illimité',
      'Page de réservation personnalisée (logo, couleurs)',
      'CRM : d’où viennent vos clients',
      'Suivi simple du chiffre d’affaires',
    ],
  },
  {
    key: 'pro', name: 'Pro', price: 49, highlight: true,
    tagline: 'Pour vivre de son activité.',
    features: [
      'Tout le Starter',
      'Réservations illimitées',
      'Créneaux intelligents',
      'Comptabilité et facturation conforme (SIRET, TVA)',
      'Avis Google automatiques — email et SMS (150/mois)',
      'Relances de suivi client',
      'Suivi de vos campagnes publicitaires',
    ],
  },
  {
    key: 'business', name: 'Business', price: 129, surDevis: true,
    tagline: 'Pour une équipe sur la route.',
    features: [
      'Tout le Pro',
      '3 laveurs inclus',
      // Le montant par laveur n'est plus annoncé : une carte qui dit
      // « Nous contacter » et imprime un tarif deux lignes plus bas se
      // contredit toute seule. PRIX_LAVEUR_SUPPLEMENTAIRE reste la référence
      // interne, pour le devis et la facturation.
      'Tarif selon la taille de votre équipe',
      'Planning collectif (rendez-vous simultanés)',
    ],
  },
]

type PlanInfo = { plan?: string | null; grandfathered?: boolean | null }

export function washerPlan(w: PlanInfo | null | undefined): Plan {
  const brut = String(w?.plan ?? 'decouverte')
  if (PLANS.includes(brut as Plan)) return brut as Plan
  // Valeur héritée connue, sinon repli sur l'offre gratuite : une chaîne
  // inconnue en base ne doit jamais ouvrir un accès payant.
  return PLAN_ALIASES[brut] ?? 'decouverte'
}

export function hasFeature(w: AbonnementInfo | null | undefined, feature: Feature): boolean {
  if (w?.grandfathered && !simulationActive()) return true
  return RANK[planEffectif(w)] >= RANK[MIN_PLAN[feature]]
}

/** L'offre minimale qui ouvre cette fonctionnalité.
 *
 *  Exposée en plus du libellé : un écran qui propose de changer d'offre a
 *  besoin du PRIX et de ce qu'elle contient, pas seulement de son nom. Sans
 *  ça, le laveur lit « offre Starter », doit aller chercher ailleurs combien
 *  ça coûte, et la plupart n'y vont pas. */
export function requiredPlan(feature: Feature): Plan {
  return MIN_PLAN[feature]
}

// Libellé du plan minimum requis pour une fonctionnalité (pour les invites d'upgrade).
export function requiredPlanLabel(feature: Feature): string {
  return PLAN_LABELS[requiredPlan(feature)]
}

// ── Lecture des quotas ─────────────────────────────────────────────────────

/** Réservations autorisées ce mois-ci, `null` si illimité. */
export function quotaReservations(w: AbonnementInfo | null | undefined): number | null {
  if (w?.grandfathered && !simulationActive()) return null
  return BOOKING_QUOTA[planEffectif(w)]
}

/** La MOINS CHÈRE des offres supérieures qui couvre le volume du mois.
 *
 *  Un laveur à sept réservations sur une offre plafonnée à cinq n'a pas besoin
 *  du Pro : le Starter, à dix euros de moins, lui rend déjà ses deux clients
 *  cachés. Proposer systématiquement l'offre sans plafond fait passer l'écran
 *  pour ce qu'il ne doit pas être — une caisse enregistreuse. On propose ce
 *  qu'il lui faut ; s'il lui en faut plus, il montera plus tard, et il le fera
 *  de meilleure grâce.
 *
 *  Le plafond doit couvrir CE QUI EST DÉJÀ ARRIVÉ (`quota >= volume`), parce
 *  que le bouton promet de débloquer ces clients-là. Sans certitude sur le
 *  volume, on renvoie l'offre sans plafond : mieux vaut proposer trop que
 *  promettre un déblocage qui n'aurait pas lieu.
 *
 *  Renvoie l'offre actuelle quand il n'y a rien au-dessus. */
export function offreQuiCouvre(actuel: Plan, reservationsCeMois: number | null): Plan {
  const superieures = PLANS.filter(p => RANK[p] > RANK[actuel])
  if (superieures.length === 0) return actuel

  const sansPlafond = superieures.find(p => BOOKING_QUOTA[p] === null)
  if (reservationsCeMois === null) return sansPlafond ?? superieures[superieures.length - 1]

  const couvre = superieures.find(p => {
    const q = BOOKING_QUOTA[p]
    return q === null || q >= reservationsCeMois
  })
  return couvre ?? superieures[superieures.length - 1]
}

/** Prestations autorisées au catalogue, `null` si illimité. */
export function quotaPrestations(w: AbonnementInfo | null | undefined): number | null {
  if (w?.grandfathered && !simulationActive()) return null
  return SERVICE_QUOTA[planEffectif(w)]
}

/** Vrai si un élément de plus dépasse le plafond. `dejaUtilise` est le nombre
 *  d'éléments AVANT l'ajout : avec un quota de 5, on accepte les cinq
 *  premiers et on refuse le sixième. */
export function quotaDepasse(quota: number | null, dejaUtilise: number): boolean {
  return quota !== null && dejaUtilise >= quota
}

/** Instant UTC du 1er du mois courant, à minuit heure de Paris.
 *
 *  Les quotas sont mensuels et se remettent à zéro le 1er. Le calcul passe par
 *  le fuseau parisien : borner sur l'UTC ferait basculer les réservations du
 *  1er avant 2h du matin sur le mois précédent (déjà consommé), et ferait donc
 *  refuser une réservation alors que le compteur venait d'être remis à zéro. */
export function debutDuMoisParis(now: Date = new Date()): Date {
  const [annee, mois] = now
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    .split('-')
  return minuitParisUTC(`${annee}-${mois}-01`)
}

/** Jour du mois d'une date, à l'heure de Paris. */
function jourParis(quand: Date): number {
  return Number(quand.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(8, 10))
}

/** Nombre de jours du mois (annee, mois) — `mois` de 1 à 12. */
function joursDansLeMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate()
}

/** Début de la période de quota en cours, à minuit heure de Paris.
 *
 *  Le compteur ne repart PLUS le 1er du mois : il repart à la date anniversaire
 *  de l'inscription. Un laveur inscrit le 22 a son mois du 22 au 21. Le 1er du
 *  mois était un choix d'implémentation qui se voyait : quelqu'un qui
 *  s'inscrivait le 28 consommait son quota entier en trois jours, puis
 *  attendait. Il payait un mois et en recevait trois jours.
 *
 *  Le jour d'ancrage est plafonné à la longueur du mois : inscrit un 31, il est
 *  servi le 28 en février et le 30 en avril. Le décaler au 1er du mois suivant
 *  reviendrait à lui offrir jusqu'à trois jours de quota en plus chaque année ;
 *  le reculer d'un jour le pénaliserait autant. Le dernier jour du mois est la
 *  seule lecture qui ne fabrique ni cadeau ni punition.
 *
 *  Sans date d'inscription lisible, on retombe sur le 1er du mois : une règle
 *  imparfaite vaut mieux qu'un plantage sur la page de réservation. */
export function debutPeriodeQuota(
  creeLe: string | Date | null | undefined,
  now: Date = new Date(),
): Date {
  if (!creeLe) return debutDuMoisParis(now)
  const creation = creeLe instanceof Date ? creeLe : new Date(creeLe)
  if (Number.isNaN(creation.getTime())) return debutDuMoisParis(now)

  const ancre = jourParis(creation)
  const [a, m, j] = now
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    .split('-')
    .map(Number)

  // Le mois en cours d'abord ; si son ancrage n'est pas encore passé, celui du
  // mois précédent.
  let annee = a
  let mois = m
  if (j < Math.min(ancre, joursDansLeMois(a, m))) {
    mois -= 1
    if (mois === 0) { mois = 12; annee -= 1 }
  }
  const jour = Math.min(ancre, joursDansLeMois(annee, mois))
  return minuitParisUTC(`${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`)
}

/** Début de la période SUIVANTE : la date à laquelle le compteur repart.
 *  C'est ce que les écrans annoncent au laveur — « jusqu'au 22 octobre » vaut
 *  mieux que « le mois prochain », qui ne dit pas quand. */
export function finPeriodeQuota(
  creeLe: string | Date | null | undefined,
  now: Date = new Date(),
): Date {
  const debut = debutPeriodeQuota(creeLe, now)
  // Un jour après le début suffit à tomber dans la période suivante, quelle que
  // soit sa longueur : on relance le même calcul depuis là.
  const dansLaSuivante = new Date(debut.getTime())
  dansLaSuivante.setUTCMonth(dansLaSuivante.getUTCMonth() + 1)
  dansLaSuivante.setUTCDate(dansLaSuivante.getUTCDate() + 1)
  return debutPeriodeQuota(creeLe, dansLaSuivante)
}

/** La date de remise à zéro, écrite pour être lue : « 22 octobre ». */
export function libelleRemiseAZero(
  creeLe: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  return finPeriodeQuota(creeLe, now).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'long',
  })
}

// Vrai si la période de grâce de 30 jours après l'échéance (subscription_ends_at,
// ou trial_ends_at si jamais encore abonné) est dépassée. Un abonnement actif
// n'est jamais concerné — à vérifier séparément par l'appelant.
export function graceEnded(
  subscriptionEndsAt: string | null,
  trialEndsAt: string | null,
  now: Date = new Date(),
): boolean {
  const baseDate = subscriptionEndsAt ? new Date(subscriptionEndsAt) : trialEndsAt ? new Date(trialEndsAt) : null
  if (!baseDate) return false
  const graceEnd = new Date(baseDate)
  graceEnd.setDate(graceEnd.getDate() + 30)
  return now > graceEnd
}

// Nombre de mois dus depuis la dernière échéance payée (subscription_ends_at,
// ou trial_ends_at si jamais encore abonné). 0 tant que l'échéance n'est pas
// passée ; 1 dès le jour J ; +1 par tranche de 30 jours de retard supplémentaire.
export function monthsOwed(
  subscriptionEndsAt: string | null,
  trialEndsAt: string | null,
  now: Date = new Date(),
): number {
  const baseDate = subscriptionEndsAt ? new Date(subscriptionEndsAt) : trialEndsAt ? new Date(trialEndsAt) : null
  if (!baseDate) return 0
  const diffDays = (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 0) return 0
  return Math.floor(diffDays / 30) + 1
}
