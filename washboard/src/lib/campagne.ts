// Suivi des campagnes publicitaires : la logique de calcul, sans base ni
// écran, pour qu'elle soit vérifiable ligne à ligne.
//
// La question à laquelle tout ce fichier répond : « est-ce que cette
// publicité me rapporte de l'argent ? ». Un laveur ne lit pas des
// impressions ni un CPM — il compare ce qu'il a dépensé à ce qu'il a encaissé.

export const PLATEFORMES = [
  { cle: 'meta',   label: 'Meta (Facebook, Instagram)' },
  { cle: 'google', label: 'Google Ads' },
  { cle: 'tiktok', label: 'TikTok Ads' },
  { cle: 'autre',  label: 'Autre' },
] as const

export type Plateforme = typeof PLATEFORMES[number]['cle']

export function estPlateforme(v: unknown): v is Plateforme {
  return typeof v === 'string' && PLATEFORMES.some(p => p.cle === v)
}

export function labelPlateforme(cle: Plateforme): string {
  return PLATEFORMES.find(p => p.cle === cle)?.label ?? 'Autre'
}

/** Longueur maximale de la clé portée par l'URL. Au-delà, le lien devient
 *  impossible à relire dans un gestionnaire de publicités, où il s'affiche
 *  tronqué. */
const CLE_MAX = 40

/** Transforme le nom saisi en clé d'URL : « Pub Rentrée 2026 » → « pub-rentree-2026 ».
 *
 *  Le laveur ne voit jamais cette clé au moment de la saisie ; il voit son
 *  nom. Elle n'existe que pour voyager dans une URL — donc sans accent, sans
 *  espace, sans majuscule : un `utm_campaign=Pub Rentrée` se fait réécrire par
 *  la moitié des gestionnaires de publicités, et l'attribution se perd en
 *  silence.
 *
 *  Rend une chaîne vide si le nom ne contient aucun caractère utilisable
 *  (émojis seuls, ponctuation seule) : à l'appelant de refuser, plutôt que de
 *  fabriquer une clé vide qui collerait toutes les campagnes ensemble. */
export function cleDepuisNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CLE_MAX)
    .replace(/-+$/g, '')               // la troncature peut laisser un tiret
}

/** Rend la clé unique chez ce laveur en suffixant un nombre.
 *
 *  Deux campagnes qui partagent une clé mélangeraient leurs visites et leurs
 *  réservations — et le laveur comparerait des budgets à des chiffres qui ne
 *  leur correspondent pas. Mieux vaut « pub-rentree-2 » qu'un bilan faux. */
export function cleUnique(base: string, dejaPrises: readonly string[]): string {
  if (!base) return ''
  if (!dejaPrises.includes(base)) return base
  for (let i = 2; i < 1000; i++) {
    const essai = `${base.slice(0, CLE_MAX - 4)}-${i}`
    if (!dejaPrises.includes(essai)) return essai
  }
  return `${base.slice(0, CLE_MAX - 14)}-${Date.now().toString(36)}`
}

export type ErreurCampagne = 'nom' | 'budget' | 'dates' | 'cle'

/** Ce qu'une campagne doit vérifier avant d'entrer en base.
 *
 *  Contrôlé ici ET par la migration (CHECK) : l'écran donne un message lisible,
 *  la base garde la dernière main. Un seul des deux ne suffit jamais — l'un
 *  peut être contourné, l'autre ne sait pas expliquer. */
export function erreurCampagne(c: {
  nom?: string | null
  budget?: number | null
  debut?: string | null
  fin?: string | null
}): ErreurCampagne | null {
  if (!c.nom?.trim()) return 'nom'
  if (!cleDepuisNom(c.nom)) return 'cle'
  if (typeof c.budget !== 'number' || !Number.isFinite(c.budget) || c.budget < 0) return 'budget'
  if (!c.debut) return 'dates'
  if (c.fin && c.fin < c.debut) return 'dates'
  return null
}

export const MESSAGES_ERREUR: Record<ErreurCampagne, string> = {
  nom:    'Donnez un nom à votre campagne.',
  cle:    'Le nom doit contenir au moins une lettre ou un chiffre.',
  budget: 'Indiquez le budget investi, en euros.',
  dates:  'La date de fin ne peut pas précéder la date de début.',
}

/** Une campagne telle qu'on en lit une en base. */
export type Campagne = {
  id: string
  nom: string
  plateforme: Plateforme
  budget: number
  cle: string
  debut: string
  fin: string | null
}

/** Vrai si la campagne tourne encore à cette date.
 *
 *  Sans date de fin, elle est en cours : le laveur n'a pas toujours une fin en
 *  tête quand il la crée, et l'obliger à en inventer une fausserait son bilan
 *  le jour où il prolonge. */
export function estEnCours(c: Pick<Campagne, 'debut' | 'fin'>, aujourdHui: string): boolean {
  if (aujourdHui < c.debut) return false
  return c.fin === null || aujourdHui <= c.fin
}

export type BilanCampagne = {
  visites: number
  reservations: number
  /** Part des visites qui ont abouti à une réservation, en pourcentage. */
  tauxConversion: number | null
  /** Ce que lui a coûté chaque client obtenu. */
  coutParReservation: number | null
  chiffreAffaires: number
  /** Combien d'euros encaissés pour un euro dépensé. */
  retour: number | null
}

/** Le bilan d'une campagne, à partir de ce qui a été compté en base.
 *
 *  Les trois ratios valent `null` plutôt que zéro quand ils n'ont pas de sens :
 *  sans visite il n'y a pas de taux de conversion, sans réservation il n'y a
 *  pas de coût par réservation, et sans budget il n'y a pas de retour. Rendre
 *  zéro afficherait « 0 % » et « 0 € » à quelqu'un dont la campagne vient de
 *  démarrer — il conclurait qu'elle ne marche pas alors qu'elle n'a pas encore
 *  eu le temps de marcher. */
export function bilanCampagne({ budget, visites, reservations, chiffreAffaires }: {
  /** `null` = montant inconnu, ce qui n'est pas la même chose que zéro. Meta
   *  répartit souvent le budget tout seul entre les vidéos d'une campagne : le
   *  laveur n'a alors aucun montant par vidéo à saisir. Un budget inconnu rend
   *  les deux montants `null` — un « 0 € par client » ferait passer une vidéo
   *  pour gratuite. */
  budget: number | null
  visites: number
  reservations: number
  chiffreAffaires: number
}): BilanCampagne {
  return {
    visites,
    reservations,
    tauxConversion: visites > 0 ? (reservations / visites) * 100 : null,
    coutParReservation: budget !== null && reservations > 0 ? budget / reservations : null,
    chiffreAffaires,
    retour: budget !== null && budget > 0 ? chiffreAffaires / budget : null,
  }
}

/** Le lien à coller dans la publicité. */
export function lienCampagne(baseUrl: string, cle: string, plateforme: Plateforme): string {
  // `utm_source` en plus de `utm_campaign` : sans lui, la visite n'est
  // rattachée à aucun réseau dans le CRM existant, et la campagne
  // apparaîtrait sous « Accès direct » — deux écrans qui se contredisent sur
  // la même visite.
  const source = plateforme === 'meta' ? 'facebook' : plateforme
  return `${baseUrl}?utm_source=${source}&utm_campaign=${encodeURIComponent(cle)}`
}


/** Une visite, telle qu'on la lit dans `booking_funnel_events`. */
export type VisiteCampagne = {
  session_id: string
  utm_campaign?: string | null
  /** Clé de la création (la vidéo) qui a produit ce clic. Absente sur tout
   *  ce qui a été diffusé avant que le laveur ne déclare ses créations. */
  utm_content?: string | null
  created_at: string
}

/** Une réservation attribuée, telle qu'on la lit dans `bookings`. */
export type ReservationCampagne = {
  utm_campaign?: string | null
  utm_content?: string | null
  created_at: string
  status?: string | null
  booked_price?: number | null
}

/** Vrai si cet instant tombe dans la période déclarée de la campagne.
 *
 *  Les bornes sont des jours, pas des instants : le laveur saisit « du 1er au
 *  30 septembre » et entend bien que le 30 compte en entier. Comparer une date
 *  ISO complète à « 2026-09-30 » exclurait toute la journée du 30. */
function dansLaPeriode(instantISO: string, debut: string, fin: string | null): boolean {
  const jour = instantISO.slice(0, 10)
  if (jour < debut) return false
  return fin === null || jour <= fin
}

/** Le bilan de chaque campagne, calculé en une passe sur les deux listes.
 *
 *  En mémoire plutôt qu'en SQL : deux requêtes au total au lieu de deux par
 *  campagne, et la règle de comptage reste lisible et testable ici plutôt que
 *  dispersée dans des agrégats.
 *
 *  Une VISITE est une session distincte : quelqu'un qui parcourt les quatre
 *  étapes du formulaire produit quatre événements, et compter les événements
 *  gonflerait le trafic d'un facteur quatre — donc écraserait le taux de
 *  conversion d'autant.
 *
 *  Les réservations ANNULÉES ne comptent pas, ni dans le nombre ni dans le
 *  chiffre d'affaires. Même règle que partout ailleurs dans WashBoard : un
 *  rendez-vous annulé n'a rien rapporté, et l'inclure rendrait le retour
 *  affiché mensonger. */
export function bilansParCampagne(
  campagnes: readonly Campagne[],
  visites: readonly VisiteCampagne[],
  reservations: readonly ReservationCampagne[],
): Map<string, BilanCampagne> {
  const sessions = new Map<string, Set<string>>()
  for (const v of visites) {
    if (!v.utm_campaign) continue
    const c = campagnes.find(x => x.cle === v.utm_campaign)
    if (!c || !dansLaPeriode(v.created_at, c.debut, c.fin)) continue
    let vus = sessions.get(c.cle)
    if (!vus) { vus = new Set(); sessions.set(c.cle, vus) }
    vus.add(v.session_id)
  }

  const compte = new Map<string, { n: number; ca: number }>()
  for (const r of reservations) {
    if (!r.utm_campaign || r.status === 'cancelled') continue
    const c = campagnes.find(x => x.cle === r.utm_campaign)
    if (!c || !dansLaPeriode(r.created_at, c.debut, c.fin)) continue
    const acc = compte.get(c.cle) ?? { n: 0, ca: 0 }
    acc.n += 1
    acc.ca += typeof r.booked_price === 'number' && Number.isFinite(r.booked_price) ? r.booked_price : 0
    compte.set(c.cle, acc)
  }

  const bilans = new Map<string, BilanCampagne>()
  for (const c of campagnes) {
    const res = compte.get(c.cle) ?? { n: 0, ca: 0 }
    bilans.set(c.id, bilanCampagne({
      budget: c.budget,
      visites: sessions.get(c.cle)?.size ?? 0,
      reservations: res.n,
      chiffreAffaires: res.ca,
    }))
  }
  return bilans
}

// ════════════════════════════════════════════════════════════════════════════
// Les créations : une ligne par vidéo diffusée
// ════════════════════════════════════════════════════════════════════════════
//
// Une campagne répond à « est-ce que ma pub me rapporte ». Les créations
// répondent à la question du lendemain, qui est celle qui fait gagner de
// l'argent : « LAQUELLE de mes trois vidéos marche ? ».
//
// Sans ce niveau, un laveur qui diffuse quatre vidéos lit une moyenne. La
// moyenne lui dit de couper la campagne, alors qu'une des quatre est peut-être
// rentable — et il coupe la bonne avec les mauvaises.

export const FORMATS = [
  { cle: 'video',     label: 'Vidéo',     pluriel: 'vidéos' },
  { cle: 'image',     label: 'Image',     pluriel: 'images' },
  { cle: 'carrousel', label: 'Carrousel', pluriel: 'carrousels' },
  { cle: 'autre',     label: 'Autre',     pluriel: 'autres' },
] as const

export type Format = typeof FORMATS[number]['cle']

export function estFormat(v: unknown): v is Format {
  return typeof v === 'string' && FORMATS.some(f => f.cle === v)
}

export function labelFormat(cle: Format): string {
  return FORMATS.find(f => f.cle === cle)?.label ?? 'Autre'
}

/** « 3 vidéos, 1 image » — l'inventaire d'une campagne en une ligne.
 *
 *  Écrit dans l'ordre de FORMATS et non dans celui de la saisie : la même
 *  campagne doit produire la même phrase à chaque rendu, sinon l'œil croit que
 *  quelque chose a changé. */
export function inventaireFormats(creations: readonly { format: Format }[]): string {
  return FORMATS
    .map(f => ({ f, n: creations.filter(c => c.format === f.cle).length }))
    .filter(({ n }) => n > 0)
    .map(({ f, n }) => `${n} ${n > 1 ? f.pluriel : f.label.toLowerCase()}`)
    .join(', ')
}

/** Une création telle qu'on en lit une en base. */
export type Creation = {
  id: string
  campagne_id: string
  nom: string
  format: Format
  cle: string
  /** `null` quand le laveur ne connaît pas le budget de CETTE vidéo — le cas
   *  courant, Meta répartissant souvent le budget tout seul. */
  budget: number | null
}

export type ErreurCreation = 'nom' | 'cle' | 'budget'

export const MESSAGES_ERREUR_CREATION: Record<ErreurCreation, string> = {
  nom:    'Donnez un nom à cette vidéo.',
  cle:    'Le nom doit contenir au moins une lettre ou un chiffre.',
  budget: 'Le budget doit être un montant en euros, ou rester vide.',
}

export function erreurCreation(c: {
  nom?: string | null
  budget?: number | null
}): ErreurCreation | null {
  if (!c.nom?.trim()) return 'nom'
  if (!cleDepuisNom(c.nom)) return 'cle'
  // `undefined` et `null` passent : le budget par vidéo est facultatif.
  if (c.budget !== null && c.budget !== undefined
      && (!Number.isFinite(c.budget) || c.budget < 0)) return 'budget'
  return null
}

/** Le lien à coller sous CETTE vidéo.
 *
 *  Un lien par création, et c'est tout le mécanisme : le laveur colle le lien
 *  de la vidéo 1 sous la vidéo 1. Rien à configurer chez Meta, rien à
 *  connecter, aucun accès à demander — ce qui est la seule raison pour laquelle
 *  il le fera vraiment. */
export function lienCreation(
  baseUrl: string,
  cleCampagne: string,
  cleCreation: string,
  plateforme: Plateforme,
): string {
  return `${lienCampagne(baseUrl, cleCampagne, plateforme)}&utm_content=${encodeURIComponent(cleCreation)}`
}

/** En dessous de ce nombre de visites, un taux de transformation ne veut rien
 *  dire.
 *
 *  Une vidéo à 1 réservation sur 3 visites affiche 33 % et paraît excellente ;
 *  c'est du hasard. Les grandes plateformes masquent ces chiffres plutôt que de
 *  les montrer (« données insuffisantes »), parce qu'un taux lu trop tôt fait
 *  couper la bonne vidéo. Trente visites ne rend pas la mesure exacte, mais
 *  c'est le seuil en dessous duquel elle est surtout du bruit. */
export const SEUIL_FIABILITE = 30

export function estFiable(visites: number): boolean {
  return visites >= SEUIL_FIABILITE
}

export type BilanCreation = BilanCampagne & {
  creation: Creation
  /** Part des réservations de la campagne venue de cette création, en
   *  pourcentage. `null` quand la campagne n'a encore aucune réservation. */
  partReservations: number | null
  /** Vrai quand le nombre de visites autorise à lire le taux (voir
   *  SEUIL_FIABILITE). */
  fiable: boolean
}

/** Le bilan de chaque création d'UNE campagne, classées de la meilleure à la
 *  moins bonne.
 *
 *  Le classement porte sur les RÉSERVATIONS, pas sur le taux : le taux se
 *  laisse dominer par une vidéo à trois visites, et c'est précisément l'erreur
 *  qu'on cherche à éviter. À égalité, on départage par le chiffre d'affaires,
 *  puis par les visites, puis par le nom — sans quoi l'ordre changerait d'un
 *  rendu à l'autre. */
export function bilansParCreation(
  campagne: Campagne,
  creations: readonly Creation[],
  visites: readonly VisiteCampagne[],
  reservations: readonly ReservationCampagne[],
): BilanCreation[] {
  const miennes = creations.filter(c => c.campagne_id === campagne.id)

  const sessions = new Map<string, Set<string>>()
  for (const v of visites) {
    if (v.utm_campaign !== campagne.cle || !v.utm_content) continue
    if (!dansLaPeriode(v.created_at, campagne.debut, campagne.fin)) continue
    let vus = sessions.get(v.utm_content)
    if (!vus) { vus = new Set(); sessions.set(v.utm_content, vus) }
    vus.add(v.session_id)
  }

  const compte = new Map<string, { n: number; ca: number }>()
  let totalReservations = 0
  for (const r of reservations) {
    if (r.utm_campaign !== campagne.cle || r.status === 'cancelled') continue
    if (!dansLaPeriode(r.created_at, campagne.debut, campagne.fin)) continue
    // Compté dans le total de la campagne même sans création : c'est ce qui
    // rend la part de chacune honnête quand le laveur a ajouté ses vidéos
    // après le lancement.
    totalReservations += 1
    if (!r.utm_content) continue
    const acc = compte.get(r.utm_content) ?? { n: 0, ca: 0 }
    acc.n += 1
    acc.ca += typeof r.booked_price === 'number' && Number.isFinite(r.booked_price) ? r.booked_price : 0
    compte.set(r.utm_content, acc)
  }

  return miennes
    .map(creation => {
      const res = compte.get(creation.cle) ?? { n: 0, ca: 0 }
      const v = sessions.get(creation.cle)?.size ?? 0
      return {
        creation,
        ...bilanCampagne({
          budget: creation.budget,
          visites: v,
          reservations: res.n,
          chiffreAffaires: res.ca,
        }),
        partReservations: totalReservations > 0 ? (res.n / totalReservations) * 100 : null,
        fiable: estFiable(v),
      }
    })
    .sort((a, b) =>
      b.reservations - a.reservations
      || b.chiffreAffaires - a.chiffreAffaires
      || b.visites - a.visites
      || a.creation.nom.localeCompare(b.creation.nom, 'fr'))
}

/** Ce que la campagne a reçu SANS qu'on sache par quelle création.
 *
 *  Affiché plutôt que caché : le laveur qui déclare ses vidéos trois jours
 *  après le lancement verra que la somme de ses vidéos ne fait pas le total de
 *  sa campagne. Sans cette ligne, il croit que WashBoard perd des
 *  réservations — et il a raison de ne plus faire confiance à des chiffres qui
 *  ne s'additionnent pas. */
export function resteHorsCreations(
  campagne: BilanCampagne,
  creations: readonly BilanCreation[],
): { visites: number; reservations: number; chiffreAffaires: number } {
  const somme = creations.reduce(
    (acc, c) => ({
      visites: acc.visites + c.visites,
      reservations: acc.reservations + c.reservations,
      chiffreAffaires: acc.chiffreAffaires + c.chiffreAffaires,
    }),
    { visites: 0, reservations: 0, chiffreAffaires: 0 },
  )
  // Jamais négatif : une visite peut porter une création supprimée depuis, et
  // afficher « −3 visites » ferait douter de tout l'écran.
  return {
    visites: Math.max(0, campagne.visites - somme.visites),
    reservations: Math.max(0, campagne.reservations - somme.reservations),
    chiffreAffaires: Math.max(0, campagne.chiffreAffaires - somme.chiffreAffaires),
  }
}

/** La synthèse de TOUTES les campagnes, celle qu'on lit en arrivant.
 *
 *  Les totaux s'additionnent, les ratios se recalculent : faire la moyenne des
 *  retours de trois campagnes donne un nombre qui ne correspond à rien. Le
 *  retour global est bien « tout ce qui est encaissé » divisé par « tout ce qui
 *  est dépensé ». */
export function synthese(bilans: readonly BilanCampagne[], budgets: readonly number[]): {
  budget: number
  visites: number
  reservations: number
  chiffreAffaires: number
  retour: number | null
  coutParReservation: number | null
} {
  const budget = budgets.reduce((a, b) => a + b, 0)
  const visites = bilans.reduce((a, b) => a + b.visites, 0)
  const reservations = bilans.reduce((a, b) => a + b.reservations, 0)
  const chiffreAffaires = bilans.reduce((a, b) => a + b.chiffreAffaires, 0)
  return {
    budget, visites, reservations, chiffreAffaires,
    retour: budget > 0 ? chiffreAffaires / budget : null,
    coutParReservation: reservations > 0 ? budget / reservations : null,
  }
}

/** Une campagne prête à afficher : son bilan, ses vidéos classées, et ce qui
 *  est arrivé sans qu'on sache par laquelle.
 *
 *  Déclaré ici et pas dans l'écran : la page qui lit la base et le composant
 *  qui l'affiche doivent parler du même objet, sinon l'un ajoute un champ que
 *  l'autre ignore en silence. */
export type CampagneAffichee = Campagne & {
  bilan: BilanCampagne
  creations: BilanCreation[]
  reste: { visites: number; reservations: number; chiffreAffaires: number }
}
