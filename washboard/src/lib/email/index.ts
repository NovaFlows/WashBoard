import { Resend } from 'resend'
import type { VehicleItem } from '@/types'
import { escapeHtml } from '@/lib/escapeHtml'
import { FUSEAU } from '@/lib/dateUtils'
import { trustedOrigin } from '@/lib/appOrigin'
import { assistanceThreadUrl } from '@/lib/supportMapping'
import { PLAN_PRICES, BOOKING_QUOTA, PLAN_COULEURS, formatEuros } from '@/lib/plan'
import { teintesCarte } from '@/lib/carteFidelite'
import {
  COULEUR, POLICE, MONO, page, enteteWashBoard, enteteLaveur, iconeTitre, titre, paragraphe,
  bouton, boutonEnLigne, details, encadre, bloc, etiquette, type LigneDetail,
} from './gabarit'

/** Origine des images (logo, icônes) pour les emails qui ne reçoivent pas `appUrl`. */
function origineImages(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
}

const QUESTIONS = 'Des questions ? Écrivez-nous à novaflows.pro@gmail.com'

/** L'étoile du créneau optimisé (l'ancien caractère étoile), dessinée. */
function etoileCreneau(base: string, alt: string): string {
  return `<img src="${base}/email/etoile.png" width="14" height="14" alt="${alt}" style="display:inline-block;vertical-align:-2px;border:0;">`
}

function formatVehicle(type?: string, count?: number): string | null {
  if (!type) return null
  const labels: Record<string, string> = {
    citadine: 'Citadine', citadine_2p: 'Citadine 2p', berline: 'Berline',
    SUV: 'SUV / 4x4', monospace: 'Monospace', utilitaire: 'Utilitaire',
  }
  const label = labels[type] ?? type
  return count && count > 1 ? `${label} ×${count}` : label
}

// Type, modèles et options arrivent tels que le client les a envoyés au formulaire de
// réservation : échappés ici, sinon un modèle « <a href=…> » partait en lien cliquable.
function vehiclesHtml(items: VehicleItem[]): string {
  return items.map(v => {
    const label = formatVehicle(v.type, v.count) ?? v.type
    const mdls  = (v.models ?? []).filter(Boolean)
    const sub   = mdls.length ? `<br/><span style="font-size:13px;color:${COULEUR.gris};font-weight:500;">${escapeHtml(mdls.join(' · '))}</span>` : ''
    return `<span style="display:block;">${escapeHtml(label)}${sub}</span>`
  }).join('')
}

/** Petit encadré blanc à l'intérieur d'un bloc papier (moyens de paiement de l'acompte). */
function sousBloc(html: string): string {
  return `<div style="margin-top:10px;padding:12px 14px;background:${COULEUR.carte};border:1px solid ${COULEUR.filet};border-radius:10px;font-family:${POLICE};font-size:13.5px;color:${COULEUR.encre};line-height:1.6;">${html}</div>`
}

// ── Email 1 : accusé de réception (statut pending) ────────────────────────
type SendRequestParams = {
  to: string
  clientName: string
  washerName: string
  serviceName: string
  servicePrice: number
  isSmartSlot?: boolean
  smartDiscount?: number
  address: string
  scheduledAt: string
  bookingId: string
  vehicleType?: string
  vehicleCount?: number
  vehiclesDetail?: VehicleItem[]
  notes?: string
  selectedAddons?: Array<{ label: string; price: number }>
  /** Carte de fidélité du client chez ce laveur (lib/fidelite.ts). */
  fidelite?: { url: string; progression: number; requis: number; phrase: string }
  /** Acompte demandé par le laveur, payé par SON lien (voir lib/acompte.ts). */
  acompte?: { montant: number; liens: { libelle: string; url: string }[]; virement?: { titulaire: string; iban: string; reference: string } | null; wero?: { telephone: string; lien: string | null } | null; conditions: string[] }
}

export async function sendBookingRequest(params: SendRequestParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const base = origineImages()

  const date         = new Date(params.scheduledAt)
  const formattedDate = date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  const ref           = params.bookingId.slice(0, 8).toUpperCase()
  const discount      = Number(params.smartDiscount ?? 0)
  const finalPrice    = params.isSmartSlot && discount > 0 ? Math.max(0, params.servicePrice - discount) : params.servicePrice
  const priceStr      = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const vehicleContent1 = params.vehiclesDetail?.length
    ? vehiclesHtml(params.vehiclesDetail)
    : (escapeHtml(formatVehicle(params.vehicleType, params.vehicleCount)) || null)

  const lignes: LigneDetail[] = [
    { libelle: 'Prestation', valeur: escapeHtml(params.serviceName) },
    ...(vehicleContent1 ? [{ libelle: 'Véhicule(s)', valeur: vehicleContent1 }] : []),
    ...(params.selectedAddons?.length ? [{ libelle: 'Options', valeur: escapeHtml(params.selectedAddons.map(a => a.label).join(' · ')) }] : []),
    { libelle: 'Date', valeur: formattedDate },
    { libelle: 'Heure', valeur: time },
    { libelle: 'Adresse', valeur: escapeHtml(params.address) },
    ...(params.notes ? [{ libelle: 'Notes', gauche: true, valeur: `<span style="font-size:13px;font-weight:400;font-style:italic;color:${COULEUR.gris};">${escapeHtml(params.notes)}</span>` }] : []),
    { libelle: 'Montant estimé', fort: true, valeur: `${priceStr}€${params.isSmartSlot && discount > 0 ? ` ${etoileCreneau(base, 'créneau optimisé')}` : ''} <span style="font-weight:400;color:${COULEUR.gris};">(sur place)</span>` },
  ]

  const acompte = params.acompte ? bloc(`
<p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${COULEUR.encre};">Acompte à régler : ${formatEuros(params.acompte.montant)} €</p>
${params.acompte.conditions.map(c => `<p style="margin:0 0 4px;font-size:13.5px;color:${COULEUR.gris};line-height:1.5;">${escapeHtml(c)}</p>`).join('')}
${params.acompte.wero ? sousBloc(`<strong>Par Wero</strong><br>
Envoyez ${formatEuros(params.acompte.montant)} € avec Wero, depuis l’application de votre banque, au <strong>${escapeHtml(params.acompte.wero.telephone)}</strong>.
${params.acompte.wero.lien ? `<br>${boutonEnLigne('Payer avec Wero', escapeHtml(params.acompte.wero.lien))}` : ''}`) : ''}
${params.acompte.virement ? sousBloc(`<strong>Par virement</strong><br>
Titulaire : ${escapeHtml(params.acompte.virement.titulaire)}<br>
IBAN : <span style="font-family:${MONO};">${escapeHtml(params.acompte.virement.iban)}</span><br>
Montant : ${formatEuros(params.acompte.montant)} €<br>
Libellé à indiquer : <strong style="font-family:${MONO};">${escapeHtml(params.acompte.virement.reference)}</strong>`) : ''}
${params.acompte.liens.map(l => boutonEnLigne(`Payer avec ${escapeHtml(l.libelle)}`, escapeHtml(l.url))).join('')}`) : ''

  const fidelite = params.fidelite ? bloc(`
<p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${COULEUR.encre};">Votre carte de fidélité : ${params.fidelite.progression} / ${params.fidelite.requis}</p>
<p style="margin:0 0 10px;font-size:13.5px;color:${COULEUR.gris};line-height:1.5;">${escapeHtml(params.fidelite.phrase)}</p>
<a href="${escapeHtml(params.fidelite.url)}" style="font-size:14px;font-weight:700;color:${COULEUR.encre};">Voir ma carte</a>`) : ''

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Demande reçue — en attente de confirmation (Réf. ${ref})`,
    html: page({
      titre: 'Demande reçue',
      entete: enteteLaveur(escapeHtml(params.washerName)),
      contenu: `
${titre({ texte: 'Demande reçue', sousTitre: `En attente de confirmation par ${escapeHtml(params.washerName)}` })}
${paragraphe(`Bonjour <strong>${escapeHtml(params.clientName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre demande de réservation a bien été reçue. <strong>${escapeHtml(params.washerName)}</strong> va la confirmer dans les plus brefs délais.
Vous recevrez un email avec votre reçu dès que c&apos;est accepté.`, { marge: '0 0 20px' })}
${details(lignes)}
${acompte}
${fidelite}
${paragraphe(`Référence de votre demande : <strong style="font-family:${MONO};color:${COULEUR.encre};">${ref}</strong>`, { ton: 'gris', marge: '0' })}`,
      pied: 'Ce message est un accusé de réception automatique. Votre reçu vous sera envoyé à la confirmation.',
    }),
  })
}

// ── Email 2 : reçu professionnel (statut confirmed) ───────────────────────
type SendConfirmationParams = {
  to: string
  clientName: string
  clientEmail: string
  washerName: string
  washerPhone?: string | null
  serviceName: string
  vehicleType?: string
  vehicleCount?: number
  vehiclesDetail?: VehicleItem[]
  notes?: string
  servicePrice: number
  isSmartSlot?: boolean
  smartDiscount?: number
  address: string
  scheduledAt: string
  bookingId: string
  /** Jeton d'accès au PDF (voir bookingToken). Requis et non optionnel : un appel qui
   *  l'oublierait enverrait un lien que le client ne pourra plus ouvrir si la réservation
   *  est verrouillée — mieux vaut que ça ne compile pas. `null` seulement si la clé manque. */
  jeton: string | null
  appUrl?: string
}

export async function sendBookingConfirmation(params: SendConfirmationParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const date = new Date(params.scheduledAt)
  const formattedDate = date.toLocaleDateString('fr-FR', { timeZone: FUSEAU,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  const today = new Date().toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })

  const ref       = params.bookingId.slice(0, 8).toUpperCase()
  const discount  = Number(params.smartDiscount ?? 0)
  const finalPrice = params.isSmartSlot && discount > 0
    ? Math.max(0, params.servicePrice - discount)
    : params.servicePrice
  const finalPriceStr = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const basePriceStr  = Number.isInteger(params.servicePrice) ? String(params.servicePrice) : params.servicePrice.toFixed(2)

  const appUrl    = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const pdfUrl    = `${appUrl}/api/bookings/${params.bookingId}/pdf${params.jeton ? `?jeton=${params.jeton}` : ''}`
  const vehicleStr   = params.vehiclesDetail?.length
    ? params.vehiclesDetail.map(v => {
        const lbl  = formatVehicle(v.type, v.count) ?? v.type
        const mdls = (v.models ?? []).filter(Boolean)
        return mdls.length ? `${lbl} (${mdls.join(', ')})` : lbl
      }).join(', ')
    : (formatVehicle(params.vehicleType, params.vehicleCount) ?? '')
  const vehicleLabel = vehicleStr ? ` — ${escapeHtml(vehicleStr)}` : ''
  const optimise     = params.isSmartSlot && discount > 0
  const nom          = escapeHtml(params.washerName)
  const tel          = params.washerPhone ? escapeHtml(params.washerPhone) : ''

  const colonne = (libelle: string, corps: string, separe: boolean) =>
    `<td class="wb-col" width="33%" style="width:33%;padding:0 12px 0 ${separe ? '14px' : '0'};vertical-align:top;${separe ? `border-left:1px solid ${COULEUR.filet};` : ''}">
${etiquette(libelle, '0 0 6px')}
${corps}
</td>`

  const contenu = `
${titre({ surtitre: `Réf. ${ref}`, texte: 'Reçu de prestation de service' })}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:4px 0 26px;"><tr>
${colonne('Prestataire', `<p style="margin:0;font-size:14px;font-weight:700;color:${COULEUR.encre};">${nom}</p>${tel ? `<p style="margin:3px 0 0;font-size:13px;color:${COULEUR.gris};">${tel}</p>` : ''}`, false)}
${colonne('Client', `<p style="margin:0;font-size:14px;font-weight:700;color:${COULEUR.encre};">${escapeHtml(params.clientName)}</p><p style="margin:3px 0 0;font-size:13px;color:${COULEUR.gris};word-break:break-all;">${escapeHtml(params.clientEmail)}</p>`, true)}
${colonne('Date d&apos;émission', `<p style="margin:0;font-size:14px;font-weight:600;color:${COULEUR.encre};">${today}</p>`, true)}
</tr></table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${POLICE};">
  <tr>
    <td style="padding:0 0 8px;border-bottom:1px solid ${COULEUR.filet};">${etiquette('Désignation', '0')}</td>
    <td style="padding:0 0 8px;border-bottom:1px solid ${COULEUR.filet};text-align:right;white-space:nowrap;">${etiquette('Montant TTC', '0')}</td>
  </tr>
  <tr>
    <td style="padding:16px 12px 16px 0;vertical-align:top;border-bottom:1px solid ${COULEUR.filet};">
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;line-height:1.4;color:${COULEUR.encre};">${escapeHtml(params.serviceName)}${vehicleLabel}</p>
      <p style="margin:0 0 2px;font-size:13px;line-height:1.5;color:${COULEUR.gris};">${formattedDate} à ${time}</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:${COULEUR.gris};">${escapeHtml(params.address)}</p>
      ${optimise ? `<p style="margin:8px 0 0;font-size:12.5px;font-weight:600;color:${COULEUR.encre};">${etoileCreneau(appUrl, '')} Créneau optimisé (-${discount}€)</p>` : ''}
    </td>
    <td style="padding:16px 0;vertical-align:top;text-align:right;white-space:nowrap;border-bottom:1px solid ${COULEUR.filet};">
      ${optimise
        ? `<p style="margin:0 0 2px;font-size:13px;color:${COULEUR.grisPetit};text-decoration:line-through;">${basePriceStr}€</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:${COULEUR.encre};">${finalPriceStr}€</p>`
        : `<p style="margin:0;font-size:15px;font-weight:700;color:${COULEUR.encre};">${finalPriceStr}€</p>`}
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:10px 0;font-size:12.5px;font-style:italic;color:${COULEUR.grisPetit};">TVA non applicable — art. 293 B du CGI</td>
  </tr>
  <tr>
    <td style="padding:14px 12px 0 0;border-top:2px solid ${COULEUR.encre};font-size:12.5px;font-weight:700;line-height:1.35;letter-spacing:.06em;color:${COULEUR.encre};">TOTAL À RÉGLER SUR PLACE</td>
    <td style="padding:12px 0 0;border-top:2px solid ${COULEUR.encre};text-align:right;white-space:nowrap;font-size:24px;font-weight:700;letter-spacing:-0.02em;font-stretch:108%;color:${COULEUR.encre};">${finalPriceStr}€</td>
  </tr>
</table>
${paragraphe('Mode de règlement : paiement comptant sur place', { ton: 'petit', marge: '10px 0 24px', style: 'text-align:right;' })}
${params.notes ? bloc(`${etiquette('Notes du client', '0 0 4px')}<p style="margin:0;font-size:14px;line-height:1.5;font-style:italic;color:${COULEUR.encre};">${escapeHtml(params.notes)}</p>`) : ''}
${encadre(`<strong>Justificatif de prestation — facture</strong><br><span style="font-weight:400;color:${COULEUR.gris};">Ce document fait office de reçu de prestation de service. Référence : <strong style="color:${COULEUR.encre};">${ref}</strong> · Émis le ${today}</span>`, 'neutre')}
${bouton('Télécharger la confirmation PDF', pdfUrl, 'sombre', '0')}`

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Reçu de réservation #${ref} — ${escapeHtml(params.washerName)}`,
    html: page({
      titre: 'Reçu de réservation',
      entete: enteteLaveur(nom, `Prestataire de nettoyage et d'entretien à domicile${tel ? `<br>${tel}` : ''}`),
      contenu,
      pied: 'Ce reçu a été généré automatiquement par WashBoard · Réservation de prestations à domicile',
    }),
  })
}

// ── Email 5 : relance client (rebooking) ─────────────────────────────────
type SendFollowupEmailParams = {
  to: string
  clientName: string
  washerName: string
  message: string
}

export async function sendFollowupEmail(params: SendFollowupEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  return resend.emails.send({
    from: `${escapeHtml(params.washerName)} via WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Un message de ${escapeHtml(params.washerName)}`,
    html: page({
      titre: `Un message de ${escapeHtml(params.washerName)}`,
      entete: enteteLaveur(escapeHtml(params.washerName)),
      contenu: `
${titre({ texte: `Un message de ${escapeHtml(params.washerName)}` })}
${paragraphe(escapeHtml(params.message), { marge: '0', style: 'white-space:pre-line;line-height:1.7;' })}`,
      pied: `Message envoyé via WashBoard pour le compte de ${escapeHtml(params.washerName)}`,
    }),
  })
}

// ── Email 4 : demande d'avis Google (suivi client) ────────────────────────
type SendReviewRequestParams = {
  to: string
  clientName: string
  washerName: string
  reviewUrl: string
}

export async function sendReviewRequest(params: SendReviewRequestParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const base = origineImages()

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Votre avis compte pour ${escapeHtml(params.washerName)}`,
    html: page({
      titre: 'Merci pour votre confiance !',
      entete: enteteLaveur(escapeHtml(params.washerName)),
      contenu: `
${titre({ texte: 'Merci pour votre confiance !', sousTitre: `Comment s'est passé votre lavage avec ${escapeHtml(params.washerName)} ?` })}
${paragraphe(`Bonjour <strong>${escapeHtml(params.clientName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre véhicule est tout propre ? On espère que vous êtes satisfait·e !
Un petit avis Google aiderait énormément <strong>${escapeHtml(params.washerName)}</strong> — ça prend moins d'une minute.`, { marge: '0 0 22px' })}
<img src="${base}/email/etoiles.png" width="144" height="24" alt="" style="display:block;border:0;margin:0 0 24px;">
${bouton('Laisser un avis Google', escapeHtml(params.reviewUrl), 'sombre', '0')}
${paragraphe('Merci beaucoup pour votre soutien', { ton: 'gris', marge: '20px 0 0' })}`,
      pied: `Message envoyé via WashBoard pour le compte de ${escapeHtml(params.washerName)}`,
    }),
  })
}

// ── Email 5 : facture au client professionnel ─────────────────────────────
type SendFactureParams = {
  to: string
  clientName: string
  washerName: string
  numero: string
  bookingId: string
  /** Même règle que `SendConfirmationParams.jeton`. */
  jeton: string | null
  appUrl?: string
}

export async function sendFacture(params: SendFactureParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = `${appUrl}/api/bookings/${params.bookingId}/pdf${params.jeton ? `?jeton=${params.jeton}` : ''}`

  return resend.emails.send({
    from: `${escapeHtml(params.washerName)} via WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Facture ${escapeHtml(params.numero)} — ${escapeHtml(params.washerName)}`,
    html: page({
      titre: `Facture ${escapeHtml(params.numero)}`,
      entete: enteteLaveur(escapeHtml(params.washerName)),
      contenu: `
${titre({ texte: `Facture ${escapeHtml(params.numero)}` })}
${paragraphe(`Bonjour <strong>${escapeHtml(params.clientName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Merci pour votre confiance. Vous trouverez ci-dessous la facture de la prestation réalisée par
<strong>${escapeHtml(params.washerName)}</strong>.`, { marge: '0 0 24px' })}
${bouton('Télécharger la facture (PDF)', escapeHtml(url), 'sombre', '0')}`,
      pied: `Message envoyé via WashBoard pour le compte de ${escapeHtml(params.washerName)}`,
    }),
  })
}

// ── Email 6 : devis ou facture écrits à la main ───────────────────────────
//
// Envoyé à la demande du laveur, depuis l'écran « Devis et factures ». Le PDF part en PIÈCE
// JOINTE (demande d'Alexandre, 2026-09-27 : un client veut recevoir le document, pas un lien
// à aller chercher), ET le lien reste dans le message : la pièce jointe se perd dans un fil
// de discussion, le lien sert toujours la dernière version.
type SendDocumentParams = {
  to: string
  clientName: string
  washerName: string
  /** Réponses du client (acceptation d'un devis, question) : elles doivent arriver au laveur,
   *  pas dans le vide de `noreply@`. */
  washerEmail?: string | null
  genre: 'devis' | 'facture'
  numero: string
  documentId: string
  montantTtc: number
  /** Devis : jusqu'à quand le prix tient, déjà mis en forme (« 27 octobre 2026 »). */
  valableJusquau?: string | null
  /** Le PDF lui-même, joint au message. */
  piece?: { nom: string; contenu: Buffer } | null
  appUrl?: string
}

export async function sendDocument(params: SendDocumentParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = `${appUrl}/api/documents/${params.documentId}/pdf`
  const devis = params.genre === 'devis'
  const titreDoc = devis ? 'Devis' : 'Facture'
  const montant = `${params.montantTtc.toFixed(2).replace('.', ',')} €`

  return resend.emails.send({
    from: `${escapeHtml(params.washerName)} via WashBoard <noreply@washboard.fr>`,
    to: params.to,
    ...(params.washerEmail ? { replyTo: params.washerEmail } : {}),
    subject: `${titreDoc} ${escapeHtml(params.numero)} — ${escapeHtml(params.washerName)}`,
    ...(params.piece ? { attachments: [{ filename: params.piece.nom, content: params.piece.contenu }] } : {}),
    html: page({
      titre: `${titreDoc} ${escapeHtml(params.numero)}`,
      entete: enteteLaveur(escapeHtml(params.washerName)),
      contenu: `
${titre({ texte: `${titreDoc} ${escapeHtml(params.numero)}` })}
${paragraphe(`Bonjour <strong>${escapeHtml(params.clientName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(devis
  ? `Voici le devis demandé à <strong>${escapeHtml(params.washerName)}</strong>, d'un montant de <strong>${montant}</strong>.`
  : `Merci pour votre confiance. Voici la facture de <strong>${escapeHtml(params.washerName)}</strong>, d'un montant de <strong>${montant}</strong>.`, { marge: '0 0 20px' })}
${devis && params.valableJusquau
  ? encadre(`Ce prix reste valable jusqu'au <strong>${escapeHtml(params.valableJusquau)}</strong>. Pour l'accepter, répondez simplement à cet email.`, 'neutre', '0 0 20px')
  : ''}
${paragraphe('Le PDF est joint à ce message.', { ton: 'gris', marge: '0 0 16px' })}
${bouton(`Ouvrir ${devis ? 'le devis' : 'la facture'} en ligne`, escapeHtml(url), 'sombre', '0')}`,
      pied: `Message envoyé via WashBoard pour le compte de ${escapeHtml(params.washerName)}`,
    }),
  })
}

// ── Email 3 : notification nouvelle réservation au laveur ─────────────────
type SendWasherNotificationParams = {
  to: string
  washerName: string
  clientName: string
  clientEmail: string
  clientPhone: string
  serviceName: string
  vehicleType?: string
  vehicleCount?: number
  vehiclesDetail?: VehicleItem[]
  notes?: string
  selectedAddons?: Array<{ label: string; price: number }>
  address: string
  scheduledAt: string
  bookedPrice: number
  bookingId: string
}

/** Email au laveur pour une réservation au-delà de son quota.
 *
 *  Un gabarit à part plutôt qu'une option de plus sur l'email complet : celui-ci
 *  compose le téléphone, l'adresse, le montant et l'heure à une dizaine
 *  d'endroits. Y ajouter des « si masqué » un peu partout, c'est garantir qu'un
 *  jour l'un d'eux sera oublié — et un seul oubli suffit à tout révéler.
 *
 *  Le laveur apprend LE JOUR, et rien d'autre. Pas même le nom : reconnu, il
 *  suffirait à rappeler le client par ses propres moyens (voir
 *  `masquerVerrouillees`). La fonction ne le reçoit donc pas — un paramètre
 *  absent ne peut pas finir dans l'objet ou le corps du message. */
export async function sendWasherBookingLocked({ to, washerName, scheduledAt, appUrl }: {
  to: string
  washerName: string
  scheduledAt: string
  appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  // Le jour, jamais l'heure : l'heure suffirait a honorer le rendez-vous sans
  // rien payer.
  const jour = new Date(scheduledAt).toLocaleDateString('fr-FR', {
    timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long',
  })
  const jourTitre = jour.charAt(0).toUpperCase() + jour.slice(1)

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Nouvelle réservation — ${jour}`,
    html: page({
      titre: 'Nouvelle réservation',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'cadenas'), texte: 'Nouvelle réservation', sousTitre: 'Elle dépasse votre offre actuelle' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 18px' })}
${bloc(`<p style="margin:0 0 4px;font-size:19px;font-weight:700;letter-spacing:-0.01em;color:${COULEUR.encre};">${jourTitre}</p>
<p style="margin:0;font-size:14px;color:${COULEUR.gris};">Client masqué par votre offre</p>`, '0 0 20px')}
${paragraphe(`Son nom, son téléphone, son adresse et l'heure du rendez-vous sont masqués : cette réservation
dépasse ce que votre offre affiche ce mois-ci. Changez d'offre pour la débloquer —
et toutes les suivantes avec.`, { marge: '0 0 24px' })}
${bouton('Débloquer cette réservation →', `${url}/dashboard/abonnement`, 'accent', '0')}`,
      pied: QUESTIONS,
    }),
  })
}

export async function sendWasherNotification(params: SendWasherNotificationParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const date          = new Date(params.scheduledAt)
  const formattedDate = date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  const ref           = params.bookingId.slice(0, 8).toUpperCase()
  const priceStr      = Number.isInteger(params.bookedPrice) ? String(params.bookedPrice) : params.bookedPrice.toFixed(2)
  const base          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  const dashboardUrl  = `${base}/dashboard`
  const vehicleContent3 = params.vehiclesDetail?.length
    ? vehiclesHtml(params.vehiclesDetail)
    : (escapeHtml(formatVehicle(params.vehicleType, params.vehicleCount)) || null)

  // Ordre de lecture du laveur entre deux prestations : quand, où, qui, quoi.
  const lignes: LigneDetail[] = [
    { libelle: 'Date', valeur: `${formattedDate} à ${time}` },
    { libelle: 'Adresse', valeur: escapeHtml(params.address) },
    { libelle: 'Client', valeur: escapeHtml(params.clientName) },
    { libelle: 'Téléphone', valeur: `<a href="tel:${escapeHtml(params.clientPhone)}" style="color:${COULEUR.accent};">${escapeHtml(params.clientPhone)}</a>` },
    { libelle: 'Email', valeur: `<a href="mailto:${escapeHtml(params.clientEmail)}" style="color:${COULEUR.accent};">${escapeHtml(params.clientEmail)}</a>` },
    { libelle: 'Prestation', valeur: escapeHtml(params.serviceName) },
    ...(vehicleContent3 ? [{ libelle: 'Véhicule(s)', valeur: vehicleContent3 }] : []),
    ...(params.selectedAddons?.length ? [{ libelle: 'Options', valeur: escapeHtml(params.selectedAddons.map(a => a.label).join(' · ')) }] : []),
    { libelle: 'Montant', fort: true, valeur: `${priceStr}€` },
  ]

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Nouvelle réservation — ${escapeHtml(params.clientName)} (Réf. ${ref})`,
    html: page({
      titre: 'Nouvelle réservation',
      entete: enteteWashBoard(base),
      contenu: `
${titre({ icone: iconeTitre(base, 'calendrier'), texte: 'Nouvelle réservation', sousTitre: 'Un client vient de faire une demande sur votre page WashBoard' })}
${paragraphe(`Bonjour <strong>${escapeHtml(params.washerName)}</strong>,`, { marge: '0 0 12px' })}
${details(lignes)}
${params.notes ? bloc(`${etiquette('Notes du client', '0 0 4px')}<p style="margin:0;font-size:14px;line-height:1.5;font-style:italic;color:${COULEUR.encre};">${escapeHtml(params.notes)}</p>`, '0 0 24px') : ''}
${bouton('Voir dans WashBoard', dashboardUrl, 'accent', '0')}`,
      pied: `Réf. <strong>${ref}</strong> · WashBoard`,
    }),
  })
}

// ── Email : rappel J-3 avant fin du trial ────────────────────────────────
export async function sendTrialReminder({ to, washerName, trialEndsAt, appUrl }: {
  to: string; washerName: string; trialEndsAt: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  const date = new Date(trialEndsAt).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' })

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre essai gratuit se termine dans 3 jours — WashBoard`,
    html: page({
      titre: 'Plus que 3 jours',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'sablier'), texte: 'Plus que 3 jours', sousTitre: 'Votre essai gratuit WashBoard se termine bientôt' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre période d&apos;essai gratuit se termine le <strong>${date}</strong>.
Pour continuer à utiliser WashBoard sans interruption, activez votre abonnement avant cette date.`, { marge: '0 0 20px' })}
${encadre('Après expiration, vous avez encore 30 jours pour régulariser avant que votre page de réservation soit suspendue.', 'ambre')}
${bouton('Activer mon abonnement →', `${url}/dashboard/abonnement`, 'accent', '0')}`,
      pied: QUESTIONS,
    }),
  })
}

// ── Email : expiration du trial (J0) ─────────────────────────────────────
export async function sendTrialExpired({ to, washerName, appUrl, retourGratuit = false }: {
  to: string; washerName: string; appUrl?: string
  /** Règle 2026 : le compte retombe sur Découverte au lieu d'être suspendu.
   *  Le ton de l'email change du tout au tout — annoncer une coupure qui
   *  n'aura pas lieu, c'est perdre la confiance du laveur ET la crédibilité de
   *  tous les emails suivants. */
  retourGratuit?: boolean
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'

  if (retourGratuit) {
    return resend.emails.send({
      from: 'WashBoard <noreply@washboard.fr>',
      to,
      subject: `Votre mois d'essai est terminé — quelle formule vous va ?`,
      html: page({
        titre: 'Votre mois d&apos;essai est terminé',
        entete: enteteWashBoard(url),
        contenu: `
${titre({ icone: iconeTitre(url, 'etiquette'), texte: 'Votre mois d&apos;essai est terminé', sousTitre: 'Rien ne s&apos;arrête — à vous de choisir la suite' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Vous avez essayé WashBoard pendant un mois, avec tout le produit. Votre page de
réservation, votre agenda et vos clients sont toujours là — nous ne coupons rien.`, { marge: '0 0 20px' })}
${encadre(`En attendant votre choix, votre compte est passé sur l&apos;offre Découverte :
gratuite, ${BOOKING_QUOTA.decouverte} réservations par mois.`, 'neutre', '0 0 20px')}
${paragraphe(`Dès que votre activité dépasse ce rythme, passez à la formule qui vous va :
<strong>Starter à ${formatEuros(PLAN_PRICES.starter)}€/mois</strong> (${BOOKING_QUOTA.starter} réservations),
ou <strong>Pro à ${formatEuros(PLAN_PRICES.pro)}€/mois</strong> (réservations illimitées, comptabilité, avis Google, relances).`, { marge: '0 0 24px' })}
${bouton('Choisir ma formule →', `${url}/dashboard/abonnement`, 'accent', '0')}
${paragraphe('Sans engagement · Vous pouvez rester sur Découverte aussi longtemps que vous voulez', { ton: 'petit', marge: '16px 0 0' })}`,
        pied: QUESTIONS,
      }),
    })
  }

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre essai gratuit a expiré — WashBoard`,
    html: page({
      titre: 'Essai expiré',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'alerte'), texte: 'Essai expiré', sousTitre: 'Votre période d&apos;essai gratuit est terminée' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre essai gratuit WashBoard est arrivé à son terme. Votre dashboard reste accessible,
mais votre page de réservation sera suspendue dans <strong>30 jours</strong> si vous n&apos;activez pas votre abonnement.`, { marge: '0 0 20px' })}
${encadre('Sans abonnement actif, vos clients ne pourront plus réserver en ligne dans 30 jours.', 'rouge')}
${bouton(`Activer mon abonnement — à partir de ${formatEuros(PLAN_PRICES.starter)}€/mois →`, `${url}/dashboard/abonnement`, 'accent', '0')}
${paragraphe('PayPal ou virement · Activation sous 24h · Sans engagement', { ton: 'petit', marge: '16px 0 0' })}`,
      pied: QUESTIONS,
    }),
  })
}

// ── Email : rappel renouvellement abonnement J-3 ─────────────────────────
export async function sendSubReminder({ to, washerName, endsAt, appUrl }: {
  to: string; washerName: string; endsAt: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  const date = new Date(endsAt).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' })

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre abonnement WashBoard se termine dans 3 jours`,
    html: page({
      titre: 'Renouvellement dans 3 jours',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'sablier'), texte: 'Renouvellement dans 3 jours', sousTitre: 'Votre abonnement WashBoard arrive à échéance' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre abonnement WashBoard se termine le <strong>${date}</strong>.
Pour continuer à recevoir des réservations sans interruption, renouvelez votre paiement avant cette date.`, { marge: '0 0 20px' })}
${encadre('Effectuez votre paiement par PayPal ou virement — activation sous 24h ouvrées.', 'ambre')}
${bouton('Renouveler mon abonnement →', `${url}/dashboard/abonnement`, 'accent', '0')}`,
      pied: QUESTIONS,
    }),
  })
}

// ── Email : abonnement payant expiré (J0) ────────────────────────────────
export async function sendSubExpired({ to, washerName, appUrl }: {
  to: string; washerName: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre abonnement WashBoard a expiré`,
    html: page({
      titre: 'Abonnement expiré',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'alerte'), texte: 'Abonnement expiré', sousTitre: 'Votre abonnement WashBoard est arrivé à échéance' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre abonnement WashBoard est expiré. Votre page de réservation sera suspendue
dans <strong>30 jours</strong> si vous ne renouvelez pas votre paiement.`, { marge: '0 0 20px' })}
${encadre('Sans renouvellement, vos clients ne pourront plus réserver en ligne dans 30 jours.', 'rouge')}
${bouton(`Renouveler mon abonnement — à partir de ${formatEuros(PLAN_PRICES.starter)}€/mois →`, `${url}/dashboard/abonnement`, 'accent', '0')}
${paragraphe('PayPal ou virement · Activation sous 24h · Sans engagement', { ton: 'petit', marge: '16px 0 0' })}`,
      pied: QUESTIONS,
    }),
  })
}

// ── Email : réponse de l'équipe à une question support ───────────────────
//
// Ne contient JAMAIS le texte de la réponse : un email circule en clair, peut
// être transféré, et la réponse peut mentionner des détails de compte. Le
// laveur la lit une fois connecté, via le bouton ci-dessous — voir
// `src/app/api/support/team-questions/[id]/route.ts`.
// Volontairement SANS paramètre pour le texte de la réponse : un email circule
// en clair et se transfère, la réponse peut contenir des détails de compte.
// Le laveur la lit une fois connecté. Et le titre de la question n'entre
// jamais dans l'objet (fixe) : il est écrit par le laveur. Le test
// `support.test.ts` fige le contenu de cet email pour que toute évolution de
// l'un ou l'autre point soit un choix conscient.
export async function sendSupportReply({ to, titreQuestion, questionId, appUrl }: {
  to: string; titreQuestion: string; questionId: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const base = appUrl ?? trustedOrigin(null)
  const url = `${base}${assistanceThreadUrl(questionId)}`

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Réponse de l'équipe WashBoard`,
    html: page({
      titre: 'Nouvelle réponse',
      entete: enteteWashBoard(base),
      contenu: `
${titre({ icone: iconeTitre(base, 'bulle'), texte: 'Nouvelle réponse', sousTitre: 'L&apos;équipe WashBoard a répondu à votre question' })}
${paragraphe(`À propos de : <strong style="color:${COULEUR.encre};">${escapeHtml(titreQuestion)}</strong>`, { ton: 'gris', marge: '0 0 24px' })}
${bouton('Voir la réponse →', url, 'accent', '0')}
${paragraphe('Connectez-vous à votre tableau de bord pour la lire.', { ton: 'petit', marge: '16px 0 0' })}`,
    }),
  })
}

// ── Email : dernier avertissement avant coupure totale (J-5 fin de grâce) ─
export async function sendGraceEndingWarning({ to, washerName, cutoffDate, appUrl }: {
  to: string; washerName: string; cutoffDate: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  const date = new Date(cutoffDate).toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' })

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Dans 5 jours vous perdez l'accès complet à WashBoard`,
    html: page({
      titre: 'Dernier rappel avant coupure',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'alerte'), texte: 'Dernier rappel avant coupure', sousTitre: 'Il vous reste 5 jours pour régulariser' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Vous avez déjà bénéficié d&apos;un mois complet de délai de grâce depuis la fin de votre abonnement.
Le <strong>${date}</strong>, si votre situation n&apos;est pas régularisée, votre accès à WashBoard sera
<strong>entièrement coupé</strong> :`, { marge: '0 0 10px' })}
<ul style="margin:0 0 22px;padding-left:20px;font-family:${POLICE};font-size:15px;color:${COULEUR.encre};line-height:1.8;">
  <li>Accès à votre tableau de bord</li>
  <li>Page de réservation en ligne</li>
  <li>Réception de nouvelles réservations</li>
</ul>
${encadre('Réglez votre retard dès maintenant, ou contactez-nous pour prendre vos dispositions.', 'rouge')}
${bouton('Régulariser mon compte →', `${url}/dashboard/abonnement`, 'accent', '0')}
${paragraphe('PayPal ou virement · Activation sous 24h', { ton: 'petit', marge: '16px 0 0' })}`,
      pied: QUESTIONS,
    }),
  })
}

// ── Email : confirmation de l'adresse à l'inscription ─────────────────────
// Le nom de l'entreprise est saisi par l'inscrit lui-même : il est échappé,
// sinon n'importe qui pourrait glisser un lien de sa composition dans un email
// parti de noreply@washboard.fr vers l'adresse qu'il a tapée.
//
// Un CODE à recopier, pas un lien à cliquer : décidé par Ryan le 2026-10-11
// après avoir buté sur l'app Mail de l'iPhone qui ouvre tout lien dans Safari,
// jamais dans la PWA installée — avec un tiroir de cookies séparé de celui de
// l'app, la confirmation se faisait dans un contexte que la PWA ne voit
// jamais. Le code reste dans l'app qui l'a demandé, sur n'importe quel
// appareil.
export async function sendEmailConfirmation({ to, washerName, code }: {
  to: string; washerName: string | null; code: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const salutation = washerName ? `Bonjour <strong>${escapeHtml(washerName)}</strong>,` : 'Bonjour,'
  const codeEchappe = escapeHtml(code)

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: 'Confirme ton adresse email — WashBoard',
    html: page({
      titre: 'Confirme ton adresse email',
      entete: enteteWashBoard(origineImages()),
      contenu: `
${titre({ icone: iconeTitre(origineImages(), 'enveloppe'), texte: 'Confirme ton adresse email', sousTitre: 'Dernière étape avant d&apos;accéder à ton tableau de bord' })}
${paragraphe(salutation, { marge: '0 0 8px' })}
${paragraphe('Ton compte WashBoard est créé. Pour l&apos;activer, entre ce code dans l&apos;application :', { marge: '0 0 20px' })}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 20px;"><tr>
<td style="background:${COULEUR.papier};border:1px solid ${COULEUR.filet};border-radius:12px;padding:16px 26px;">
<span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${COULEUR.encre};font-family:${MONO};">${codeEchappe}</span>
</td>
</tr></table>
${paragraphe('Si tu n&apos;es pas à l&apos;origine de cette inscription, ignore cet email : le compte ne sera pas activé.', { ton: 'petit', marge: '0' })}`,
    }),
  })
}

// ── Email : annonce des 4 offres 2026 (diffusion unique à tous les laveurs) ─
//
// Le message ne doit rien promettre de faux à personne : un client historique
// (`grandfathered`) garde son accès complet quoi qu'il arrive, et un compte
// migré automatiquement a atterri au même tarif ou moins cher (voir
// 004_offres_2026.sql). Le texte reste donc volontairement rassurant et
// n'affirme jamais « votre offre a changé » — pour la plupart des lecteurs,
// rien n'a changé, il y a juste plus de choix qu'avant.
export async function sendNouvellesOffres({ to, washerName, appUrl }: {
  to: string; washerName: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'

  const offre = (couleur: string, nom: string, prix: string, detail: string) => ({
    libelle: `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${couleur};margin-right:8px;vertical-align:1px;"></span><strong style="color:${COULEUR.encre};">${nom}</strong> <span style="color:${COULEUR.encre};">— ${prix}</span>`,
    valeur: `<span style="font-weight:400;color:${COULEUR.gris};">${detail}</span>`,
  })

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Nouveau chez WashBoard : 4 offres, dont une gratuite`,
    html: page({
      titre: 'Quatre offres, une seule idée',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'etiquette'), texte: 'Quatre offres, une seule idée', sousTitre: 'Payer pour ce qu&apos;on utilise vraiment' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`WashBoard passe de 2 à 4 offres. Rien ne change pour vous aujourd&apos;hui :
votre accès actuel reste exactement le même, au même tarif. Ce qui change,
c&apos;est le choix disponible pour la suite.`, { marge: '0 0 16px' })}
${details([
  offre(PLAN_COULEURS.decouverte, 'Découverte', 'gratuite', `${BOOKING_QUOTA.decouverte} résa/mois`),
  offre(PLAN_COULEURS.starter, 'Starter', `${formatEuros(PLAN_PRICES.starter)}€/mois`, `${BOOKING_QUOTA.starter} résa/mois, page perso, CRM`),
  offre(PLAN_COULEURS.pro, 'Pro', `${formatEuros(PLAN_PRICES.pro)}€/mois`, 'résa illimitées, compta, avis Google'),
  offre(PLAN_COULEURS.business, 'Business', `${formatEuros(PLAN_PRICES.business)}€/mois`, '3 laveurs inclus, planning collectif'),
])}
${bouton('Voir le détail des offres →', `${url}/dashboard/abonnement`, 'accent', '0')}
${paragraphe('Aucune action requise · Vous restez sur votre offre actuelle si vous ne changez rien', { ton: 'petit', marge: '16px 0 0' })}`,
      pied: QUESTIONS,
    }),
  })
}

// ── Email : annonce de la nouvelle application (diffusion unique) ──────────
export async function sendAnnoncePwa({ to, washerName, appUrl }: {
  to: string; washerName: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `WashBoard évolue — venez essayer la nouvelle version`,
    html: page({
      titre: 'WashBoard évolue',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'telephone'), texte: 'WashBoard évolue', sousTitre: 'Une nouvelle version, pensée pour le téléphone' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Venez essayer la nouvelle version de WashBoard : une application que vous installez
sur votre téléphone, plus rapide et pensée pour une journée sur la route — agenda,
clients et chiffres repensés pour s&apos;utiliser d&apos;une main, entre deux rendez-vous.`, { marge: '0 0 20px' })}
${encadre(`Vos données sont les mêmes, rien à reconfigurer — c&apos;est le même compte, juste une
autre façon d&apos;y accéder.`, 'neutre')}
${bouton('Installer l&apos;application →', `${url}/dashboard/guide#guide-application`, 'accent', '0')}
${paragraphe('Le site reste disponible normalement si vous préférez', { ton: 'petit', marge: '16px 0 0' })}`,
      pied: QUESTIONS,
    }),
  })
}

// Annonce du nouveau design ordinateur (2026-10-12) — envoyée une seule fois à tous les laveurs
// par `/api/admin/annoncer-bureau-2026`. Même gabarit que `sendAnnoncePwa`.
export async function sendAnnonceBureau({ to, washerName, appUrl }: {
  to: string; washerName: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: 'WashBoard a un nouveau design sur ordinateur',
    html: page({
      titre: 'Un nouveau design sur ordinateur',
      entete: enteteWashBoard(url),
      contenu: `
${titre({ icone: iconeTitre(url, 'ordinateur'), texte: 'Un nouveau design sur ordinateur', sousTitre: 'Le même WashBoard que sur votre téléphone, sur grand écran' })}
${paragraphe(`Bonjour <strong>${escapeHtml(washerName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Le tableau de bord sur ordinateur a été entièrement refait, avec le même design que
l&apos;application sur votre téléphone. Ce qui change :`, { marge: '0 0 10px' })}
<ul style="margin:0 0 22px;padding-left:20px;font-family:${POLICE};font-size:15px;color:${COULEUR.encre};line-height:1.7;">
  <li style="margin-bottom:4px;">un menu à gauche : Aujourd&apos;hui, Agenda, Clients, Chiffres, Plus et vos Documents ;</li>
  <li style="margin-bottom:4px;">la liste et la fiche côte à côte : vous passez d&apos;un client ou d&apos;un rendez-vous à l&apos;autre sans rien fermer ;</li>
  <li style="margin-bottom:4px;">l&apos;agenda en vue semaine et mois ;</li>
  <li>une recherche et des filtres dans vos devis et factures.</li>
</ul>
${encadre(`Une visite guidée vous présente tout à votre prochaine connexion sur ordinateur.
Vos données sont les mêmes, rien à reconfigurer.`, 'neutre')}
${bouton('Découvrir le nouveau design →', `${url}/dashboard`, 'accent', '0')}
${paragraphe('Vous pourrez revoir la visite à tout moment : Plus › Réglages › Guide d&apos;utilisation', { ton: 'petit', marge: '16px 0 0' })}`,
      pied: QUESTIONS,
    }),
  })
}

/** Réservation annulée faute d'acompte réglé dans le délai choisi par le laveur
 *  (`api/cron/acomptes`, voir lib/acompte.ts). */
export async function sendAnnulationAcompte({ to, clientName, washerName, scheduledAt }: {
  to: string
  clientName: string
  washerName: string
  scheduledAt: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const date = new Date(scheduledAt)
  const jour = date.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' })
  const heure = date.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  return resend.emails.send({
    from: `${escapeHtml(washerName)} via WashBoard <noreply@washboard.fr>`,
    to,
    subject: `Réservation annulée : acompte non réglé`,
    html: page({
      titre: 'Réservation annulée',
      entete: enteteLaveur(escapeHtml(washerName)),
      contenu: `
${titre({ texte: 'Réservation annulée' })}
${paragraphe(`Bonjour <strong>${escapeHtml(clientName)}</strong>,`, { marge: '0 0 8px' })}
${paragraphe(`Votre réservation avec <strong>${escapeHtml(washerName)}</strong> du ${jour} à ${heure} a été annulée :
l’acompte n’a pas été réglé dans le délai indiqué au moment de réserver.`, { marge: '0 0 14px' })}
${paragraphe('Si vous souhaitez toujours ce lavage, vous pouvez réserver un nouveau créneau depuis la même page.', { marge: '0' })}`,
      pied: `Message envoyé via WashBoard pour le compte de ${escapeHtml(washerName)}`,
    }),
  })
}

/** « Votre tampon est arrivé » : envoyé quand le laveur marque la prestation terminée
 *  (`api/bookings/[id]` → `prevenirTampon`, option C retenue par Alexandre le 2026-10-18). Le
 *  lien ouvre la page carte avec `?tampon=1`, où le tampon frappe la carte sous ses yeux. La
 *  carte du message reprend la couleur choisie par le laveur, pas le bleu WashBoard. */
export async function sendTamponFidelite({ to, clientName, washerName, url, nouveaux = 1, tampons, requis, complete, phrase, couleur }: {
  to: string
  clientName: string | null
  washerName: string
  url: string
  /** Tampons apportés par cette prestation (un par véhicule si le laveur l'a choisi). */
  nouveaux?: number
  /** Tampons sur la carte, ce dernier compris. */
  tampons: number
  requis: number
  /** Ce tampon complète la carte : la récompense est débloquée. */
  complete: boolean
  phrase: string
  couleur: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const t = teintesCarte(couleur)
  const titreCarte = complete ? 'Votre carte est complète' : nouveaux > 1 ? `Vos ${nouveaux} tampons sont arrivés` : 'Votre tampon est arrivé'
  const ronds = Array.from({ length: requis }, (_, i) => {
    if (i >= tampons) return `<span style="display:inline-block;box-sizing:border-box;width:18px;height:18px;border-radius:9px;border:2px solid rgba(255,255,255,.42);margin:0 6px 6px 0;"></span>`
    const dernier = complete && i === requis - 1
    return `<span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${dernier ? '#E8B84A' : '#FFFFFF'};margin:0 6px 6px 0;"></span>`
  }).join('')

  return resend.emails.send({
    from: `${escapeHtml(washerName)} via WashBoard <noreply@washboard.fr>`,
    to,
    subject: complete ? `Votre carte de fidélité ${washerName} est complète` : nouveaux > 1 ? `Vos ${nouveaux} tampons ${washerName} sont arrivés` : `Votre tampon ${washerName} est arrivé`,
    html: page({
      titre: titreCarte,
      entete: enteteLaveur(escapeHtml(washerName)),
      contenu: `
${clientName ? paragraphe(`Bonjour ${escapeHtml(clientName)},`, { ton: 'gris', marge: '0 0 6px' }) : ''}
${titre({ texte: titreCarte })}
<div style="border-radius:18px;padding:22px 22px 16px;background-color:${t.base};background-image:linear-gradient(135deg,${t.clair} 0%,${t.base} 48%,${t.sombre} 100%);color:${t.texte};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td style="vertical-align:top;font-family:${POLICE};">
        <div style="font-size:19px;font-weight:800;line-height:1.1;color:${t.texte};">${escapeHtml(washerName)}</div>
        <div style="margin-top:4px;font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${t.texteDoux};">Carte de fidélité</div>
      </td>
      <td style="vertical-align:top;text-align:right;white-space:nowrap;font-family:${POLICE};font-size:26px;font-weight:800;line-height:1;color:${t.texte};">${tampons}/${requis}</td>
    </tr>
  </table>
  <div style="margin-top:18px;line-height:0;font-size:0;">${ronds}</div>
</div>
${paragraphe(escapeHtml(phrase), { marge: '20px 0 22px', style: 'line-height:1.5;' })}
${bouton(complete ? 'Voir ma carte' : nouveaux > 1 ? 'Voir mes tampons' : 'Voir mon tampon', escapeHtml(url), 'sombre', '0')}`,
      pied: `Message envoyé via WashBoard pour le compte de ${escapeHtml(washerName)}.`,
    }),
  })
}
