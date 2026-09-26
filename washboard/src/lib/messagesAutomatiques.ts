// Messages automatiques (refonte 2026) : ce qui est réglé, ce qui va partir, ce
// qui est parti. Du calcul pur, sans requête — la page lit les réglages et les
// rendez-vous, ce module les interprète.
//
// RÈGLE D'OR : reproduire ce que les crons font VRAIMENT, pas ce que la
// maquette suggère. Chaque règle ci-dessous renvoie à la ligne du cron qui la
// dicte (`api/cron/send-reviews`, `api/cron/send-followups`, `lib/relances.ts`).
// Deux écarts assumés avec la maquette, parce que la base ne sait pas mieux :
//
//  · pas de « 5 étoiles reçues » — aucun lien entre une demande d'avis et
//    l'avis Google qui en découle ;
//  · pas de « pas de réponse » — WashBoard ne voit pas les réponses. Il voit
//    seulement si le client a repris un rendez-vous APRÈS la relance
//    (« a réservé depuis »), sans pouvoir prouver que le message en est la cause.
//
// Ce qui est DÉDUIT plutôt que lu (et signalé comme tel à l'écran) :
//
//  · demande d'avis par email envoyée : `review_request_sent_at` est posé aussi
//    quand le cron ÉCARTE la demande (client sans email, avis désactivé entre
//    temps) et même après un échec d'envoi. Seul `review_sms_sent_at` prouve un
//    envoi ; l'email est déduit, sous conditions (voir `messagesPartis`) ;
//  · relance envoyée : `followup_sent_at` veut dire « relance TRAITÉE » —
//    envoyée OU close (`lib/relances.ts`). Un rendez-vous n'a porté une vraie
//    relance que si le client n'avait, à ce moment-là, aucun rendez-vous plus
//    récent (voir `relanceEstPartie`).

import { formatHeureCompacte, FUSEAU } from './dateUtils'
import { aujourdhuiParis } from './chiffresPeriode'

export type Canal = 'email' | 'sms'

export type ReglagesMessages = {
  review_enabled: boolean
  review_delay_hours: number
  google_review_url: string | null
  review_channel: Canal
  followup_enabled: boolean
  followup_delay_days: number
  followup_message: string | null
}

/** Ce que la page lit sur chaque rendez-vous. Les colonnes d'horodatage sont
 *  facultatives : absentes, elles valent « jamais posées ». */
export type RdvMessage = {
  id: string
  client_name: string
  client_email: string | null
  client_phone?: string | null
  scheduled_at: string
  created_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  is_professional?: boolean | null
  company_name?: string | null
  services?: { name: string } | null
  review_request_at?: string | null
  review_request_sent_at?: string | null
  review_sms_sent_at?: string | null
  followup_sent_at?: string | null
}

/** Ce que le plan du laveur autorise — le cron d'avis refuse le SMS sans
 *  `avis_sms` (il traite alors la demande sans rien envoyer). */
export type ContexteMessages = { smsAutorise: boolean }

/** Valeurs par défaut de la base, reprises du formulaire v1 (`?? 3`, `?? 90`). */
export const DELAI_AVIS_DEFAUT_HEURES = 3
export const DELAI_RELANCE_DEFAUT_JOURS = 90
/** Bornes appliquées par `PATCH /api/washer` : au-delà, le serveur écrête. */
export const DELAI_AVIS_MAX_HEURES = 168
export const DELAI_RELANCE_MAX_JOURS = 730
export const RELANCE_MESSAGE_MAX = 500

const HEURE = 3_600_000
const JOUR = 86_400_000
/** La liste « Programmé » ne regarde pas plus loin que cette fenêtre. */
export const FENETRE_PROGRAMME_JOURS = 7
/** La liste « Parti » remonte de cette fenêtre. */
export const FENETRE_PARTI_JOURS = 7

const t = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN)

// ── Résumés des deux lignes ─────────────────────────────────────────────────

export const libelleCanal = (c: Canal): string => (c === 'sms' ? 'SMS' : 'Email')

/** « 3 h après chaque prestation », « 1 jour après… », « juste après… ». */
export function libelleDelaiAvis(heures: number): string {
  const h = Math.max(0, Math.round(Number(heures) || 0))
  if (h === 0) return 'juste après chaque prestation'
  if (h % 24 === 0) return `${h / 24} jour${h / 24 > 1 ? 's' : ''} après chaque prestation`
  return `${h} h après chaque prestation`
}

/** « 3 mois sans nouveau rendez-vous », « 45 jours sans… ». */
export function libelleDelaiRelance(jours: number): string {
  const j = Math.max(1, Math.round(Number(jours) || DELAI_RELANCE_DEFAUT_JOURS))
  if (j % 30 === 0) return `${j / 30} mois sans nouveau rendez-vous`
  return `${j} jour${j > 1 ? 's' : ''} sans nouveau rendez-vous`
}

const nonVide = (s: string | null | undefined): boolean => !!s && s.trim().length > 0

/** Pourquoi une demande d'avis ACTIVÉE ne partirait pas : le cron la traite
 *  alors sans rien envoyer (`!washer.review_enabled || !washer.google_review_url`,
 *  et le SMS sans `avis_sms`). `null` : rien ne l'empêche. */
export function blocageAvis(r: ReglagesMessages, ctx: ContexteMessages): 'lien' | 'sms' | null {
  if (!nonVide(r.google_review_url)) return 'lien'
  if (r.review_channel === 'sms' && !ctx.smsAutorise) return 'sms'
  return null
}

/** La demande d'avis est-elle réellement en marche ? */
export const avisActif = (r: ReglagesMessages, ctx: ContexteMessages): boolean =>
  !!r.review_enabled && blocageAvis(r, ctx) === null

/** Le cron de relance exige un message (`.not('followup_message', 'is', null)`). */
export const relanceActive = (r: ReglagesMessages): boolean =>
  !!r.followup_enabled && nonVide(r.followup_message)

export function nombreActifs(r: ReglagesMessages, ctx: ContexteMessages): number {
  return (avisActif(r, ctx) ? 1 : 0) + (relanceActive(r) ? 1 : 0)
}

/** Le lien d'avis doit être une adresse web : il est envoyé tel quel aux clients. */
export function lienAvisValide(brut: string): boolean {
  try {
    const u = new URL(brut.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// ── Dates en français, à l'heure de Paris ───────────────────────────────────

const MS_JOUR = (jour: string): number => Date.parse(`${jour}T00:00:00Z`)

const formatJourCourt = (instant: number, avecAnnee: boolean): string => {
  const texte = new Date(instant).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', ...(avecAnnee ? { year: 'numeric' } : {}), timeZone: FUSEAU,
  })
  return texte.replace(/^1(?=\s)/, '1er')
}

/** « aujourd’hui », « hier », « demain », « jeudi » (dans la semaine) ou
 *  « 9 juin » — jamais de préposition : l'appelant ajoute « le » devant une date. */
export function jourRelatif(instant: number, maintenant: number): string {
  const ecart = Math.round((MS_JOUR(aujourdhuiParis(instant)) - MS_JOUR(aujourdhuiParis(maintenant))) / JOUR)
  if (ecart === 0) return 'aujourd’hui'
  if (ecart === 1) return 'demain'
  if (ecart === -1) return 'hier'
  if (Math.abs(ecart) <= 6) {
    return new Date(instant).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: FUSEAU })
  }
  const memeAnnee = aujourdhuiParis(instant).slice(0, 4) === aujourdhuiParis(maintenant).slice(0, 4)
  return formatJourCourt(instant, !memeAnnee)
}

const commenceParChiffre = (s: string): boolean => /^\d/.test(s)
const avecLe = (s: string): string => (commenceParChiffre(s) ? `le ${s}` : s)

const heureH = (instant: number): number =>
  parseInt(new Date(instant).toLocaleTimeString('fr-FR', { hour: '2-digit', hourCycle: 'h23', timeZone: FUSEAU }), 10)

/** Le cron d'avis passe toutes les heures (cron-job.org) : une demande
 *  programmée à 17 h 12 part au passage suivant, on annonce donc l'heure
 *  pleine suivante, avec « vers » — la minute exacte du passage n'est pas connue. */
export function momentAvis(instantMs: number, maintenant: number): string {
  const cible = Math.ceil(instantMs / HEURE) * HEURE
  if (cible <= maintenant) return 'dans l’heure'
  const jour = jourRelatif(cible, maintenant)
  const heure = formatHeureCompacte(new Date(cible))
  const soir = jour === 'aujourd’hui' && heureH(cible) >= 18
  return `${soir ? 'ce soir' : jour} vers ${heure}`
}

/** Une relance devient éligible à `dernier rendez-vous + délai` ; elle part au
 *  passage suivant du cron, dont l'heure n'est pas connue du code (elle se règle
 *  dans cron-job.org). On n'annonce donc qu'un jour de départ, jamais une heure. */
export function momentRelance(instantMs: number, maintenant: number): string {
  if (instantMs <= maintenant) return 'au prochain envoi'
  return `dès ${avecLe(jourRelatif(instantMs, maintenant))}`
}

/** Nom affiché : l'entreprise pour un Pro, comme dans la liste Clients. */
export function nomAffiche(b: Pick<RdvMessage, 'client_name' | 'is_professional' | 'company_name'>): string {
  return b.is_professional && nonVide(b.company_name) ? b.company_name!.trim() : b.client_name
}

// ── Relances : qui, et à partir de quand ────────────────────────────────────

export type RelancePrevue = {
  /** Rendez-vous qui porte la relance : le dernier du client. */
  rdv: RdvMessage
  /** Instant à partir duquel le cron l'envoie : dernier rendez-vous + délai. */
  instant: number
}

/** Reproduit la décision du cron de relance (`send-followups` + `lib/relances.ts`)
 *  client par client, sans rien envoyer.
 *
 *  Le cron regroupe par `client_email` À L'IDENTIQUE (pas de casse ignorée,
 *  contrairement à la liste Clients) : c'est la clé qu'il utilise pour décider
 *  qu'un client est déjà revenu, donc la seule qui prédise ses envois.
 *
 *  Un client est relancé quand son rendez-vous LE PLUS RÉCENT (annulés exclus,
 *  à venir compris) :
 *   · est confirmé ou terminé — un rendez-vous en attente fait `attendre` ;
 *   · n'est pas déjà traité (`followup_sent_at`) ;
 *   · a plus de `delaiJours` d'ancienneté.
 *  Trié : les plus proches d'abord. */
export function relancesPrevues(rdvs: RdvMessage[], delaiJours: number): RelancePrevue[] {
  const parClient = new Map<string, RdvMessage>()
  for (const b of rdvs) {
    if (b.status === 'cancelled' || !nonVide(b.client_email)) continue
    const courant = parClient.get(b.client_email!)
    if (!courant || t(b.scheduled_at) > t(courant.scheduled_at)) parClient.set(b.client_email!, b)
  }
  const prevues: RelancePrevue[] = []
  for (const dernier of parClient.values()) {
    if (dernier.status !== 'confirmed' && dernier.status !== 'done') continue
    if (dernier.followup_sent_at) continue
    const base = t(dernier.scheduled_at)
    if (!Number.isFinite(base)) continue
    prevues.push({ rdv: dernier, instant: base + delaiJours * JOUR })
  }
  return prevues.sort((a, b) => a.instant - b.instant)
}

/** Aperçu affiché dans le réglage de la relance, recalculé à chaque changement
 *  de délai : combien de clients seraient relancés au prochain passage, et qui
 *  vient ensuite. */
export function apercuRelance(rdvs: RdvMessage[], delaiJours: number, maintenant: number): {
  concernes: number
  suivant: { nom: string; moment: string } | null
} {
  const prevues = relancesPrevues(rdvs, delaiJours)
  const dus = prevues.filter(p => p.instant <= maintenant)
  const prochain = prevues.find(p => p.instant > maintenant)
  return {
    concernes: dus.length,
    suivant: prochain ? { nom: nomAffiche(prochain.rdv), moment: momentRelance(prochain.instant, maintenant) } : null,
  }
}

// ── « Programmé » ───────────────────────────────────────────────────────────

export type LigneMessage = {
  cle: string
  type: 'avis' | 'relance'
  nom: string
  /** Deuxième ligne : prestation ou dernier rendez-vous. */
  detail: string
  /** Colonne de droite : quand ça part, ou ce que ça a donné. */
  droite: string
  /** `ok` : bonne nouvelle (vert) ; `neutre` : information ; `discret` : pas de résultat. */
  ton: 'ok' | 'neutre' | 'discret'
  /** Vrai quand la ligne est DÉDUITE et non lue — voir l'en-tête du fichier. */
  deduit: boolean
  instant: number
}

function detailRelance(rdv: RdvMessage, maintenant: number): string {
  const quand = t(rdv.scheduled_at)
  const memeAnnee = aujourdhuiParis(quand).slice(0, 4) === aujourdhuiParis(maintenant).slice(0, 4)
  const date = formatJourCourt(quand, !memeAnnee)
  return quand > maintenant ? `RDV prévu le ${date}` : `Dernier RDV le ${date}`
}

/** Ce qui va partir : les demandes d'avis en attente, et les relances dont le
 *  délai est échu ou tombe dans la semaine. Rien tant que l'automatisme ne peut
 *  pas partir (le cron traiterait ces demandes sans envoyer). */
export function messagesProgrammes(
  r: ReglagesMessages, ctx: ContexteMessages, rdvs: RdvMessage[], maintenant: number,
): LigneMessage[] {
  const lignes: LigneMessage[] = []

  if (avisActif(r, ctx)) {
    for (const b of rdvs) {
      const prevu = t(b.review_request_at)
      if (!Number.isFinite(prevu) || b.review_request_sent_at) continue
      // Mêmes écarts que le cron : annulé, ou sans email (la demande d'avis
      // l'exige même en SMS) ; en SMS, sans numéro rien ne part.
      if (b.status === 'cancelled' || !nonVide(b.client_email)) continue
      if (r.review_channel === 'sms' && !nonVide(b.client_phone)) continue
      lignes.push({
        cle: `avis-${b.id}`,
        type: 'avis',
        nom: nomAffiche(b),
        detail: `${b.services?.name ?? 'Prestation'} · ${jourRelatif(t(b.scheduled_at), maintenant)}`,
        droite: momentAvis(prevu, maintenant),
        ton: 'neutre',
        deduit: false,
        instant: prevu,
      })
    }
  }

  if (relanceActive(r)) {
    const limite = maintenant + FENETRE_PROGRAMME_JOURS * JOUR
    for (const p of relancesPrevues(rdvs, r.followup_delay_days)) {
      if (p.instant > limite) break
      lignes.push({
        cle: `relance-${p.rdv.id}`,
        type: 'relance',
        nom: nomAffiche(p.rdv),
        detail: detailRelance(p.rdv, maintenant),
        droite: momentRelance(p.instant, maintenant),
        ton: 'neutre',
        deduit: false,
        instant: p.instant,
      })
    }
  }

  return lignes.sort((a, b) => a.instant - b.instant)
}

// ── « Parti » ───────────────────────────────────────────────────────────────

/** Le rendez-vous a-t-il porté une VRAIE relance ? `followup_sent_at` est aussi
 *  posé sur les rendez-vous clos sans envoi ; or le cron ne clôt un rendez-vous
 *  que si le client en avait déjà un plus récent, non annulé, PRIS AVANT cette
 *  marque. Un rendez-vous marqué qui n'a aucun successeur de ce genre a donc
 *  forcément envoyé son message. (Un successeur pris APRÈS la marque, c'est le
 *  client qui est revenu — le cas qu'on veut justement montrer.) */
export function relanceEstPartie(rdv: RdvMessage, tous: RdvMessage[]): boolean {
  const marque = t(rdv.followup_sent_at)
  if (!Number.isFinite(marque)) return false
  const debut = t(rdv.scheduled_at)
  return !tous.some(o =>
    o.id !== rdv.id
    && o.client_email === rdv.client_email
    && o.status !== 'cancelled'
    && t(o.scheduled_at) > debut
    && t(o.created_at) <= marque)
}

/** Le client a-t-il repris un rendez-vous (non annulé) après la relance ? */
export function aReserveDepuis(rdv: RdvMessage, tous: RdvMessage[]): boolean {
  const marque = t(rdv.followup_sent_at)
  return tous.some(o =>
    o.id !== rdv.id
    && o.client_email === rdv.client_email
    && o.status !== 'cancelled'
    && t(o.created_at) > marque)
}

/** Ce qui est parti dans les `FENETRE_PARTI_JOURS` derniers jours, le plus
 *  récent d'abord. Voir l'en-tête du fichier pour ce qui est lu et ce qui est
 *  déduit. */
export function messagesPartis(
  r: ReglagesMessages, ctx: ContexteMessages, rdvs: RdvMessage[], maintenant: number,
): LigneMessage[] {
  const depuis = maintenant - FENETRE_PARTI_JOURS * JOUR
  const dansLaFenetre = (instant: number) => Number.isFinite(instant) && instant >= depuis && instant <= maintenant
  const lignes: LigneMessage[] = []
  // L'email est déduit : on ne le fait que si la demande est en marche
  // aujourd'hui, sans quoi les marques de la semaine peuvent être des écarts.
  const emailDeductible = avisActif(r, ctx) && r.review_channel === 'email'

  for (const b of rdvs) {
    const sms = t(b.review_sms_sent_at)
    if (dansLaFenetre(sms)) {
      lignes.push({
        cle: `avis-${b.id}`, type: 'avis', nom: nomAffiche(b),
        detail: `Avis · ${jourRelatif(sms, maintenant)}`,
        droite: 'SMS envoyé', ton: 'discret', deduit: false, instant: sms,
      })
      continue
    }
    const traite = t(b.review_request_sent_at)
    if (emailDeductible && dansLaFenetre(traite) && Number.isFinite(t(b.review_request_at))
        && b.status !== 'cancelled' && nonVide(b.client_email)) {
      lignes.push({
        cle: `avis-${b.id}`, type: 'avis', nom: nomAffiche(b),
        detail: `Avis · ${jourRelatif(traite, maintenant)}`,
        droite: 'email envoyé', ton: 'discret', deduit: true, instant: traite,
      })
    }
  }

  for (const b of rdvs) {
    const marque = t(b.followup_sent_at)
    if (!dansLaFenetre(marque) || !relanceEstPartie(b, rdvs)) continue
    const revenu = aReserveDepuis(b, rdvs)
    lignes.push({
      cle: `relance-${b.id}`, type: 'relance', nom: nomAffiche(b),
      detail: `Relance · ${jourRelatif(marque, maintenant)}`,
      droite: revenu ? 'a réservé depuis' : 'pas encore revenu',
      ton: revenu ? 'ok' : 'discret',
      deduit: true, instant: marque,
    })
  }

  return lignes.sort((a, b) => b.instant - a.instant)
}

// ── Message d'avis, tel que le cron l'envoie (lecture seule) ────────────────

/** Texte du SMS de demande d'avis. CODÉ EN DUR dans `api/cron/send-reviews`
 *  (l'appel à `sendSms`), avec le nom COMPLET du client : à garder synchronisé
 *  à la main tant que le message n'est pas modifiable (voir refonte.md). */
export function texteSmsAvis(): string {
  return 'Bonjour {nom du client}, merci pour votre confiance ! Pouvez-vous laisser un avis sur notre travail ? {votre lien d’avis}'
}

/** Suggestion de message de relance, proposée quand le laveur n'en a pas écrit :
 *  le cron ne remplace que `{{nom}}` (prénom), pas de `{{lien}}` — le lien de
 *  réservation est donc écrit en toutes lettres. */
export function messageRelanceSuggere(lienReservation: string): string {
  return `Bonjour {{nom}}, ça fait un moment ! Envie de reprendre un lavage ? Réservez directement ici : ${lienReservation}`
}
