import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { logger } from '@/lib/logger'
import { trustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'

// Chaque appel envoie un vrai email depuis noreply@washboard.fr, sans qu'on
// soit connecté. Sans plafond, n'importe qui pouvait donc inonder la boîte d'un
// laveur en rejouant la requête, et brûler au passage le quota Resend du
// produit. Deux compteurs : l'un par appelant, l'autre par adresse visée — le
// second protège une victime ciblée depuis plusieurs adresses IP.
const IP_LIMIT       = 5
const EMAIL_LIMIT    = 3
const FENETRE_MS     = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  cleanupRateLimit()
  const cible = email.trim().toLowerCase()
  const trop = !rateLimit(`reset-ip:${clientIp(req)}`, IP_LIMIT, FENETRE_MS).ok
            || !rateLimit(`reset-mail:${cible}`, EMAIL_LIMIT, FENETRE_MS).ok
  if (trop) {
    logger.warn('auth.reset_password.rate_limited', { ip: clientIp(req) })
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans quelques minutes.' },
      { status: 429 },
    )
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Origine du lien de réinitialisation. L'en-tête `Origin` n'est plus repris
  // tel quel : il est confronté aux origines connues du site (voir appOrigin).
  // Sans ce filtre, une requête portant `Origin: https://attaquant.tld` faisait
  // partir depuis noreply@washboard.fr un email dont le lien livrait le jeton
  // de récupération à l'attaquant. Signalé par un audit externe le 2026-09-05.
  const origin = trustedOrigin(req.headers.get('origin'))

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim(),
    options: {
      redirectTo: `${origin}/reset-password`,
    },
  })

  if (error || !data?.properties?.action_link) {
    logger.error('auth.reset_password.generate_link_failed', {}, error)
    // Le message brut de Supabase n'est plus renvoyé : il décrivait le rouage
    // interne qui avait cassé. Le détail part dans les journaux, le visiteur
    // reçoit une phrase compréhensible.
    const introuvable = error?.message?.toLowerCase().includes('not found') || error?.status === 404
    return NextResponse.json(
      { error: introuvable
          ? 'Aucun compte trouvé pour cet email.'
          : "L'envoi a échoué. Réessayez dans quelques instants." },
      { status: 400 },
    )
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
