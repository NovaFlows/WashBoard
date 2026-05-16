import { Resend } from 'resend'

type SendConfirmationParams = {
  to: string
  clientName: string
  washerName: string
  serviceName: string
  servicePrice: number
  address: string
  scheduledAt: string
  bookingId: string
}

export async function sendBookingConfirmation(params: SendConfirmationParams) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const date = new Date(params.scheduledAt)
  const formatted = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return resend.emails.send({
    from: 'WashBoard <onboarding@resend.dev>',
    to: params.to,
    subject: `Confirmation de votre réservation — ${params.washerName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#2563eb;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Réservation confirmée ✓</h1>
      <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Référence : ${params.bookingId.slice(0, 8).toUpperCase()}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="margin:0 0 24px;color:#374151;font-size:16px;">Bonjour <strong>${params.clientName}</strong>,</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;">Votre réservation auprès de <strong>${params.washerName}</strong> est bien enregistrée.</p>

      <!-- Details card -->
      <div style="background:#f3f4f6;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;">Prestation</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${params.serviceName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Prix</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${params.servicePrice}€ (paiement sur place)</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Date</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${formatted}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Heure</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${time}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Adresse</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${params.address}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
        Le laveur se rendra directement à votre adresse. Aucun paiement en ligne requis.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">WashBoard — "Tu laves des voitures. On gère le reste."</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  })
}
