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
  budget: number
  visites: number
  reservations: number
  chiffreAffaires: number
}): BilanCampagne {
  return {
    visites,
    reservations,
    tauxConversion: visites > 0 ? (reservations / visites) * 100 : null,
    coutParReservation: reservations > 0 ? budget / reservations : null,
    chiffreAffaires,
    retour: budget > 0 ? chiffreAffaires / budget : null,
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
export type VisiteCampagne = { session_id: string; utm_campaign?: string | null; created_at: string }

/** Une réservation attribuée, telle qu'on la lit dans `bookings`. */
export type ReservationCampagne = {
  utm_campaign?: string | null
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
