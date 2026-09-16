import { VEHICLE_LABELS } from '@/lib/vehicle-labels'

/** Factures des laveurs à leurs clients.
 *
 *  Jusqu'ici, le client professionnel recevait un « justificatif » sans les
 *  mentions obligatoires du laveur (ni SIRET, ni adresse, ni numérotation
 *  continue) et marqué « TVA non applicable » pour tout le monde. Et au
 *  1er septembre 2027, les micro-entrepreneurs devront émettre de vraies
 *  factures électroniques à leurs clients professionnels : ce module pose le
 *  contenu d'une facture valable, que la réforme viendra ensuite transporter.
 *
 *  Tout ici est pur (aucun accès réseau ni base) : la numérotation, elle, est
 *  attribuée en base par la fonction SQL `emettre_facture`, seule garante d'une
 *  suite sans trou ni doublon. */

export type RegimeTva = 'franchise' | 'assujetti'

/** Entrepreneur individuel (micro-entreprise comprise) ou société : les
 *  mentions obligatoires ne sont pas les mêmes. */
export type StatutJuridique = 'ei' | 'societe'

/** Taux proposés au laveur qui facture la TVA : 20 % (taux normal, le cas du
 *  lavage), 10 % et 5,5 % pour les cas particuliers. */
export const TAUX_TVA = [20, 10, 5.5] as const

export type InfosFacturation = {
  facture_statut?: StatutJuridique | null
  facture_nom_legal?: string | null
  facture_siret?: string | null
  facture_adresse?: string | null
  facture_forme_juridique?: string | null
  facture_capital?: string | null
  facture_immatriculation?: string | null
  facture_regime_tva?: RegimeTva | null
  facture_taux_tva?: number | null
  facture_numero_tva?: string | null
}

export const arrondi = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ── Identifiants ───────────────────────────────────────────────────────────

export function normaliserSiret(brut: string): string {
  return brut.replace(/[\s.-]/g, '')
}

/** 14 chiffres dont la clé de Luhn est juste. Seule exception connue : La
 *  Poste (SIREN 356 000 000), dont les établissements respectent une autre
 *  règle — la somme des chiffres est un multiple de 5. */
export function siretValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  if (!/^\d{14}$/.test(s)) return false
  if (s.startsWith('356000000')) {
    return [...s].reduce((t, c) => t + Number(c), 0) % 5 === 0
  }
  let somme = 0
  for (let i = 0; i < 14; i++) {
    let n = Number(s[13 - i])
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9 }
    somme += n
  }
  return somme % 10 === 0
}

export function normaliserNumeroTva(brut: string): string {
  return brut.replace(/\s/g, '').toUpperCase()
}

/** Numéro de TVA intracommunautaire français : FR, une clé de deux
 *  caractères, puis le SIREN. */
export function numeroTvaValide(brut: string): boolean {
  return /^FR[0-9A-Z]{2}\d{9}$/.test(normaliserNumeroTva(brut))
}

/** Un entrepreneur individuel doit faire figurer « EI » (ou « entrepreneur
 *  individuel ») à côté de son nom sur ses factures. On l'ajoute s'il ne l'a
 *  pas écrit lui-même, plutôt que de compter sur lui pour y penser. */
export function nomLegalAffiche(nom: string, statut: StatutJuridique): string {
  const n = nom.trim()
  if (statut !== 'ei' || !n || /\bEI\b|entrepreneur individuel/i.test(n)) return n
  return `${n} EI`
}

// ── Complétude ─────────────────────────────────────────────────────────────

/** Ce qui manque pour émettre une facture valable, formulé pour le laveur. */
export function infosFacturationManquantes(w: InfosFacturation): string[] {
  const societe = w.facture_statut === 'societe'
  const manques: string[] = []
  if (!w.facture_nom_legal?.trim()) manques.push(societe ? 'votre raison sociale' : 'votre nom légal')
  if (!w.facture_siret || !siretValide(w.facture_siret)) manques.push('votre SIRET')
  if (!w.facture_adresse?.trim()) manques.push('votre adresse professionnelle')
  if (societe) {
    if (!w.facture_forme_juridique?.trim()) manques.push('votre forme juridique')
    if (!w.facture_capital?.trim()) manques.push('votre capital social')
    if (!w.facture_immatriculation?.trim()) manques.push('votre immatriculation (RCS)')
  }
  if (w.facture_regime_tva === 'assujetti'
      && (!w.facture_numero_tva || !numeroTvaValide(w.facture_numero_tva))) {
    manques.push('votre numéro de TVA')
  }
  return manques
}

/** La facture part par email au client PROFESSIONNEL, qui en a besoin pour sa
 *  comptabilité ; le particulier la retrouve sur le lien de sa confirmation.
 *
 *  Une seule règle pour les DEUX chemins d'émission — au passage en « Terminé »
 *  et à la demande depuis le rendez-vous. Elle n'existait que sur le premier :
 *  un laveur qui complétait ses informations de facturation après coup émettait
 *  la facture à la main, et son client professionnel ne recevait jamais rien
 *  (constaté le 2026-09-16).
 *
 *  `nouvelle` distingue une facture qui vient d'être émise d'une facture déjà
 *  existante : on ne renvoie pas deux fois le même document. */
export function doitEnvoyerFactureAuClient(
  reservation: { is_professional?: boolean | null; client_email?: string | null },
  facture: { nouvelle: boolean },
): boolean {
  return facture.nouvelle && !!reservation.is_professional && !!reservation.client_email?.trim()
}

export function phraseManques(manques: string[]): string | null {
  if (manques.length === 0) return null
  const texte = manques.length === 1
    ? manques[0]
    : `${manques.slice(0, -1).join(', ')} et ${manques[manques.length - 1]}`
  return `Pour émettre vos factures, il manque ${texte}.`
}

// ── Contenu d'une facture ──────────────────────────────────────────────────

export type LigneFacture = {
  designation: string
  quantite: number
  prixUnitaireTtc: number
  totalTtc: number
}

/** Tout ce qu'affiche la facture, figé au moment de l'émission : si le laveur
 *  change d'adresse ou de prix plus tard, ses factures passées ne bougent pas.
 *  Les champs optionnels ont été ajoutés après les premières factures : une
 *  facture déjà émise ne les porte pas, et doit toujours s'afficher. */
export type FactureContenu = {
  version: 1
  vendeur: {
    nomLegal: string
    nomCommercial: string
    siret: string
    adresse: string
    telephone: string | null
    regimeTva: RegimeTva
    tauxTva: number
    numeroTva: string | null
    statut?: StatutJuridique
    formeJuridique?: string | null
    capital?: string | null
    immatriculation?: string | null
    logoUrl?: string | null
    couleur?: string | null
  }
  client: {
    nom: string
    email: string
    professionnel: boolean
    entreprise: string | null
    siren: string | null
    adresseFacturation: string
  }
  prestation: { date: string; lieu: string; nature: 'Prestation de services' }
  lignes: LigneFacture[]
  remiseTtc: number
  totaux: { ht: number; tva: number; ttc: number }
}

export type ReservationFacturable = {
  client_name: string
  client_email: string
  address: string
  scheduled_at: string
  is_professional: boolean | null
  company_name: string | null
  siret: string | null
  billing_address: string | null
  booked_price: number | null
  is_smart_slot: boolean | null
  smart_discount: number | null
  vehicle_count: number | null
  travel_fee: number | null
  vehicles_detail: { type: string; count: number; unit_price: number; label?: string }[] | null
  selected_addons: { label?: string; price?: number }[] | null
  services: { name: string } | null
}

export type VendeurFacturable = InfosFacturation & {
  name: string
  phone: string | null
  logo_url?: string | null
  brand_color?: string | null
}

const ligne = (designation: string, quantite: number, prixUnitaireTtc: number): LigneFacture => ({
  designation,
  quantite,
  prixUnitaireTtc: arrondi(prixUnitaireTtc),
  totalTtc: arrondi(quantite * prixUnitaireTtc),
})

const somme = (lignes: LigneFacture[]) => arrondi(lignes.reduce((t, l) => t + l.totalTtc, 0))

/** Lignes de la facture, avant remise.
 *
 *  Le total enregistré (`booked_price`) est recalculé côté serveur à la
 *  réservation, mais le détail par véhicule et par option a été transmis par
 *  le navigateur. Une facture dont les lignes ne retombent pas sur le total
 *  serait fausse : en cas d'écart, on facture le total, sur une seule ligne. */
export function lignesFacture(r: ReservationFacturable): LigneFacture[] {
  const total = arrondi(Number(r.booked_price ?? 0))
  const nomService = r.services?.name ?? 'Prestation'
  const uneLigne = [ligne(nomService, 1, total)]

  const options = (r.selected_addons ?? [])
    .filter(a => Number(a.price) > 0)
    .map(a => ligne(`Option : ${a.label ?? 'supplément'}`, 1, Number(a.price)))
  const deplacement = Number(r.travel_fee ?? 0) > 0
    ? [ligne('Frais de déplacement', 1, Number(r.travel_fee))]
    : []

  let vehicules: LigneFacture[]
  if (r.vehicles_detail?.length) {
    vehicules = r.vehicles_detail
      .filter(v => v.count > 0)
      .map(v => ligne(
        `${nomService} — ${v.label ?? VEHICLE_LABELS[v.type] ?? v.type}`,
        v.count,
        Number(v.unit_price),
      ))
  } else {
    const reste = total - somme(options) - somme(deplacement)
    if (reste <= 0) return uneLigne
    const quantite = Math.max(1, r.vehicle_count ?? 1)
    vehicules = [ligne(nomService, quantite, reste / quantite)]
  }

  const lignes = [...vehicules, ...options, ...deplacement]
  return Math.abs(somme(lignes) - total) > 0.009 ? uneLigne : lignes
}

/** Totaux à partir du montant payé, qui est un prix TTC : le client paie ce
 *  qu'il a vu en réservant. En franchise, HT et TTC se confondent. */
export function totauxFacture(totalTtc: number, regime: RegimeTva, taux: number) {
  const ttc = arrondi(totalTtc)
  if (regime === 'franchise') return { ht: ttc, tva: 0, ttc }
  const ht = arrondi(ttc / (1 + taux / 100))
  return { ht, tva: arrondi(ttc - ht), ttc }
}

export function prixHt(ttc: number, regime: RegimeTva, taux: number): number {
  return regime === 'franchise' ? arrondi(ttc) : arrondi(ttc / (1 + taux / 100))
}

export function construireFacture(r: ReservationFacturable, v: VendeurFacturable): FactureContenu {
  const lignes = lignesFacture(r)
  const brut = somme(lignes)
  const remiseTtc = r.is_smart_slot && Number(r.smart_discount) > 0
    ? arrondi(Math.min(Number(r.smart_discount), brut))
    : 0
  const regime: RegimeTva = v.facture_regime_tva === 'assujetti' ? 'assujetti' : 'franchise'
  const taux = regime === 'assujetti' ? Number(v.facture_taux_tva ?? 20) : 0
  const statut: StatutJuridique = v.facture_statut === 'societe' ? 'societe' : 'ei'
  const societe = statut === 'societe'
  const pro = !!r.is_professional
  const sirenClient = pro && r.siret ? normaliserSiret(r.siret).slice(0, 9) : ''

  return {
    version: 1,
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
      nom: r.client_name,
      email: r.client_email,
      professionnel: pro,
      entreprise: pro ? r.company_name?.trim() || null : null,
      siren: /^\d{9}$/.test(sirenClient) ? sirenClient : null,
      adresseFacturation: (pro && r.billing_address?.trim()) || r.address,
    },
    prestation: { date: r.scheduled_at, lieu: r.address, nature: 'Prestation de services' },
    lignes,
    remiseTtc,
    totaux: totauxFacture(brut - remiseTtc, regime, taux),
  }
}
