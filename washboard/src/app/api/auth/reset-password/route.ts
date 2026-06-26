import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim(),
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://washboard.fr'}/reset-password`,
    },
  })

  if (error || !data?.properties?.action_link) {
    console.error('[reset-password] generateLink error:', error)
    const msg = error?.message?.toLowerCase().includes('not found') || error?.status === 404
      ? 'Aucun compte trouvé pour cet email.'
      : `Erreur génération du lien : ${error?.message ?? 'inconnue'}`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const resetLink = data.properties.action_link
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: 'WashBoard <noreply@washboard.fr>',
    to: email.trim(),
    subject: 'Réinitialisation de votre mot de passe WashBoard',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:#0f172a;padding:28px 40px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;">WashBoard</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Réinitialisation de mot de passe</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Bonjour,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
        Vous avez demandé à réinitialiser votre mot de passe WashBoard.<br>
        Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
        Ce lien expire dans 1 heure.<br>
        Si vous n'avez pas fait cette demande, ignorez cet email.
      </p>
    </div>
  </div>
</body>
</html>`.trim(),
  })

  return NextResponse.json({ success: true })
}
