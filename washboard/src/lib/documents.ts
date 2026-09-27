import {
  arrondi, nomLegalAffiche, normaliserNumeroTva, normaliserSiret, totauxFacture,
  type FactureContenu, type LigneFacture, type RegimeTva, type StatutJuridique,
  type VendeurFacturable,
} from '@/lib/facture'

/** Devis et factures écrits à la main, sans rendez-vous derrière.
 *
 *  Jusqu'ici une facture ne pouvait naître que d'une réservation passée par la page du laveur
 *  (`emettreFacture`). Deux besoins réels restaient sans réponse : chiffrer un travail avant de
 *  le faire (tapis, canapé, remise en état — le client veut un prix avant de dire oui), et
 *  facturer un chantier arrivé par le bouche-à-oreille, qui n'a jamais eu de créneau.
 *
 *  Un devis n'est pas une facture : il n'engage personne, ne compte pas dans le chiffre
 *  d'affaires, et sa numérotation n'a aucune obligation légale de continuité. Une facture, si :
 *  elle prend le numéro suivant de LA suite du laveur, celle que servent déjà les factures de
 *  réservation — d'où deux compteurs distincts en base, et jamais de numéro attribué ici (la
 *  fonction SQL `emettre_document` est seule à le faire, sous verrou).
 *
 *  Format des numéros, vérifié en production le 2026-09-27 : `F-00014`, c'est-à-dire le
 *  préfixe et le compteur du laveur sur cinq chiffres, SANS l'année. Les devis suivent la même
 *  forme avec `D-`. Une suite qui changerait de forme en cours de route serait une suite
 *  cassée : rien, ici ni ailleurs, ne doit fabriquer un numéro autrement.
 *
 *  Tout ce fichier est pur : aucune base, aucun réseau. Le contenu produit est un
 *  `FactureContenu`, le même qu'une facture de réservation — c'est ce qui permet au PDF, à la
 *  liste des factures et aux chiffres de ne rien savoir de la différence. */

export type GenreDocument = 'devis' | 'facture'

/** Vie d'un document :
 *  - `emis`      : numéroté et figé — il n'en bouge plus jamais ;
 *  - `envoye`    : parti par email au client ;
 *  - `accepte` / `refuse` : réponse du client à un devis, notée par le laveur ;
 *  - `transforme` : devis devenu facture (la facture porte son propre numéro).
 *
 *  Pas de brouillon : un document sans numéro ne peut être ni envoyé, ni téléchargé, ni
 *  retrouvé — ce serait une case vide qui ressemble à du travail fait. On écrit, on émet. */
export type StatutDocument = 'emis' | 'envoye' | 'accepte' | 'refuse' | 'transforme'

/** Un devis sans date de fin de validité laisserait le laveur engagé sur son prix
 *  indéfiniment. Un mois est la durée d'usage. */
export const VALIDITE_DEVIS_JOURS = 30

/** Au-delà, ce n'est plus une ligne de facture mais une erreur de saisie (un prix tapé dans la
 *  case quantité). Vaut pour la quantité comme pour le prix unitaire. */
export const QUANTITE_MAX = 999
export const PRIX_MAX = 100_000

export type LigneSaisie = {
  designation: string
  quantite: number
  /** Prix unitaire TTC : le laveur saisit ce que le client paie, comme sur sa page. */
  prixUnitaireTtc: number
}

export type SaisieDocument = {
  genre: GenreDocument
  clientNom: string
  clientEmail: string
  /** Adresse de facturation du client. À défaut, le lieu de la prestation. */
  clientAdresse: string
  professionnel: boolean
  entreprise: string
  /** SIRET du client professionnel (le SIREN en est extrait pour la facture). */
  siret: string
  /** Jour de la prestation, `YYYY-MM-DD`. `null` quand elle n'est pas encore planifiée —
   *  le cas normal d'un devis. */
  date: string | null
  lieu: string
  lignes: LigneSaisie[]
  remiseTtc: number
  /** Devis seulement, `YYYY-MM-DD`. */
  valableJusquau: string | null
  note: string
}

export type Document = {
  id: string
  genre: GenreDocument
  statut: StatutDocument
  numero: string | null
  contenu: FactureContenu
  emis_le: string | null
  envoye_le: string | null
  valable_jusquau: string | null
  repondu_le: string | null
  facture_id: string | null
  devis_id: string | null
  created_at: string
}

// ── Libellés ───────────────────────────────────────────────────────────────

export const libelleGenre = (g: GenreDocument) => (g === 'devis' ? 'Devis' : 'Facture')

/** Ce que la liste affiche, du point de vue du laveur : « où en est ce document ». */
export function libelleStatut(d: Pick<Document, 'genre' | 'statut'>): string {
  switch (d.statut) {
    case 'emis': return d.genre === 'devis' ? 'À envoyer' : 'Émise'
    case 'envoye': return d.genre === 'devis' ? 'En attente de réponse' : 'Envoyée'
    case 'accepte': return 'Accepté'
    case 'refuse': return 'Refusé'
    case 'transforme': return 'Facturé'
  }
}

/** Le ton de la pastille. L'ambre ne signale que ce qui attend une action du laveur — un devis
 *  accepté qu'il n'a pas encore facturé, un brouillon oublié. Le vert, ce qui est abouti. */
export function tonStatut(d: Pick<Document, 'genre' | 'statut'>): 'gris' | 'ambre' | 'vert' {
  if (d.statut === 'accepte') return 'ambre'
  if (d.statut === 'refuse') return 'gris'
  if (d.statut === 'transforme') return 'vert'
  return d.genre === 'facture' ? 'vert' : 'gris'
}

// ── Dates ──────────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` du jour + n jours, sans passer par le fuseau du navigateur (un devis daté de
 *  la veille pour cause d'UTC serait déjà entamé). */
export function dateDansNJours(aujourdhui: string, jours: number): string {
  const [a, m, j] = aujourdhui.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j))
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

export function devisExpire(valableJusquau: string | null, aujourdhui: string): boolean {
  return !!valableJusquau && valableJusquau < aujourdhui
}

// ── Lignes et totaux ───────────────────────────────────────────────────────

export const ligneVide = (): LigneSaisie => ({ designation: '', quantite: 1, prixUnitaireTtc: 0 })

/** Une ligne compte dès qu'elle porte une désignation : une ligne à 0 € est légitime (« Lavage
 *  offert », « Déplacement offert »), une ligne sans désignation n'est qu'une case pas remplie. */
export const ligneRemplie = (l: LigneSaisie) => l.designation.trim().length > 0

export function lignesDocument(saisie: SaisieDocument): LigneFacture[] {
  return saisie.lignes.filter(ligneRemplie).map(l => ({
    designation: l.designation.trim(),
    quantite: l.quantite,
    prixUnitaireTtc: arrondi(l.prixUnitaireTtc),
    totalTtc: arrondi(l.quantite * l.prixUnitaireTtc),
  }))
}

export const totalLignes = (lignes: LigneFacture[]) =>
  arrondi(lignes.reduce((t, l) => t + l.totalTtc, 0))

/** Ce que le client paiera, remise déduite. Jamais négatif : une remise plus grande que le
 *  total est une erreur de saisie, pas un remboursement. */
export function totalDocument(saisie: SaisieDocument): number {
  const brut = totalLignes(lignesDocument(saisie))
  return arrondi(Math.max(0, brut - Math.max(0, saisie.remiseTtc)))
}

// ── Contrôles ──────────────────────────────────────────────────────────────

/** Ce qui empêche d'émettre, formulé pour le laveur — une phrase, la première qui bloque.
 *  `null` quand tout est bon. */
export function validerDocument(saisie: SaisieDocument, aujourdhui: string): string | null {
  if (!saisie.clientNom.trim()) return 'Indiquez le nom du client.'
  if (saisie.professionnel && !saisie.entreprise.trim()) {
    return 'Indiquez le nom de l’entreprise du client, ou décochez « professionnel ».'
  }
  const lignes = saisie.lignes.filter(ligneRemplie)
  if (lignes.length === 0) return 'Ajoutez au moins une ligne (désignation et prix).'
  for (const l of lignes) {
    if (!Number.isFinite(l.quantite) || l.quantite <= 0 || l.quantite > QUANTITE_MAX) {
      return `La quantité de « ${l.designation.trim()} » doit être comprise entre 1 et ${QUANTITE_MAX}.`
    }
    if (!Number.isFinite(l.prixUnitaireTtc) || l.prixUnitaireTtc < 0 || l.prixUnitaireTtc > PRIX_MAX) {
      return `Le prix de « ${l.designation.trim()} » doit être compris entre 0 et ${PRIX_MAX} €.`
    }
  }
  const brut = totalLignes(lignesDocument(saisie))
  if (saisie.remiseTtc < 0) return 'La remise ne peut pas être négative.'
  if (saisie.remiseTtc > brut) return 'La remise dépasse le total des lignes.'
  if (brut - saisie.remiseTtc <= 0) {
    return saisie.genre === 'devis'
      ? 'Un devis à 0 € ne chiffre rien : indiquez au moins un prix.'
      : 'Une facture à 0 € n’a pas lieu d’être.'
  }
  if (saisie.genre === 'devis') {
    if (!saisie.valableJusquau) return 'Indiquez jusqu’à quand votre prix reste valable.'
    if (saisie.valableJusquau < aujourdhui) return 'La date de validité est déjà passée.'
  }
  return null
}

/** L'envoi par email demande une adresse ; le reste du document peut très bien vivre sans
 *  (le laveur télécharge le PDF et l'envoie par WhatsApp). */
export function validerEnvoi(contenu: FactureContenu): string | null {
  const email = contenu.client.email?.trim()
  if (!email) return 'Ce document n’a pas d’adresse email de client. Modifiez-le pour en ajouter une.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'L’adresse email du client n’est pas valide.'
  return null
}

// ── Contenu figé ───────────────────────────────────────────────────────────

/** Le document tel qu'il sera lu pour toujours : mentions du laveur, client, lignes, totaux.
 *  Figé à l'émission, exactement comme une facture de réservation — si le laveur change
 *  d'adresse ou de taux demain, ses documents d'hier ne bougent pas. */
export function construireDocument(saisie: SaisieDocument, v: VendeurFacturable): FactureContenu {
  const lignes = lignesDocument(saisie)
  const brut = totalLignes(lignes)
  const remiseTtc = arrondi(Math.min(Math.max(0, saisie.remiseTtc), brut))
  const regime: RegimeTva = v.facture_regime_tva === 'assujetti' ? 'assujetti' : 'franchise'
  const taux = regime === 'assujetti' ? Number(v.facture_taux_tva ?? 20) : 0
  const statut: StatutJuridique = v.facture_statut === 'societe' ? 'societe' : 'ei'
  const societe = statut === 'societe'
  const pro = saisie.professionnel
  const sirenClient = pro && saisie.siret ? normaliserSiret(saisie.siret).slice(0, 9) : ''

  return {
    version: 1,
    genre: saisie.genre,
    vendeur: {
      nomLegal: nomLegalAffiche(v.facture_nom_legal ?? '', statut),
      nomCommercial: v.name,
      siret: normaliserSiret(v.facture_siret ?? ''),
      adresse: v.facture_adresse?.trim() ?? '',
      telephone: v.phone ?? null,
      regimeTva: regime,
      tauxTva: taux,
      numeroTva: regime === 'assujetti' && v.facture_numero_tva
        ? normaliserNumeroTva(v.facture_numero_tva)
        : null,
      statut,
      formeJuridique: societe ? v.facture_forme_juridique?.trim() || null : null,
      capital: societe ? v.facture_capital?.trim() || null : null,
      immatriculation: societe ? v.facture_immatriculation?.trim() || null : null,
      logoUrl: v.logo_url ?? null,
      couleur: v.brand_color ?? null,
    },
    client: {
      nom: saisie.clientNom.trim(),
      email: saisie.clientEmail.trim(),
      professionnel: pro,
      entreprise: pro ? saisie.entreprise.trim() || null : null,
      siren: /^\d{9}$/.test(sirenClient) ? sirenClient : null,
      adresseFacturation: saisie.clientAdresse.trim() || saisie.lieu.trim(),
    },
    prestation: {
      date: saisie.date,
      lieu: saisie.lieu.trim(),
      nature: 'Prestation de services',
    },
    lignes,
    remiseTtc,
    totaux: totauxFacture(brut - remiseTtc, regime, taux),
    valableJusquau: saisie.genre === 'devis' ? saisie.valableJusquau : null,
    note: saisie.note.trim() || null,
  }
}

/** La saisie qui reproduit un document existant : sert à modifier un brouillon, et surtout à
 *  transformer un devis accepté en facture sans rien retaper. Le client, les lignes et la
 *  remise sont repris tels quels ; la validité, propre au devis, tombe. */
export function saisieDepuisContenu(contenu: FactureContenu, genre: GenreDocument): SaisieDocument {
  return {
    genre,
    clientNom: contenu.client.nom,
    clientEmail: contenu.client.email ?? '',
    clientAdresse: contenu.client.adresseFacturation,
    professionnel: contenu.client.professionnel,
    entreprise: contenu.client.entreprise ?? '',
    siret: contenu.client.siren ?? '',
    date: contenu.prestation.date,
    lieu: contenu.prestation.lieu,
    lignes: contenu.lignes.map(l => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaireTtc: l.prixUnitaireTtc,
    })),
    remiseTtc: contenu.remiseTtc,
    valableJusquau: null,
    note: contenu.note ?? '',
  }
}

/** Saisie vide pour un nouveau document. */
export function saisieNeuve(genre: GenreDocument, aujourdhui: string): SaisieDocument {
  return {
    genre,
    clientNom: '', clientEmail: '', clientAdresse: '',
    professionnel: false, entreprise: '', siret: '',
    date: genre === 'facture' ? aujourdhui : null,
    lieu: '',
    lignes: [ligneVide()],
    remiseTtc: 0,
    valableJusquau: genre === 'devis' ? dateDansNJours(aujourdhui, VALIDITE_DEVIS_JOURS) : null,
    note: '',
  }
}
