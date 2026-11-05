import { planEffectif, PLAN_LABELS, type Plan } from '@/lib/plan'
import { estExpediteurApprouve } from '@/lib/expediteurs'
import { SOURCES_ACQUISITION, CLE_PRECISION_SOURCE } from '@/lib/onboarding'

// Fiche laveur de l'espace équipe : le « topo » qu'Alexandre demandait à
// chaque nouvel inscrit (2026-11-05), calculé ici une fois pour toutes.
//
// Fonctions pures : elles reçoivent les lignes déjà lues en base
// (`ficheLaveurDonnees.ts`) et l'heure courante, et ne lisent rien d'autre —
// de quoi les vérifier sans base de données.

const JOUR_MS = 864e5
const FENETRE_JOURS = 30

export type WasherFiche = {
  id: string
  user_id: string | null
  name: string
  slug: string
  phone: string | null
  created_at: string
  plan: string | null
  grandfathered: boolean | null
  subscription_status: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
  cancels_at: string | null
  zone_config: { enabled?: boolean } | null
  base_address: string | null
  logo_url: string | null
  google_review_url: string | null
  website_url: string | null
  sms_sender: string | null
  sms_sender_statut: string | null
  pwa_installee_le: string | null
  derniere_connexion_le: string | null
  onboarding_complete_at: string | null
  acquisition_source: string | null
  profil_activite: { anciennete?: string; ca_mois?: string; prestations_semaine?: string; temps_perdu?: string[]; [CLE_PRECISION_SOURCE]?: string } | null
  facture_nom_legal: string | null
  telephone_verifie_le: string | null
  is_preview: boolean | null
}

export type DonneesLaveur = {
  washer: WasherFiche
  email: string | null
  /** `auth.users.last_sign_in_at` : seule trace de connexion avant le 2026-10-21. */
  derniereConnexionAuth: string | null
  prestations: { name: string; price: number | null; en_veille: boolean | null }[]
  joursOuverts: number[]
  reservations: { status: string; created_at: string; scheduled_at: string | null; booked_price: number | null; saisie_par_laveur: boolean | null; review_sms_sent_at: string | null }[]
  evenements: { session_id: string; step: string; referrer_host: string | null; created_at: string }[]
  appareilsNotifies: number
}

export type Ton = 'ok' | 'attention' | 'alerte' | 'neutre'

export type Topo = {
  statut: { libelle: string; ton: Ton; detail: string | null }
  /** « Comment as-tu connu WashBoard ? », en clair (avec la précision d'« Autre »). */
  source: string | null
  /** 1 = à appeler en premier, 2 = à accompagner, 3 = rien d'urgent. */
  priorite: 1 | 2 | 3
  pagePrete: boolean
  /** `essentiel` : sans lui, personne ne peut réserver. */
  configuration: { libelle: string; fait: boolean; detail: string; essentiel?: boolean }[]
  activite: {
    derniereConnexion: string | null
    visites30: number
    /** Sessions arrivées à chaque étape en 30 j : page ouverte, créneaux, coordonnées, réservation. */
    parcours: [number, number, number, number]
    provenance: { source: string; visites: number }[]
    lienReseaux: string
    reservations: number
    reservationsEnLigne: number
    reservations30: number
    derniereReservation: string | null
    chiffre30: number
    smsAvis: number
  }
  profil: string[]
  problemes: string[]
  pourquoi: string
  aDire: string[]
}

const PROFIL: Record<string, Record<string, string>> = {
  anciennete: { moins_1_an: 'Moins d’un an d’activité', '1_3_ans': '1 à 3 ans d’activité', plus_3_ans: 'Plus de 3 ans d’activité' },
  ca_mois: { moins_1000: 'Moins de 1 000 €/mois', '1000_3000': '1 000 à 3 000 €/mois', '3000_5000': '3 000 à 5 000 €/mois', plus_5000: 'Plus de 5 000 €/mois' },
  prestations_semaine: { moins_5: 'Moins de 5 prestations/semaine', '5_15': '5 à 15 prestations/semaine', plus_15: 'Plus de 15 prestations/semaine' },
  temps_perdu: { prospection: 'trouver des clients', rendez_vous: 'gérer les rendez-vous', relances: 'relancer', facturation: 'la facturation', administratif: 'l’administratif' },
}
const libelle = (cle: string, v: string | undefined) => (v ? PROFIL[cle]?.[v] ?? v : null)

export const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

/** D'où vient une visite, à partir du site qui l'a envoyée. */
export function sourceVisite(hote: string | null): string {
  if (!hote) return 'Direct'
  if (/instagram/.test(hote)) return 'Instagram'
  if (/tiktok/.test(hote)) return 'TikTok'
  if (/facebook|fb\./.test(hote)) return 'Facebook'
  if (/google/.test(hote)) return 'Google'
  if (/washboard/.test(hote)) return 'Direct'
  return 'Site ' + hote.replace(/^www\./, '')
}
const estReseau = (source: string) => /^(Instagram|TikTok|Facebook)$/.test(source)

function sessions(evenements: DonneesLaveur['evenements'], etape?: string): number {
  return new Set(evenements.filter(e => !etape || e.step === etape).map(e => e.session_id)).size
}

function provenance(evenements: DonneesLaveur['evenements']) {
  const parSource = new Map<string, Set<string>>()
  for (const e of evenements) {
    const s = sourceVisite(e.referrer_host)
    if (!parSource.has(s)) parSource.set(s, new Set())
    parSource.get(s)!.add(e.session_id)
  }
  return [...parSource].map(([source, s]) => ({ source, visites: s.size })).sort((a, b) => b.visites - a.visites)
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export function analyserLaveur(d: DonneesLaveur, now: Date = new Date()): Topo {
  const w = d.washer
  const t = now.getTime()
  const depuis = (iso: string) => t - Date.parse(iso)

  // ── Offre
  const plan: Plan = planEffectif(w, now)
  const payant = w.subscription_status === 'active'
  const joursEssai = w.trial_ends_at ? Math.ceil((Date.parse(w.trial_ends_at) - t) / JOUR_MS) : null
  let statut: Topo['statut']
  if (w.grandfathered) statut = { libelle: 'Client historique', ton: 'ok', detail: 'Accès complet, sans abonnement' }
  else if (payant) statut = { libelle: `Payant · ${PLAN_LABELS[plan]}`, ton: 'ok', detail: w.cancels_at ? `Résiliation prévue le ${dateCourte(w.cancels_at)}` : null }
  else if (w.subscription_status === 'past_due') statut = { libelle: 'Paiement en échec', ton: 'alerte', detail: 'Stripe relance la carte' }
  else if (plan === 'decouverte' && joursEssai !== null && joursEssai < 0) statut = { libelle: 'Découverte (essai fini)', ton: 'neutre', detail: `Essai terminé le ${dateCourte(w.trial_ends_at!)}` }
  else if (plan === 'decouverte') statut = { libelle: 'Découverte', ton: 'neutre', detail: 'Offre gratuite' }
  else if (joursEssai !== null) statut = { libelle: `En essai ${PLAN_LABELS[plan]}`, ton: joursEssai <= 7 ? 'attention' : 'ok', detail: joursEssai <= 0 ? 'Se termine aujourd’hui' : `Encore ${pluriel(joursEssai, 'jour')} (jusqu’au ${dateCourte(w.trial_ends_at!)})` }
  else statut = { libelle: PLAN_LABELS[plan], ton: 'neutre', detail: null }

  // ── Configuration
  const actives = d.prestations.filter(p => !p.en_veille)
  const jours = [...new Set(d.joursOuverts)].sort()
  const zone = !!w.zone_config?.enabled
  const pagePrete = actives.length > 0 && jours.length > 0
  // Un nom de la liste validée chez Brevo est approuvé quel que soit l'état resté sur la fiche
  // (même règle que l'envoi, `expediteurPour`).
  const expediteurApprouve = !!w.sms_sender && (w.sms_sender_statut === 'approuve' || estExpediteurApprouve(w.sms_sender))
  const expediteur = !w.sms_sender ? 'Aucun nom demandé'
    : expediteurApprouve ? `« ${w.sms_sender} », approuvé`
    : w.sms_sender_statut === 'en_attente' ? `« ${w.sms_sender} », en attente d’approbation`
    : `« ${w.sms_sender} »`
  const configuration = [
    { libelle: 'Prestations', essentiel: true, fait: actives.length > 0, detail: actives.length ? actives.map(p => p.price != null ? `${p.name} (${p.price} €)` : p.name).join(', ') : 'Aucune : personne ne peut réserver' },
    { libelle: 'Horaires', essentiel: true, fait: jours.length > 0, detail: jours.length ? jours.map(j => JOURS_COURTS[j]).join(', ') : 'Aucun jour ouvert' },
    { libelle: 'Zone d’intervention', fait: zone, detail: zone ? (w.base_address ?? 'Définie') : 'Non définie' },
    { libelle: 'Logo', fait: !!w.logo_url, detail: w.logo_url ? 'Ajouté' : 'Pas de logo' },
    { libelle: 'Lien avis Google', fait: !!w.google_review_url, detail: w.google_review_url ? 'Renseigné' : 'Absent : pas de demande d’avis' },
    { libelle: 'Expéditeur SMS', fait: expediteurApprouve, detail: expediteur },
    { libelle: 'Appli installée', fait: !!w.pwa_installee_le, detail: w.pwa_installee_le ? `Le ${dateCourte(w.pwa_installee_le)}` : 'Pas installée sur son téléphone' },
    { libelle: 'Notifications', fait: d.appareilsNotifies > 0, detail: d.appareilsNotifies ? pluriel(d.appareilsNotifies, 'appareil') : 'Aucun appareil abonné' },
  ]

  // ── Activité
  const ev30 = d.evenements.filter(e => depuis(e.created_at) < FENETRE_JOURS * JOUR_MS)
  const parcours: [number, number, number, number] = [
    sessions(ev30, 'prestation'), sessions(ev30, 'creneau'), sessions(ev30, 'coordonnees'), sessions(ev30, 'confirmation'),
  ]
  const visites30 = sessions(ev30)
  const reseauxToujours = provenance(d.evenements).filter(p => estReseau(p.source))
  const lienReseaux = d.evenements.length === 0 ? 'Non : sa page n’a jamais été ouverte'
    : reseauxToujours.length ? `Oui : visites venues de ${reseauxToujours.map(p => `${p.source} (${p.visites})`).join(', ')}`
    : 'Pas de trace : aucune visite venue d’Instagram, TikTok ou Facebook'
  const resa = d.reservations.filter(r => r.status !== 'cancelled')
  const resa30 = resa.filter(r => depuis(r.created_at) < FENETRE_JOURS * JOUR_MS)
  const derniereConnexion = w.derniere_connexion_le ?? d.derniereConnexionAuth

  // ── Problèmes
  const problemes: string[] = []
  if (!actives.length) problemes.push('Aucune prestation : personne ne peut réserver')
  if (!jours.length) problemes.push('Aucun horaire : aucune date réservable')
  if (!zone) problemes.push('Zone d’intervention non définie')
  if (pagePrete && visites30 < 5) problemes.push('Sa page n’est presque pas vue')
  if (!w.google_review_url) problemes.push('Lien avis Google absent')
  if (!w.pwa_installee_le) problemes.push('Appli pas installée')
  const inactifDepuis = derniereConnexion ? Math.floor(depuis(derniereConnexion) / JOUR_MS) : null
  if (inactifDepuis !== null && inactifDepuis > 14) problemes.push(`Pas connecté depuis ${inactifDepuis} jours`)

  // ── Pourquoi pas (ou peu) de ventes
  const [vP, vC, vCo, vConf] = parcours
  let pourquoi: string
  let perte: 'rien' | 'creneau' | 'coordonnees' | null = null
  if (!pagePrete) pourquoi = 'Sa page n’est pas configurée : impossible de réserver.'
  else if (resa30.length >= 4) pourquoi = `Ça tourne : ${pluriel(resa30.length, 'réservation')} en 30 jours.`
  else if (vP < 5) pourquoi = `Presque personne ne voit sa page (${pluriel(vP, 'visite')} en 30 jours) : le lien n’est pas partagé, ou pas assez visible.`
  else {
    // « prestation » = ouverture de la page : perdre là, c'est repartir sans rien choisir.
    const pertes: [string, number][] = [['sans rien choisir', vP - vC], ['au choix du créneau', vC - vCo], ['aux coordonnées', vCo - vConf]]
    const [ou] = pertes.sort((a, b) => b[1] - a[1])[0]
    perte = ou === 'au choix du créneau' ? 'creneau' : ou === 'sans rien choisir' ? 'rien' : 'coordonnees'
    const piste = ou === 'au choix du créneau' ? 'Horaires trop étroits ou prestations trop longues ?'
      : ou === 'sans rien choisir' ? 'Prix, présentation des prestations, ou ses propres tests ?'
      : 'Formulaire trop long, ou manque de confiance ?'
    pourquoi = `${pluriel(vP, 'visite')} en 30 jours, ${vC} vont jusqu’aux créneaux, ${vCo} aux coordonnées, ${vConf} réservent. La plupart repartent ${ou}. ${piste}`
  }

  // ── À dire à l'appel
  const aDire: string[] = []
  if (statut.libelle === 'Découverte (essai fini)') aDire.push('Essai fini : savoir pourquoi il n’a pas continué, proposer de le relancer.')
  if (statut.libelle.startsWith('En essai') && joursEssai !== null && joursEssai <= 10) aDire.push(`Fin d’essai dans ${pluriel(Math.max(joursEssai, 0), 'jour')} : parler de l’offre qui lui correspond.`)
  if (!pagePrete) {
    const manque = [!actives.length && 'prestations', !jours.length && 'horaires', !zone && 'zone'].filter(Boolean).join(', ')
    aDire.push(`Proposer de remplir sa page ensemble pendant l’appel (${manque}) : 15 minutes.`)
  }
  if (pagePrete && vP < 5) aDire.push(`Mettre washboard.fr/book/${w.slug} dans sa bio Instagram/TikTok, et l’envoyer aux clients qui écrivent en message privé.`)
  // Décidé sur l'étape perdue, jamais sur le texte : « vont jusqu'aux créneaux » contient
  // aussi le mot, et donnait ce conseil à qui perdait ses visiteurs avant (Automaclean).
  if (perte === 'creneau') aDire.push('Revoir avec lui ses horaires et la durée de ses prestations.')
  if (perte === 'rien') aDire.push('Regarder sa page avec lui : prix, noms et descriptions des prestations. Vérifier que les visites ne sont pas surtout ses propres essais.')
  if (perte === 'coordonnees') aDire.push('Lui demander si des clients lui ont dit avoir abandonné au moment de laisser leurs coordonnées.')
  if (!w.google_review_url) aDire.push('Ajouter son lien d’avis Google : les demandes d’avis partent toutes seules.')
  if (!w.sms_sender) aDire.push('Lui faire choisir un nom d’expéditeur SMS (11 caractères, sans espace).')
  if (!w.pwa_installee_le) aDire.push('Lui faire installer l’appli sur son téléphone.')

  const priorite: Topo['priorite'] = payant || w.grandfathered || statut.libelle === 'Découverte (essai fini)' ? 3
    : (joursEssai !== null && joursEssai <= 10) || (pagePrete && vP >= 5 && resa30.length < 4) ? 1 : 2

  const p = w.profil_activite ?? {}
  const profil = [libelle('anciennete', p.anciennete), libelle('ca_mois', p.ca_mois), libelle('prestations_semaine', p.prestations_semaine)].filter((x): x is string => !!x)
  if (p.temps_perdu?.length) profil.push(`Perd du temps à ${p.temps_perdu.map(x => libelle('temps_perdu', x)).join(', ')}`)

  const brute = w.acquisition_source
  const precision = w.profil_activite?.[CLE_PRECISION_SOURCE]
  const source = !brute ? null
    : brute === 'autre' && precision ? `Autre : ${precision}`
    : SOURCES_ACQUISITION.find(s => s.valeur === brute)?.libelle ?? brute

  return {
    statut, source, priorite, pagePrete, configuration,
    activite: {
      derniereConnexion, visites30, parcours, provenance: provenance(ev30), lienReseaux,
      reservations: resa.length,
      reservationsEnLigne: resa.filter(r => !r.saisie_par_laveur).length,
      reservations30: resa30.length,
      derniereReservation: resa.map(r => r.created_at).sort().at(-1) ?? null,
      chiffre30: resa30.reduce((s, r) => s + (r.booked_price ?? 0), 0),
      smsAvis: resa.filter(r => r.review_sms_sent_at).length,
    },
    profil, problemes, pourquoi, aDire,
  }
}

export function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })
}

export function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** « il y a 3 h », « il y a 2 j » : ce qu'on lit d'un coup d'œil sur téléphone. */
export function ilYa(iso: string, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - Date.parse(iso)) / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}
