import { Resend } from 'resend'
import type { VehicleItem } from '@/types'

function formatVehicle(type?: string, count?: number): string | null {
  if (!type) return null
  const labels: Record<string, string> = {
    citadine: 'Citadine', citadine_2p: 'Citadine 2p', berline: 'Berline',
    SUV: 'SUV / 4x4', monospace: 'Monospace', utilitaire: 'Utilitaire',
  }
  const label = labels[type] ?? type
  return count && count > 1 ? `${label} ×${count}` : label
}

function vehiclesHtml(items: VehicleItem[], rightAlign = false): string {
  const align = rightAlign ? 'text-align:right;' : ''
  return items.map(v => {
    const label = formatVehicle(v.type, v.count) ?? v.type
    const mdls  = (v.models ?? []).filter(Boolean)
    const sub   = mdls.length ? `<br/><span style="font-size:13px;color:#1e40af;font-weight:700;">${mdls.join(' · ')}</span>` : ''
    return `<span style="display:block;${align}">${label}${sub}</span>`
  }).join('')
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
}

export async function sendBookingRequest(params: SendRequestParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const date         = new Date(params.scheduledAt)
  const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const ref           = params.bookingId.slice(0, 8).toUpperCase()
  const discount      = Number(params.smartDiscount ?? 0)
  const finalPrice    = params.isSmartSlot && discount > 0 ? Math.max(0, params.servicePrice - discount) : params.servicePrice
  const priceStr      = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const vehicleContent1 = params.vehiclesDetail?.length
    ? vehiclesHtml(params.vehiclesDetail, true)
    : (formatVehicle(params.vehicleType, params.vehicleCount) ?? null)
  const vehicleRow1 = vehicleContent1
    ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 16px;color:#64748b;vertical-align:top;">Véhicule(s)</td><td style="padding:10px 16px;font-weight:600;color:#0f172a;text-align:right;">${vehicleContent1}</td></tr>`
    : ''
  const addonsRow1 = params.selectedAddons?.length
    ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 16px;color:#64748b;">Options</td><td style="padding:10px 16px;font-weight:600;color:#0f172a;text-align:right;">${params.selectedAddons.map(a => a.label).join(' · ')}</td></tr>`
    : ''
  const notesRow1 = params.notes
    ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 16px;color:#64748b;vertical-align:top;">Notes</td><td style="padding:10px 16px;font-size:12px;color:#475569;line-height:1.5;font-style:italic;">${params.notes}</td></tr>`
    : ''

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Demande reçue — en attente de confirmation (Réf. ${ref})`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

    <!-- Header -->
    <div style="background:#f59e0b;padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;">Demande reçue ⏳</h1>
      <p style="margin:0;color:#fef3c7;font-size:13px;">En attente de confirmation par ${params.washerName}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 40px;">
      <p style="margin:0 0 6px;font-size:15px;color:#0f172a;">Bonjour <strong>${params.clientName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
        Votre demande de réservation a bien été reçue. <strong>${params.washerName}</strong> va la confirmer dans les plus brefs délais.
        Vous recevrez un email avec votre reçu dès que c&apos;est accepté.
      </p>

      <!-- Récapitulatif -->
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;font-size:13px;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Prestation</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;text-align:right;">${params.serviceName}</td>
        </tr>
        ${vehicleRow1}
        ${addonsRow1}
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Date</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;text-align:right;">${formattedDate}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Heure</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;text-align:right;">${time}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Adresse</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;text-align:right;">${params.address}</td>
        </tr>
        ${notesRow1}
        <tr>
          <td style="padding:10px 16px;color:#64748b;">Montant estimé</td>
          <td style="padding:10px 16px;font-weight:700;color:#0f172a;text-align:right;">${priceStr}€${params.isSmartSlot && discount > 0 ? ' ★' : ''} <span style="font-weight:400;color:#94a3b8;">(sur place)</span></td>
        </tr>
      </table>

      <!-- Référence -->
      <div style="margin-top:20px;padding:12px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
        <p style="margin:0;font-size:12px;color:#92400e;">Référence de votre demande : <strong style="font-family:'Courier New',monospace;">${ref}</strong></p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Ce message est un accusé de réception automatique. Votre reçu vous sera envoyé à la confirmation.</p>
    </div>
  </div>
</body>
</html>`.trim(),
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
  appUrl?: string
}

export async function sendBookingConfirmation(params: SendConfirmationParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const date = new Date(params.scheduledAt)
  const formattedDate = date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const ref       = params.bookingId.slice(0, 8).toUpperCase()
  const discount  = Number(params.smartDiscount ?? 0)
  const finalPrice = params.isSmartSlot && discount > 0
    ? Math.max(0, params.servicePrice - discount)
    : params.servicePrice
  const finalPriceStr = Number.isInteger(finalPrice) ? String(finalPrice) : finalPrice.toFixed(2)
  const basePriceStr  = Number.isInteger(params.servicePrice) ? String(params.servicePrice) : params.servicePrice.toFixed(2)

  const appUrl    = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const pdfUrl    = `${appUrl}/api/bookings/${params.bookingId}/pdf`
  const vehicleStr   = params.vehiclesDetail?.length
    ? params.vehiclesDetail.map(v => {
        const lbl  = formatVehicle(v.type, v.count) ?? v.type
        const mdls = (v.models ?? []).filter(Boolean)
        return mdls.length ? `${lbl} (${mdls.join(', ')})` : lbl
      }).join(', ')
    : (formatVehicle(params.vehicleType, params.vehicleCount) ?? '')
  const vehicleLabel = vehicleStr ? ` — ${vehicleStr}` : ''
  const notesBox2    = params.notes
    ? `<div style="margin:0 40px 20px;background:#fefce8;border-left:4px solid #fbbf24;padding:12px 16px;border-radius:0 6px 6px 0;">
        <p style="margin:0 0 2px;font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Notes du client</p>
        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;font-style:italic;">${params.notes}</p>
      </div>`
    : ''

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Reçu de réservation #${ref} — ${params.washerName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de réservation</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

    <!-- Barre supérieure -->
    <div style="background:#0f172a;padding:10px 32px;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#94a3b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Reçu de prestation de service</span>
      <span style="color:#475569;font-size:11px;font-family:'Courier New',monospace;font-weight:600;">Réf. ${ref}</span>
    </div>

    <!-- En-tête prestataire -->
    <div style="padding:28px 40px 20px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h1 style="margin:0 0 3px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${params.washerName}</h1>
        <p style="margin:0;color:#64748b;font-size:13px;">Prestataire de lavage automobile à domicile</p>
        ${params.washerPhone ? `<p style="margin:3px 0 0;color:#64748b;font-size:13px;">${params.washerPhone}</p>` : ''}
      </div>
      <div style="text-align:right;">
        <p style="margin:0 0 2px;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Date d'émission</p>
        <p style="margin:0;font-size:13px;color:#475569;font-weight:600;">${today}</p>
      </div>
    </div>

    <!-- Ligne séparatrice -->
    <div style="margin:0 40px;border-top:2px solid #e2e8f0;"></div>

    <!-- Blocs Prestataire / Client -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:20px 40px;width:50%;vertical-align:top;">
          <p style="margin:0 0 8px;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Prestataire</p>
          <p style="margin:0;font-size:14px;color:#0f172a;font-weight:700;">${params.washerName}</p>
          ${params.washerPhone ? `<p style="margin:3px 0 0;font-size:13px;color:#64748b;">${params.washerPhone}</p>` : ''}
        </td>
        <td style="padding:20px 40px;width:50%;vertical-align:top;border-left:1px solid #f1f5f9;">
          <p style="margin:0 0 8px;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Client</p>
          <p style="margin:0;font-size:14px;color:#0f172a;font-weight:700;">${params.clientName}</p>
          <p style="margin:3px 0 0;font-size:13px;color:#64748b;">${params.clientEmail}</p>
        </td>
      </tr>
    </table>

    <!-- Tableau de prestation -->
    <div style="margin:0 40px 24px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">

        <!-- En-tête tableau -->
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;border-bottom:1px solid #e2e8f0;">Désignation</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;border-bottom:1px solid #e2e8f0;white-space:nowrap;">Montant TTC</th>
          </tr>
        </thead>

        <tbody>
          <!-- Ligne prestation -->
          <tr>
            <td style="padding:16px;border-bottom:1px solid #f1f5f9;vertical-align:top;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">${params.serviceName}${vehicleLabel}</p>
              <p style="margin:0 0 2px;font-size:12px;color:#64748b;">${formattedDate} à ${time}</p>
              <p style="margin:0;font-size:12px;color:#64748b;">${params.address}</p>
              ${params.isSmartSlot && discount > 0 ? `<p style="margin:6px 0 0;font-size:11px;color:#d97706;font-weight:600;">★ Créneau optimisé (-${discount}€)</p>` : ''}
            </td>
            <td style="padding:16px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;white-space:nowrap;">
              ${params.isSmartSlot && discount > 0
                ? `<p style="margin:0 0 2px;font-size:12px;color:#94a3b8;text-decoration:line-through;">${basePriceStr}€</p>
                   <p style="margin:0;font-size:15px;font-weight:700;color:#d97706;">${finalPriceStr}€</p>`
                : `<p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${finalPriceStr}€</p>`
              }
            </td>
          </tr>

          <!-- TVA -->
          <tr style="background:#f8fafc;">
            <td style="padding:8px 16px;font-size:11px;color:#94a3b8;font-style:italic;">TVA non applicable — art. 293 B du CGI</td>
            <td style="padding:8px 16px;"></td>
          </tr>
        </tbody>

        <!-- Total -->
        <tfoot>
          <tr style="background:#0f172a;">
            <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#ffffff;">TOTAL À RÉGLER SUR PLACE</td>
            <td style="padding:14px 16px;text-align:right;font-size:18px;font-weight:800;color:#ffffff;white-space:nowrap;">${finalPriceStr}€</td>
          </tr>
        </tfoot>
      </table>

      <!-- Mode de règlement -->
      <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;text-align:right;">Mode de règlement : paiement comptant sur place</p>
    </div>

    ${notesBox2}

    <!-- Encart facture -->
    <div style="margin:0 40px 24px;background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 3px;font-size:12px;color:#1e40af;font-weight:700;">Justificatif de prestation — facture</p>
      <p style="margin:0;font-size:12px;color:#3b82f6;">Ce document fait office de reçu de prestation de service. Référence : <strong>${ref}</strong> · Émis le ${today}</p>
    </div>

    <!-- Bouton PDF -->
    <div style="padding:0 40px 28px;text-align:center;">
      <a href="${pdfUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">
        Télécharger la confirmation PDF
      </a>
    </div>

    <!-- Pied de page -->
    <div style="padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Ce reçu a été généré automatiquement par <strong>WashBoard</strong> · Réservation de lavage automobile à domicile</p>
    </div>

  </div>
</body>
</html>`.trim(),
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
    from: `${params.washerName} via WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Un message de ${params.washerName} 👋`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#1651E8;padding:28px 40px;">
      <p style="margin:0;color:#bfdbfe;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Message de votre laveur</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:800;">${params.washerName}</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#0f172a;line-height:1.7;white-space:pre-line;">${params.message}</p>
    </div>
    <div style="padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Message envoyé via <strong>WashBoard</strong> pour le compte de ${params.washerName}</p>
    </div>
  </div>
</body>
</html>`.trim(),
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

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Votre avis compte pour ${params.washerName} ⭐`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#2563eb;padding:28px 40px;text-align:center;">
      <h1 style="margin:0 0 6px;color:#ffffff;font-size:21px;font-weight:800;">Merci pour votre confiance !</h1>
      <p style="margin:0;color:#bfdbfe;font-size:13px;">Comment s'est passé votre lavage avec ${params.washerName} ?</p>
    </div>
    <div style="padding:32px 40px;text-align:center;">
      <p style="margin:0 0 8px;font-size:15px;color:#0f172a;">Bonjour <strong>${params.clientName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
        Votre véhicule est tout propre ? On espère que vous êtes satisfait·e !
        Un petit avis Google aiderait énormément <strong>${params.washerName}</strong> — ça prend moins d'une minute.
      </p>
      <div style="font-size:30px;letter-spacing:4px;margin-bottom:24px;">⭐⭐⭐⭐⭐</div>
      <a href="${params.reviewUrl}" target="_blank"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
        Laisser un avis Google
      </a>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Merci beaucoup pour votre soutien 🙏</p>
    </div>
    <div style="padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Message envoyé via <strong>WashBoard</strong> pour le compte de ${params.washerName}</p>
    </div>
  </div>
</body>
</html>`.trim(),
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

export async function sendWasherNotification(params: SendWasherNotificationParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const date          = new Date(params.scheduledAt)
  const formattedDate = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time          = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const ref           = params.bookingId.slice(0, 8).toUpperCase()
  const priceStr      = Number.isInteger(params.bookedPrice) ? String(params.bookedPrice) : params.bookedPrice.toFixed(2)
  const dashboardUrl  = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://washboard.fr'}/dashboard`
  const vehicleContent3 = params.vehiclesDetail?.length
    ? vehiclesHtml(params.vehiclesDetail)
    : (formatVehicle(params.vehicleType, params.vehicleCount) ?? null)
  const vehicleRow3 = vehicleContent3
    ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 16px;color:#64748b;vertical-align:top;">Véhicule(s)</td><td style="padding:10px 16px;font-weight:600;color:#0f172a;">${vehicleContent3}</td></tr>`
    : ''
  const addonsRow3 = params.selectedAddons?.length
    ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 16px;color:#64748b;">Options</td><td style="padding:10px 16px;font-weight:600;color:#0f172a;">${params.selectedAddons.map(a => a.label).join(' · ')}</td></tr>`
    : ''
  const notesBox3 = params.notes
    ? `<div style="margin-top:20px;background:#fefce8;border-left:4px solid #fbbf24;padding:14px 16px;border-radius:0 6px 6px 0;">
        <p style="margin:0 0 4px;font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Notes du client</p>
        <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;font-style:italic;">${params.notes}</p>
      </div>`
    : ''

  return resend.emails.send({
    from: `WashBoard <noreply@washboard.fr>`,
    to: params.to,
    subject: `Nouvelle réservation — ${params.clientName} (Réf. ${ref})`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#2563eb;padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;">Nouvelle réservation 🎉</h1>
      <p style="margin:0;color:#bfdbfe;font-size:13px;">Un client vient de faire une demande sur votre page WashBoard</p>
    </div>
    <div style="padding:28px 40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#0f172a;">Bonjour <strong>${params.washerName}</strong>,</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;font-size:13px;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Client</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;">${params.clientName}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Email</td>
          <td style="padding:10px 16px;font-weight:600;"><a href="mailto:${params.clientEmail}" style="color:#2563eb;">${params.clientEmail}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Téléphone</td>
          <td style="padding:10px 16px;font-weight:600;"><a href="tel:${params.clientPhone}" style="color:#2563eb;">${params.clientPhone}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Prestation</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;">${params.serviceName}</td>
        </tr>
        ${vehicleRow3}
        ${addonsRow3}
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Date</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;">${formattedDate} à ${time}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 16px;color:#64748b;">Adresse</td>
          <td style="padding:10px 16px;font-weight:600;color:#0f172a;">${params.address}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;color:#64748b;">Montant</td>
          <td style="padding:10px 16px;font-weight:700;color:#0f172a;">${priceStr}€</td>
        </tr>
      </table>
      ${notesBox3}
      <div style="margin-top:24px;text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;">
          Voir dans WashBoard
        </a>
      </div>
    </div>
    <div style="padding:16px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Réf. <strong>${ref}</strong> · WashBoard</p>
    </div>
  </div>
</body>
</html>`.trim(),
  })
}

// ── Email : rappel J-3 avant fin du trial ────────────────────────────────
export async function sendTrialReminder({ to, washerName, trialEndsAt, appUrl }: {
  to: string; washerName: string; trialEndsAt: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  const date = new Date(trialEndsAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre essai gratuit se termine dans 3 jours — WashBoard`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#f59e0b;padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;">Plus que 3 jours ⏳</h1>
      <p style="margin:0;color:#fef3c7;font-size:13px;">Votre essai gratuit WashBoard se termine bientôt</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Bonjour <strong>${washerName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
        Votre période d&apos;essai gratuit se termine le <strong>${date}</strong>.
        Pour continuer à utiliser WashBoard sans interruption, activez votre abonnement avant cette date.
      </p>
      <div style="background:#fefce8;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
          Après expiration, vous avez encore 30 jours pour régulariser avant que votre page de réservation soit suspendue.
        </p>
      </div>
      <div style="text-align:center;">
        <a href="${url}/dashboard/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Activer mon abonnement →
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Des questions ? Écrivez-nous à novaflows.pro@gmail.com</p>
    </div>
  </div>
</body>
</html>`.trim(),
  })
}

// ── Email : expiration du trial (J0) ─────────────────────────────────────
export async function sendTrialExpired({ to, washerName, appUrl }: {
  to: string; washerName: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre essai gratuit a expiré — WashBoard`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#ef4444;padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;">Essai expiré 🔴</h1>
      <p style="margin:0;color:#fecaca;font-size:13px;">Votre période d&apos;essai gratuit est terminée</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Bonjour <strong>${washerName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
        Votre essai gratuit WashBoard est arrivé à son terme. Votre dashboard reste accessible,
        mais votre page de réservation sera suspendue dans <strong>30 jours</strong> si vous n&apos;activez pas votre abonnement.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#b91c1c;font-weight:600;">
          Sans abonnement actif, vos clients ne pourront plus réserver en ligne dans 30 jours.
        </p>
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${url}/dashboard/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Activer mon abonnement — 49€/mois →
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">PayPal ou virement · Activation sous 24h · Sans engagement</p>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Des questions ? Écrivez-nous à novaflows.pro@gmail.com</p>
    </div>
  </div>
</body>
</html>`.trim(),
  })
}

// ── Email : rappel renouvellement abonnement J-3 ─────────────────────────
export async function sendSubReminder({ to, washerName, endsAt, appUrl }: {
  to: string; washerName: string; endsAt: string; appUrl?: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.washboard.fr'
  const date = new Date(endsAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to,
    subject: `Votre abonnement WashBoard se termine dans 3 jours`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#f59e0b;padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;">Renouvellement dans 3 jours ⏳</h1>
      <p style="margin:0;color:#fef3c7;font-size:13px;">Votre abonnement WashBoard arrive à échéance</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Bonjour <strong>${washerName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
        Votre abonnement WashBoard se termine le <strong>${date}</strong>.
        Pour continuer à recevoir des réservations sans interruption, renouvelez votre paiement avant cette date.
      </p>
      <div style="background:#fefce8;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
          Effectuez votre paiement de 49€ par PayPal ou virement — activation sous 24h ouvrées.
        </p>
      </div>
      <div style="text-align:center;">
        <a href="${url}/dashboard/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Renouveler mon abonnement →
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Des questions ? Écrivez-nous à novaflows.pro@gmail.com</p>
    </div>
  </div>
</body>
</html>`.trim(),
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
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#ef4444;padding:28px 40px;">
      <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:800;">Abonnement expiré 🔴</h1>
      <p style="margin:0;color:#fecaca;font-size:13px;">Votre abonnement WashBoard est arrivé à échéance</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Bonjour <strong>${washerName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
        Votre abonnement WashBoard est expiré. Votre page de réservation sera suspendue
        dans <strong>30 jours</strong> si vous ne renouvelez pas votre paiement.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#b91c1c;font-weight:600;">
          Sans renouvellement, vos clients ne pourront plus réserver en ligne dans 30 jours.
        </p>
      </div>
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${url}/dashboard/abonnement" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Renouveler mon abonnement — 49€/mois →
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">PayPal ou virement · Activation sous 24h · Sans engagement</p>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Des questions ? Écrivez-nous à novaflows.pro@gmail.com</p>
    </div>
  </div>
</body>
</html>`.trim(),
  })
}
