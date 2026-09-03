import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { normalizePhone, isPhoneExemptFromUniqueness } from '@/lib/phone'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export async function POST(request: NextRequest) {
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
  // C'est désormais la SEULE règle : la contrainte UNIQUE a été retirée de la
  // base le 2026-09-03, parce qu'elle ne pouvait pas connaître les numéros
  // exemptés (voir `isPhoneExemptFromUniqueness`) et refusait l'insertion même
  // quand le code l'autorisait. Reste théoriquement possible : deux
  // inscriptions au même instant avec le même numéro passeraient toutes deux
  // — sans conséquence autre que deux comptes à rapprocher à la main.
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
    const msg = isDuplicate ? 'Cet email est déjà utilisé' : authError.message
    // Un doublon est un cas normal (l'utilisateur a déjà un compte) ; le reste
    // est une vraie panne de création de compte, qui doit se voir.
    if (!isDuplicate) logger.error('signup.auth_create_failed', {}, authError)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const baseSlug = generateSlug(name.trim())
  const slug = `${baseSlug}-${randomUUID().slice(0, 4)}`

  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: washerError } = await supabase
    .from('washers')
    .insert({
      id: randomUUID(),
      user_id: authData.user.id,
      name: name.trim(),
      slug,
      phone: telephone,
      trial_ends_at: trialEndsAt,
      subscription_status: 'trial',
    })

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

  return NextResponse.json({ success: true })
}
