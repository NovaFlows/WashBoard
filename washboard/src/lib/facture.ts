import { sansTraduction, type Traducteur } from '@/lib/i18n/traduire'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'
import { adresseAvecLieu } from '@/lib/centreAuto'
import { estPrestationSupplementaire } from '@/lib/plusieursPrestations'

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

/** Taux proposés au laveur qui facture la TVA. France : 20 % (taux normal, le cas du lavage), 10 %
 *  et 5,5 %. Belgique (ouverture du 2026-11-11) : 21 % (taux normal), 12 % et 6 %. */
export const TAUX_TVA_FR = [20, 10, 5.5] as const
export const TAUX_TVA_BE = [21, 12, 6] as const
/** Suisse (ouverture du 2026-11-13) : 8,1 % (taux normal depuis le 1er janvier 2024, le cas du
 *  lavage), 2,6 % (taux réduit) et 3,8 % (taux spécial, hébergement). */
export const TAUX_TVA_CH = [8.1, 2.6, 3.8] as const
/** Luxembourg (2026-11-14) : 17 % (taux normal, le cas du lavage), 14 %, 8 % et 3 %. */
export const TAUX_TVA_LU = [17, 14, 8, 3] as const
/** Québec (2026-11-14) : TPS fédérale (5 %) et TVQ provinciale (9,975 %) se cumulent, soit 14,975 %
 *  sur le prix. Proposés : le taux cumulé, puis chacune seule. Une facture québécoise nomme les deux
 *  taxes et leurs deux numéros ; ce module ne porte pour l'instant qu'un taux et un numéro (limite
 *  connue, voir PROJECT_CONTEXT.md). */
export const TAUX_TVA_QC = [14.975, 5, 9.975] as const
/** Tous les taux acceptés par le serveur ; l'écran n'en propose que ceux du pays du laveur. */
/** Allemagne (2026-11-15) : 19 % (taux normal, le cas du lavage) et 7 % (taux réduit). */
export const TAUX_TVA_DE = [19, 7] as const
/** Espagne (2026-11-15) : IVA 21 % (taux général, le cas du lavage), 10 % (réduit) et 4 % (superréduit). */
export const TAUX_TVA_ES = [21, 10, 4] as const
export const TAUX_TVA = [20, 10, 5.5, 21, 12, 6, 8.1, 2.6, 3.8, 17, 14, 8, 3, 14.975, 5, 9.975, 19, 7, 4] as const

export type PaysFacturation = 'FR' | 'BE' | 'CH' | 'LU' | 'QC' | 'DE' | 'ES'

/** Le pays de facturation d'un laveur, déduit de ce qu'il a saisi : un numéro de TVA en « BE » ou
 *  « CHE », un numéro d'entreprise à 10 chiffres (BCE) ou un numéro IDE suisse (CHE-123.456.789),
 *  ou un téléphone en +32 / +41 disent la Belgique ou la Suisse. Aucune colonne de plus en base :
 *  la donnée existe déjà. */
export function paysFacturation(w: { facture_numero_tva?: string | null; facture_siret?: string | null; phone?: string | null }): PaysFacturation {
  const tva = (w.facture_numero_tva ?? '').replace(/\s/g, '')
  if (/^BE/i.test(tva)) return 'BE'
  if (/^CHE/i.test(tva)) return 'CH'
  if (/^LU\d/i.test(tva)) return 'LU'
  if (/(RT\d{4}|TQ\d{4})$/i.test(tva)) return 'QC'
  if (/^DE\d{9}$/i.test(tva)) return 'DE'
  if (/^ES[0-9A-Z]\d{7}[0-9A-Z]$/i.test(tva)) return 'ES'
  const identifiant = normaliserSiret(w.facture_siret ?? '')
  if (/^0\d{9}$/.test(identifiant)) return 'BE'
  if (/^CHE\d{9}$/.test(identifiant)) return 'CH'
  if (/^B\d{1,6}$/.test(identifiant)) return 'LU'
  if (/^(11|22|33|88)\d{8}$/.test(identifiant) && !bceValide(identifiant)) return 'QC'
  if (/^DE\d{9}$/.test(identifiant) || /^\d{2,3}\/\d{3}\/\d{4,5}$/.test(identifiant)) return 'DE'
  if (nifEspagnolValide(identifiant)) return 'ES'
  const tel = (w.phone ?? '').replace(/[\s.()-]/g, '')
  if (/^(\+32|0032)/.test(tel)) return 'BE'
  if (/^(\+41|0041)/.test(tel)) return 'CH'
  if (/^(\+352|00352)/.test(tel)) return 'LU'
  if (/^(\+1|001)(263|354|367|418|438|450|468|514|579|581|819|873)/.test(tel)) return 'QC'
  if (/^(\+49|0049)/.test(tel)) return 'DE'
  if (/^(\+34|0034)/.test(tel)) return 'ES'
  return 'FR'
}

/** Le pays du laveur d'après son téléphone CONFIRMÉ par SMS, quand il n'est pas français : c'est la
 *  seule donnée sûre dès l'inscription (le pays choisi dans la liste déroulante), avant même qu'il
 *  ait rempli son profil. Un numéro français ne tranche pas (un 06 appartient aussi à qui facture en
 *  Belgique) : `null`, et c'est `paysFacturation` qui lit alors l'identifiant saisi. */
export function paysDuTelephoneLaveur(phone: string | null | undefined): PaysFacturation | null {
  const tel = (phone ?? '').replace(/[\s.()-]/g, '')
  if (/^(\+32|0032)/.test(tel)) return 'BE'
  if (/^(\+41|0041)/.test(tel)) return 'CH'
  if (/^(\+352|00352)/.test(tel)) return 'LU'
  if (/^(\+1|001)(263|354|367|418|438|450|468|514|579|581|819|873)/.test(tel)) return 'QC'
  if (/^(\+49|0049)/.test(tel)) return 'DE'
  if (/^(\+34|0034)/.test(tel)) return 'ES'
  return null
}

// ── Ce qui change d'un pays à l'autre dans le profil ───────────────────────────────────────────

export type ReglesPays = {
  pays: PaysFacturation
  /** Titre du champ d'identifiant d'entreprise. */
  identifiantTitre: string
  identifiantExemple: string
  /** Phrase affichée quand l'identifiant saisi n'a pas le bon format. */
  identifiantErreur: string
  statutEi: { libelle: string; aide: string }
  statutSociete: { libelle: string; aide: string }
  formes: readonly string[]
  immatriculationExemple: string
  immatriculationAide: string
  numeroTvaExemple: string
  numeroTvaErreur: string
  adresseExemple: string
}

const REGLES: Record<PaysFacturation, ReglesPays> = {
  FR: {
    pays: 'FR',
    identifiantTitre: 'SIRET',
    identifiantExemple: '123 456 789 00012',
    identifiantErreur: 'SIRET invalide : 14 chiffres (avis de situation Insee).',
    statutEi: { libelle: 'Micro-entreprise ou entrepreneur individuel', aide: 'La mention « EI » est ajoutée à votre nom sur vos factures.' },
    statutSociete: { libelle: 'Société (SASU, SAS, EURL, SARL…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre RCS.' },
    formes: ['SASU', 'SAS', 'EURL', 'SARL', 'SA', 'SNC'],
    immatriculationExemple: 'RCS Pontoise 123 456 789',
    immatriculationAide: '« RCS », la ville de votre greffe, puis votre SIREN (les 9 premiers chiffres du SIRET).',
    numeroTvaExemple: 'FR40123456789',
    numeroTvaErreur: 'Numéro de TVA invalide : FR suivi de 11 caractères, par exemple FR40123456789.',
    adresseExemple: '8 rue des Lilas, 95560 Maffliers',
  },
  BE: {
    pays: 'BE',
    identifiantTitre: 'Numéro d’entreprise (BCE)',
    identifiantExemple: '0123.456.749',
    identifiantErreur: 'Numéro d’entreprise (BCE) invalide : 10 chiffres, commençant par 0 ou 1.',
    statutEi: { libelle: 'Indépendant (personne physique)', aide: 'Vous exercez en nom propre, avec un numéro d’entreprise BCE.' },
    statutSociete: { libelle: 'Société (SRL, SA…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre RPM.' },
    formes: ['SRL', 'SA', 'SC', 'SNC', 'SComm'],
    immatriculationExemple: 'RPM Bruxelles 0123.456.749',
    immatriculationAide: '« RPM » (registre des personnes morales), la ville du tribunal, puis votre numéro d’entreprise.',
    numeroTvaExemple: 'BE0123456749',
    numeroTvaErreur: 'Numéro de TVA invalide : BE suivi des 10 chiffres du numéro d’entreprise, par exemple BE0123456749.',
    adresseExemple: 'Rue de la Loi 16, 1000 Bruxelles',
  },
  CH: {
    pays: 'CH',
    identifiantTitre: 'Numéro IDE',
    identifiantExemple: 'CHE-109.322.551',
    identifiantErreur: 'Numéro IDE invalide : CHE suivi de 9 chiffres, par exemple CHE-109.322.551.',
    statutEi: { libelle: 'Entreprise individuelle', aide: 'Vous exercez en nom propre.' },
    statutSociete: { libelle: 'Société (Sàrl, SA…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre inscription au RC.' },
    formes: ['Sàrl', 'SA', 'Snc', 'Sc'],
    immatriculationExemple: 'RC Genève CHE-109.322.551',
    immatriculationAide: '« RC » (registre du commerce), le canton, puis votre numéro IDE.',
    numeroTvaExemple: 'CHE-109.322.551 TVA',
    numeroTvaErreur: 'Numéro de TVA invalide : CHE-123.456.789 TVA.',
    adresseExemple: 'Rue du Rhône 14, 1204 Genève',
  },
  LU: {
    pays: 'LU',
    identifiantTitre: 'Numéro RCS ou matricule',
    identifiantExemple: 'B123456',
    identifiantErreur: 'Numéro invalide : RCS (B suivi de 1 à 6 chiffres, par exemple B123456) ou matricule (11 ou 13 chiffres).',
    statutEi: { libelle: 'Entreprise individuelle', aide: 'Vous exercez en nom propre, avec une autorisation d’établissement.' },
    statutSociete: { libelle: 'Société (Sàrl, SA…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre RCS.' },
    formes: ['SARL', 'SARL-S', 'SA', 'SCS', 'SNC'],
    immatriculationExemple: 'RCS Luxembourg B123456',
    immatriculationAide: '« RCS » (Registre de commerce et des sociétés), Luxembourg, puis votre numéro B…',
    numeroTvaExemple: 'LU12345613',
    numeroTvaErreur: 'Numéro de TVA invalide : LU suivi de 8 chiffres, par exemple LU12345613.',
    adresseExemple: '5 avenue de la Gare, L-1611 Luxembourg',
  },
  QC: {
    pays: 'QC',
    identifiantTitre: 'NEQ (Numéro d’entreprise du Québec)',
    identifiantExemple: '1123456789',
    identifiantErreur: 'NEQ invalide : 10 chiffres commençant par 11, 22, 33 ou 88.',
    statutEi: { libelle: 'Travailleur autonome (entreprise individuelle)', aide: 'Vous exercez en nom propre, avec ou sans NEQ.' },
    statutSociete: { libelle: 'Société (inc., S.E.N.C.…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre immatriculation au REQ.' },
    formes: ['Inc.', 'S.E.N.C.', 'S.E.C.'],
    immatriculationExemple: 'REQ — NEQ 1123456789',
    immatriculationAide: '« REQ » (Registraire des entreprises du Québec), puis votre NEQ.',
    numeroTvaExemple: '123456789RT0001',
    numeroTvaErreur: 'Numéro invalide : TPS (9 chiffres, RT, 4 chiffres : 123456789RT0001) ou TVQ (10 chiffres, TQ, 4 chiffres : 1234567890TQ0001).',
    adresseExemple: '1000 rue Sherbrooke Ouest, Montréal QC H3A 3G4',
  },
  DE: {
    pays: 'DE',
    identifiantTitre: 'Steuernummer ou USt-IdNr.',
    identifiantExemple: '12/345/67890',
    identifiantErreur: 'Numéro fiscal invalide : Steuernummer (10 à 13 chiffres, par exemple 12/345/67890) ou USt-IdNr. (DE suivi de 9 chiffres).',
    statutEi: { libelle: 'Entreprise individuelle', aide: 'Vous exercez en nom propre.' },
    statutSociete: { libelle: 'Société (GmbH, UG, GbR…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre inscription au registre du commerce (HRB).' },
    formes: ['GmbH', 'UG (haftungsbeschränkt)', 'GbR', 'OHG', 'KG', 'GmbH & Co. KG', 'e.K.'],
    immatriculationExemple: 'Amtsgericht München HRB 123456',
    immatriculationAide: '« HRB » (registre du commerce), le tribunal d’instance (Amtsgericht), puis votre numéro.',
    numeroTvaExemple: 'DE123456789',
    numeroTvaErreur: 'Numéro de TVA invalide : DE suivi de 9 chiffres, par exemple DE123456789.',
    adresseExemple: 'Hauptstraße 12, 10115 Berlin',
  },
  ES: {
    pays: 'ES',
    identifiantTitre: 'NIF / CIF',
    identifiantExemple: '12345678Z',
    identifiantErreur: 'NIF invalide : DNI (8 chiffres et une lettre), NIE (X, Y ou Z, 7 chiffres et une lettre) ou CIF (une lettre, 7 chiffres et une clé).',
    statutEi: { libelle: 'Autónomo (entreprise individuelle)', aide: 'Vous exercez en nom propre, avec votre NIF.' },
    statutSociete: { libelle: 'Société (SL, SA, SLU…)', aide: 'Vos factures portent votre forme juridique, votre capital et votre inscription au registre du commerce.' },
    formes: ['SL', 'SLU', 'SA', 'SLL', 'S. Coop.'],
    immatriculationExemple: 'Registro Mercantil de Madrid, tomo 1234, folio 56, hoja M-123456',
    immatriculationAide: '« Registro Mercantil », la province, puis le tome, le folio et la feuille.',
    numeroTvaExemple: 'ES12345678Z',
    numeroTvaErreur: 'Numéro de TVA invalide : ES suivi du NIF (9 caractères), par exemple ES12345678Z.',
    adresseExemple: 'Calle Mayor 12, 28013 Madrid',
  },
}

export const reglesPays = (pays: PaysFacturation): ReglesPays => REGLES[pays]

/** Un identifiant d'entreprise au format du pays : SIRET (FR), BCE (BE) ou IDE (CH). Vide = pas de
 *  contrôle (le champ est facultatif). Pour un pays donné, un identifiant d'un autre pays est refusé :
 *  un laveur dont le numéro de téléphone est suisse n'a pas de SIRET français. */
export function identifiantValidePour(pays: PaysFacturation, brut: string): boolean {
  const s = normaliserSiret(brut)
  if (!s) return true
  if (pays === 'BE') return bceValide(s)
  if (pays === 'CH') return ideSuisseValide(s)
  if (pays === 'LU') return identifiantLuxembourgValide(s)
  if (pays === 'QC') return neqValide(s)
  if (pays === 'DE') return steuernummerValide(s) || ustIdNrValide(s)
  if (pays === 'ES') return nifEspagnolValide(s)
  return /^\d{14}$/.test(s) && siretValide(s)
}

export const tauxTvaPour = (pays: PaysFacturation): readonly number[] =>
  pays === 'BE' ? TAUX_TVA_BE : pays === 'CH' ? TAUX_TVA_CH : pays === 'LU' ? TAUX_TVA_LU : pays === 'QC' ? TAUX_TVA_QC
    : pays === 'DE' ? TAUX_TVA_DE : pays === 'ES' ? TAUX_TVA_ES : TAUX_TVA_FR
export const libelleIdentifiant = (pays: PaysFacturation): string =>
  pays === 'BE' ? 'numéro d’entreprise (BCE)' : pays === 'CH' ? 'numéro IDE (CHE)'
    : pays === 'LU' ? 'numéro RCS ou matricule' : pays === 'QC' ? 'NEQ'
      : pays === 'DE' ? 'Steuernummer ou USt-IdNr.' : pays === 'ES' ? 'NIF / CIF' : 'SIRET'
/** Le taux de TVA normal du pays : celui qu'on propose et qu'on applique par défaut. */
export const tauxTvaNormal = (pays: PaysFacturation): number => tauxTvaPour(pays)[0]

/** Court libellé de l'identifiant d'une entreprise, lu dans le numéro lui-même (sur les factures
 *  et leurs pieds de page) : « N° IDE » pour un numéro suisse, « N° BCE » pour un numéro belge à
 *  10 chiffres, « SIRET » sinon. */
export function libelleCourtIdentifiant(identifiant: string | null | undefined): string {
  const s = normaliserSiret(String(identifiant ?? ''))
  if (/^CHE\d{9}$/.test(s)) return 'N° IDE'
  if (/^[01]\d{9}$/.test(s) && bceValide(s)) return 'N° BCE'
  if (/^B\d{1,6}$/.test(s)) return 'N° RCS'
  if (/^(11|22|33|88)\d{8}$/.test(s)) return 'NEQ'
  if (/^DE\d{9}$/.test(s)) return 'USt-IdNr.'
  if (/^\d{2,3}\/\d{3}\/\d{4,5}$/.test(s)) return 'Steuernummer'
  if (nifEspagnolValide(s)) return 'NIF'
  if (/^(\d{11}|\d{13})$/.test(s)) return 'Matricule'
  if (/^[01]\d{9}$/.test(s)) return 'N° BCE'
  return 'SIRET'
}

/** L'identifiant tel qu'on l'imprime : un numéro IDE suisse se lit « CHE-123.456.789 », le reste est
 *  inchangé. */
export function identifiantAffiche(identifiant: string | null | undefined): string {
  const s = normaliserSiret(String(identifiant ?? ''))
  const m = /^CHE(\d{3})(\d{3})(\d{3})$/.exec(s)
  return m ? `CHE-${m[1]}.${m[2]}.${m[3]}` : String(identifiant ?? '')
}

/** Mention obligatoire d'une facture sans TVA. France : micro-entreprise (art. 293 B du CGI).
 *  Belgique : régime de franchise des petites entreprises (art. 56bis du Code de la TVA).
 *  Suisse : entreprise non assujettie sous 100 000 francs de chiffre d'affaires (art. 10 al. 2
 *  let. a LTVA). */
export function mentionFranchiseTva(pays: PaysFacturation, t: Traducteur = sansTraduction): string {
  if (pays === 'BE') return t('TVA non applicable — franchise des petites entreprises (art. 56bis du Code de la TVA).')
  if (pays === 'CH') return t('TVA non applicable — entreprise non assujettie, chiffre d’affaires inférieur à 100 000 CHF (art. 10 al. 2 LTVA).')
  if (pays === 'DE') return t('TVA non applicable — régime de la petite entreprise (§ 19 UStG, Kleinunternehmerregelung).')
  if (pays === 'ES') return t('TVA non applicable — opération exonérée (art. 20 de la loi 37/1992 sur la TVA).')
  if (pays === 'LU') return t('TVA non applicable — régime de franchise des petites entreprises (art. 57 de la loi modifiée du 12 février 1979 concernant la TVA).')
  if (pays === 'QC') return t('TPS et TVQ non perçues — petit fournisseur (revenus inférieurs à 30 000 $ sur quatre trimestres consécutifs).')
  return t('TVA non applicable, art. 293 B du CGI.')
}

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

/** Ce que dit une facture à un client professionnel en cas de retard de paiement. France : trois fois le
 *  taux d'intérêt légal et 40 € (art. L441-10 du Code de commerce) ; Allemagne : 9 points au-dessus du taux
 *  de base et 40 € (§ 288 BGB) ; Espagne : intérêts de la loi 3/2004 et 40 €. Belgique, Suisse, Luxembourg et
 *  Québec gardent la mention française d'origine. */
export function mentionRetardPaiement(pays: PaysFacturation, t: Traducteur = sansTraduction): string {
  if (pays === 'DE') return t('En cas de retard de paiement : intérêts de retard de 9 points au-dessus du taux de base et forfait de 40 € pour frais de recouvrement (§ 288 BGB).')
  if (pays === 'ES') return t('En cas de retard de paiement : intérêts de retard et indemnité de 40 € pour frais de recouvrement (loi 3/2004 de lutte contre le retard de paiement).')
  return t('En cas de retard de paiement : pénalités au taux de trois fois le taux d’intérêt légal, et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).')
}

export const arrondi = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ── Identifiants ───────────────────────────────────────────────────────────

export function normaliserSiret(brut: string): string {
  // Majuscules : un numéro IDE suisse s'écrit « CHE-123.456.789 » (ou « che123456789 »).
  return brut.replace(/[\s.-]/g, '').toUpperCase()
}

/** Numéro IDE suisse (identification des entreprises) : « CHE » puis 9 chiffres, le dernier est une
 *  clé de contrôle (modulo 11, pondérations 5-4-3-2-7-6-5-4 sur les 8 premiers chiffres). Un reste
 *  qui donnerait une clé de 10 n'est jamais attribué : numéro invalide. */
export function ideSuisseValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  if (!/^CHE\d{9}$/.test(s)) return false
  const chiffres = s.slice(3)
  const poids = [5, 4, 3, 2, 7, 6, 5, 4]
  const somme = poids.reduce((t, p, i) => t + p * Number(chiffres[i]), 0)
  const cle = 11 - (somme % 11)
  if (cle === 10) return false
  return (cle === 11 ? 0 : cle) === Number(chiffres[8])
}

/** Numéro d'entreprise belge (BCE) : 10 chiffres commençant par 0 ou 1, dont les deux derniers sont
 *  la clé (97 − les 8 premiers modulo 97). */
export function bceValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  return /^[01]\d{9}$/.test(s) && 97 - (Number(s.slice(0, 8)) % 97) === Number(s.slice(8))
}

/** NEQ québécois (Numéro d'entreprise du Québec) : 10 chiffres commençant par 11, 22, 33 ou 88. Le
 *  registre ne publie pas de clé de contrôle : seul le format se vérifie. */
export function neqValide(brut: string): boolean {
  return /^(11|22|33|88)\d{8}$/.test(normaliserSiret(brut))
}

/** Identifiant luxembourgeois : numéro RCS (B suivi de 1 à 6 chiffres) ou matricule national (11
 *  chiffres pour une personne morale, 13 pour une personne physique). */
export function identifiantLuxembourgValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  return /^B\d{1,6}$/.test(s) || /^(\d{11}|\d{13})$/.test(s)
}

/** Steuernummer allemande : 10 à 13 chiffres, le plus souvent écrits avec des barres (12/345/67890). Les
 *  formats varient d'un Land à l'autre et aucune clé commune ne les contrôle : seul le gabarit se vérifie. */
export function steuernummerValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  return /^\d{2,3}\/\d{3}\/\d{4,5}$/.test(s) || /^\d{10,13}$/.test(s)
}

/** USt-IdNr. allemande : DE puis 9 chiffres. */
export function ustIdNrValide(brut: string): boolean {
  return /^DE\d{9}$/.test(normaliserSiret(brut))
}

const LETTRES_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE'
/** NIF espagnol : DNI (8 chiffres + lettre de contrôle : le nombre modulo 23), NIE (X, Y ou Z + 7 chiffres +
 *  lettre : X, Y, Z valent 0, 1, 2) ou CIF de société (une lettre, 7 chiffres, une clé chiffre ou lettre). */
export function nifEspagnolValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  if (/^\d{8}[A-Z]$/.test(s)) return LETTRES_NIF[Number(s.slice(0, 8)) % 23] === s[8]
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return LETTRES_NIF[Number(String('XYZ'.indexOf(s[0])) + s.slice(1, 8)) % 23] === s[8]
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(s)
  if (!m) return false
  const chiffres = m[2]
  let somme = 0
  for (let i = 0; i < 7; i++) {
    const n = Number(chiffres[i])
    if (i % 2 === 0) { const d = n * 2; somme += Math.floor(d / 10) + (d % 10) } else somme += n
  }
  const cle = (10 - (somme % 10)) % 10
  // Selon la forme de la société, la clé est un chiffre ou une lettre (A = 1 … J = 0).
  return m[3] === String(cle) || m[3] === 'JABCDEFGHI'[cle]
}

/** 14 chiffres dont la clé de Luhn est juste. Seule exception connue : La
 *  Poste (SIREN 356 000 000), dont les établissements respectent une autre
 *  règle — la somme des chiffres est un multiple de 5. */
export function siretValide(brut: string): boolean {
  const s = normaliserSiret(brut)
  // Suisse : numéro IDE (CHE-123.456.789), clé modulo 11.
  if (/^CHE/.test(s)) return ideSuisseValide(s)
  // Belgique : numéro d'entreprise (BCE), 10 chiffres commençant par 0 ou 1, dont les deux
  // derniers sont la clé : 97 − (les 8 premiers modulo 97).
  if (bceValide(s)) return true
  // Québec (NEQ) et Luxembourg (RCS, matricule) : un identifiant valide, sans être français.
  if (neqValide(s) || identifiantLuxembourgValide(s)) return true
  // Allemagne (Steuernummer avec barres, USt-IdNr.) et Espagne (NIF/NIE/CIF).
  if (ustIdNrValide(s) || /^\d{2,3}\/\d{3}\/\d{4,5}$/.test(s) || nifEspagnolValide(s)) return true
  if (/^[01]\d{9}$/.test(s)) return false
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

/** Numéro de TVA suisse : le numéro IDE suivi de « TVA » (ou MWST, IVA, HTP selon la langue). */
const TVA_SUISSE = /^CHE[-.]?(\d{3})[-.]?(\d{3})[-.]?(\d{3})\s*(TVA|MWST|IVA|HTP)?$/i

export function normaliserNumeroTva(brut: string): string {
  const suisse = TVA_SUISSE.exec(brut.trim())
  // Suisse : forme légale « CHE-123.456.789 TVA » (« TVA » ajouté s'il manque).
  if (suisse) return `CHE-${suisse[1]}.${suisse[2]}.${suisse[3]} ${(suisse[4] ?? 'TVA').toUpperCase()}`
  return brut.replace(/\s/g, '').toUpperCase()
}

/** Numéro de TVA : français (FR, une clé de deux caractères, puis le SIREN), belge (BE, puis le
 *  numéro d'entreprise à 10 chiffres, clé comprise) ou suisse (CHE-123.456.789 TVA, IDE valide). */
export function numeroTvaValide(brut: string): boolean {
  if (TVA_SUISSE.test(brut.trim())) return ideSuisseValide(brut.trim().replace(/\s*(TVA|MWST|IVA|HTP)$/i, ''))
  const n = normaliserNumeroTva(brut.replace(/\./g, ''))
  if (/^BE[01]\d{9}$/.test(n)) return bceValide(n.slice(2))
  // Luxembourg : LU puis 8 chiffres, les deux derniers étant les six premiers modulo 89.
  if (/^LU\d{8}$/.test(n)) return Number(n.slice(2, 8)) % 89 === Number(n.slice(8))
  // Québec : numéro de TPS (9 chiffres, RT, 4 chiffres) ou de TVQ (10 chiffres, TQ, 4 chiffres).
  if (/^\d{9}RT\d{4}$/.test(n) || /^\d{10}TQ\d{4}$/.test(n)) return true
  // Allemagne : DE puis 9 chiffres. Espagne : ES puis le NIF (9 caractères).
  if (/^DE\d{9}$/.test(n)) return true
  if (/^ES[0-9A-Z]\d{7}[0-9A-Z]$/.test(n)) return nifEspagnolValide(n.slice(2))
  return /^FR[0-9A-Z]{2}\d{9}$/.test(n)
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
  if (!w.facture_siret || !siretValide(w.facture_siret)) manques.push(`votre ${libelleIdentifiant(paysFacturation(w))}`)
  if (!w.facture_adresse?.trim()) manques.push('votre adresse professionnelle')
  if (societe) {
    if (!w.facture_forme_juridique?.trim()) manques.push('votre forme juridique')
    if (!w.facture_capital?.trim()) manques.push('votre capital social')
    if (!w.facture_immatriculation?.trim()) {
      const pays = paysFacturation(w)
      manques.push(pays === 'BE' ? 'votre immatriculation (RPM)' : pays === 'CH' ? 'votre inscription au registre du commerce (RC)'
        : pays === 'QC' ? 'votre immatriculation (REQ)' : pays === 'DE' ? 'votre inscription au registre du commerce (HRB)'
          : pays === 'ES' ? 'votre inscription au Registro Mercantil' : 'votre immatriculation (RCS)')
    }
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
  /** Absent des factures de réservation, qui sont toutes des factures. Porté par les
   *  documents écrits à la main (voir `lib/documents.ts`), où le même contenu sert un devis
   *  ou une facture : c'est ce champ qui décide du titre et des mentions du PDF. */
  genre?: 'devis' | 'facture'
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
    /** Absent des factures de réservation (le téléphone y vit sur la réservation). Porté par
     *  les documents écrits à la main : c'est par lui qu'un devis part sur WhatsApp. */
    telephone?: string | null
    professionnel: boolean
    entreprise: string | null
    siren: string | null
    adresseFacturation: string
    /** Modèle du véhicule, texte libre — absent des factures de réservation (la page publique
     *  le demande déjà, voir `bookings.vehicles_detail`). Porté par les documents écrits à la
     *  main : même besoin, même endroit où le taper (2026-09-28, Alexandre : « demandé le
     *  véhicule dans les devis du coup quand on les fait à la main »). */
    vehicule?: string | null
  }
  /** `date` est nulle quand la prestation n'est pas encore planifiée — le cas normal d'un
   *  devis. Une facture de réservation en porte toujours une. */
  prestation: { date: string | null; lieu: string; nature: 'Prestation de services' }
  lignes: LigneFacture[]
  remiseTtc: number
  /** Libellé de la ligne de remise ; absent des factures émises avant la remise du laveur. */
  libelleRemise?: string
  totaux: { ht: number; tva: number; ttc: number }
  /** Devis seulement : jusqu'à quand le prix engage le laveur (`YYYY-MM-DD`). */
  valableJusquau?: string | null
  /** Mot libre du laveur, imprimé sous les totaux (conditions, délai, accès au chantier). */
  note?: string | null
}

export type ReservationFacturable = {
  client_name: string
  client_email: string
  address: string
  /** 'centre' : `address` est celle du centre auto du laveur, pas celle du client. */
  lieu?: string | null
  scheduled_at: string
  is_professional: boolean | null
  company_name: string | null
  siret: string | null
  billing_address: string | null
  booked_price: number | null
  is_smart_slot: boolean | null
  smart_discount: number | null
  /** Remise accordée par le laveur, déjà retranchée de `booked_price` (lib/remiseLaveur.ts). */
  remise_laveur?: number | null
  vehicle_count: number | null
  travel_fee: number | null
  vehicles_detail: { type: string; count: number; unit_price: number; label?: string }[] | null
  selected_addons: { id?: string; label?: string; price?: number }[] | null
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

const remiseLaveur = (r: ReservationFacturable) => Math.max(0, Number(r.remise_laveur ?? 0))

/** Lignes de la facture, avant remise.
 *
 *  Le total enregistré (`booked_price`) est recalculé côté serveur à la
 *  réservation, mais le détail par véhicule et par option a été transmis par
 *  le navigateur. Une facture dont les lignes ne retombent pas sur le total
 *  serait fausse : en cas d'écart, on facture le total, sur une seule ligne. */
export function lignesFacture(r: ReservationFacturable): LigneFacture[] {
  // Les lignes portent le prix avant la remise du laveur ; elle s'affiche ensuite à part.
  const total = arrondi(Number(r.booked_price ?? 0) + remiseLaveur(r))
  const nomService = r.services?.name ?? 'Prestation'
  const uneLigne = [ligne(nomService, 1, total)]

  const options = (r.selected_addons ?? [])
    .filter(a => Number(a.price) > 0)
    // Une prestation ajoutée (lib/plusieursPrestations.ts) est une prestation, pas une option.
    .map(a => ligne(estPrestationSupplementaire(a) ? String(a.label ?? 'Prestation') : `Option : ${a.label ?? 'supplément'}`, 1, Number(a.price)))
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
  const remiseSmart = r.is_smart_slot && Number(r.smart_discount) > 0 ? Number(r.smart_discount) : 0
  const remiseTtc = arrondi(Math.min(remiseSmart + remiseLaveur(r), brut))
  const libelleRemise = remiseLaveur(r) > 0
    ? (remiseSmart > 0 ? 'Remises (créneau optimisé et geste commercial)' : 'Remise accordée')
    : 'Remise créneau optimisé'
  const regime: RegimeTva = v.facture_regime_tva === 'assujetti' ? 'assujetti' : 'franchise'
  const taux = regime === 'assujetti' ? Number(v.facture_taux_tva ?? tauxTvaNormal(paysFacturation(v))) : 0
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
      // Au centre auto, l'adresse du rendez-vous est celle du laveur : on ne connaît pas celle
      // du client, mieux vaut aucune adresse qu'une fausse.
      adresseFacturation: (pro && r.billing_address?.trim()) || (r.lieu === 'centre' ? '' : r.address),
    },
    prestation: { date: r.scheduled_at, lieu: adresseAvecLieu(r.address, r.lieu), nature: 'Prestation de services' },
    lignes,
    remiseTtc,
    ...(remiseTtc > 0 ? { libelleRemise } : {}),
    totaux: totauxFacture(brut - remiseTtc, regime, taux),
  }
}

/** Le pays qui règle le profil de facturation : celui du téléphone confirmé quand il est belge ou
 *  suisse (c'est le choix fait à l'inscription), sinon ce que dit `paysFacturation` (TVA, puis
 *  identifiant saisi) — un laveur à numéro français reste libre de facturer avec un BCE belge. */
export function paysDuProfil(w: { facture_numero_tva?: string | null; facture_siret?: string | null; phone?: string | null }): PaysFacturation {
  return paysDuTelephoneLaveur(w.phone) ?? paysFacturation(w)
}
