import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { normalizePhone, isPhoneExemptFromUniqueness } from '@/lib/phone'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { notifierEquipe } from '@/lib/push'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

// Route publique qui crée des comptes et des lignes en base. Sans plafond, une
// boucle pouvait ouvrir des centaines d'essais gratuits — coût Supabase, base
// polluée, et le contrôle d'unicité du téléphone à passer en revue à la main.
const INSCRIPTIONS_MAX = 5
const FENETRE_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  cleanupRateLimit()
  const ip = clientIp(request)
  if (!rateLimit(`signup-ip:${ip}`, INSCRIPTIONS_MAX, FENETRE_MS).ok) {
    logger.warn('auth.signup.rate_limited', { ip })
    return NextResponse.json(
      { error: 'Trop de tentatives d\'inscription. Réessayez dans une heure.' },
      { status: 429 },
    )
  }

  const { name, email, password, phone } = await request.json()

  if (!name?.trim() || !email?.includes('@') || !password || password.length < 6) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  // Le téléphone limite l'ouverture de plusieurs essais gratuits avec des
  // adresses email différentes. Il est stocké sous forme canonique (10
  // chiffres) : sans ça « 06 12 34 56 78 » et « +33612345678 » passeraient
  // pour deux numéros distincts et la vérification d'unicité ne servirait à
  // rien.
  const telephone = normalizePhone(phone)
  if (!telephone) {
    return NextResponse.json(
      { error: 'Numéro de téléphone invalide (format attendu : 06 12 34 56 78)' },
      { status: 400 },
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Unicité du numéro, vérifiée AVANT de créer l'utilisateur auth : sans cela on
  // créerait le compte auth puis on échouerait à l'insert, laissant un compte
  // fantôme si le rollback échoue lui aussi (cas vécu le 2026-08-28).
  //
  // C'est la SEULE règle : il n'y a pas de contrainte UNIQUE en base, et c'est
  // volontaire. Une contrainte SQL ne peut pas connaître les numéros exemptés
  // (voir `isPhoneExemptFromUniqueness`, alimenté par une variable
  // d'environnement) : elle refuserait l'insertion même quand le code
  // l'autorise.
  //
  // Reste théoriquement possible : deux inscriptions au même instant avec le
  // même numéro passeraient toutes les deux. Sans conséquence autre que deux
  // comptes à rapprocher à la main, et hors de portée au volume actuel.
  const { data: dejaPris, error: erreurRecherche } = await supabase
    .from('washers')
    .select('id')
    .eq('phone', telephone)
    .maybeSingle()

  if (erreurRecherche) {
    // Laisser passer en cas d'échec de lecture reviendrait à désactiver la
    // protection en silence, exactement le motif qu'on traque ailleurs.
    logger.error('signup.phone_check_failed', {}, erreurRecherche)
    return NextResponse.json(
      { error: 'Impossible de vérifier vos informations. Réessayez dans un instant.' },
      { status: 503 },
    )
  }

  if (dejaPris && !isPhoneExemptFromUniqueness(telephone)) {
    // Message volontairement identique en esprit à celui de l'email déjà
    // utilisé : on ne révèle pas à qui appartient le numéro.
    return NextResponse.json(
      { error: 'Ce numéro de téléphone est déjà associé à un compte' },
      { status: 400 },
    )
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (authError) {
    const raw = authError.message.toLowerCase()
    const isDuplicate = raw.includes('already') || (raw.includes('email') && raw.includes('exist'))
    // Hors doublon, le message de Supabase décrivait le rouage interne qui
    // avait cassé : il part dans les journaux, pas dans la réponse.
    const msg = isDuplicate
      ? 'Cet email est déjà utilisé'
      : "La création du compte a échoué. Réessayez dans quelques instants."
    // Un doublon est un cas normal (l'utilisateur a déjà un compte) ; le reste
    // est une vraie panne de création de compte, qui doit se voir.
    if (!isDuplicate) logger.error('signup.auth_create_failed', {}, authError)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const baseSlug = generateSlug(name.trim())
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Le lien public est formé du nom de l'entreprise et de quatre caractères
  // tirés au hasard. La collision est improbable — il faut le même nom ET le
  // même tirage — mais pas impossible, et `slug` est UNIQUE en base : elle se
  // solderait par un échec d'inscription devant un vrai prospect, sans qu'il
  // comprenne pourquoi. On retente simplement avec un autre suffixe.
  let washerError: { code?: string; message?: string } | null = null
  for (let essai = 0; essai < 3; essai++) {
    const { error } = await supabase
      .from('washers')
      .insert({
        id: randomUUID(),
        user_id: authData.user.id,
        name: name.trim(),
        slug: `${baseSlug}-${randomUUID().slice(0, 4)}`,
        phone: telephone,
        trial_ends_at: trialEndsAt,
        subscription_status: 'trial',
      })

    washerError = error
    if (!error || error.code !== '23505') break
    logger.warn('signup.slug_collision', { baseSlug, essai })
  }

  if (washerError) {
    // L'utilisateur auth existe déjà à ce stade : sans rollback réussi, son
    // email reste pris pour toujours alors qu'aucune fiche laveur n'existe —
    // il ne peut plus se réinscrire et rien ne le signale (cas vécu en prod le
    // 2026-08-28, compte fantôme découvert seulement parce qu'un test a échoué).
    logger.error('signup.washer_insert_failed', { userId: authData.user.id }, washerError)

    const { error: rollbackError } = await supabase.auth.admin.deleteUser(authData.user.id)
    if (rollbackError) {
      // Le rollback lui-même a échoué : le compte fantôme est créé, maintenant.
      // C'est la seule trace qui permettra de le retrouver et de le purger.
      logger.error('signup.rollback_failed', { userId: authData.user.id }, rollbackError)
    }

    return NextResponse.json({ error: 'Erreur lors de la création du profil' }, { status: 500 })
  }

  logger.info('signup.washer_created', { userId: authData.user.id })

  // Une inscription est l'événement le plus important du produit, et rien ne le
  // signalait : il fallait aller regarder la base pour s'en apercevoir. La
  // notification part vers les appareils de l'équipe uniquement — jamais vers
  // les laveurs (voir `notifierEquipe`).
  //
  // Attendue, pas lancée dans le vide : Vercel coupe la fonction dès la réponse
  // renvoyée, et un envoi non attendu n'aurait pas le temps de partir. La
  // fonction n'échoue jamais, l'inscription ne peut donc pas en pâtir.
  const finEssai = new Date(trialEndsAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long',
  })
  await notifierEquipe({
    title: '🎉 Nouveau client WashBoard',
    body: [
      `🏢 ${name.trim()}`,
      `📧 ${email.trim()}`,
      `⏳ Essai jusqu'au ${finEssai}`,
    ].join('\n'),
    url: '/dashboard',
    tag: `signup-${authData.user.id}`,
  })

  return NextResponse.json({ success: true })
}
