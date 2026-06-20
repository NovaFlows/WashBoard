import { Resend } from 'resend'

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

  return resend.emails.send({
    from: `${params.washerName} via WashBoard <noreply@washboard.fr>`,
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
  const vehicleLabel = params.vehicleType ? ` — ${params.vehicleType}` : ''

  return resend.emails.send({
    from: `${params.washerName} via WashBoard <noreply@washboard.fr>`,
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
