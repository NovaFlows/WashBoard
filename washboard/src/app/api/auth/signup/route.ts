import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { normalizePhone, isPhoneExemptFromUniqueness } from '@/lib/phone'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { trustedOrigin } from '@/lib/appOrigin'
import { envoyerLienConfirmation } from '@/lib/confirmationEmail'
import { PLAN_ESSAI } from '@/lib/plan'
import { generateSlug } from '@/lib/slug'

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

  const { name, email, password, phone, cgv_acceptees } = await request.json()

  if (!name?.trim() || !email?.includes('@') || !password || password.length < 6) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  // Le formulaire ne permet pas de valider sans cocher la case, mais la route
  // reste appelable directement — sans ce contrôle, un appel direct créerait
  // un compte sans trace d'acceptation, exactement le trou que ce verrou
  // ferme. Une inscription sans preuve d'acceptation vaut moins que pas
  // d'inscription du tout en cas de litige.
  if (cgv_acceptees !== true) {
    return NextResponse.json({ error: 'Vous devez accepter les CGV pour créer un compte' }, { status: 400 })
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
  // L'exemption est évaluée AVANT la requête, et pas seulement après.
  //
  // Sinon : dès qu'un deuxième compte portait le numéro exempté, `maybeSingle()`
  // renvoyait `PGRST116` (« Results contain 2 rows, requires 1 row »), la route
  // y voyait une panne de lecture et refusait l'inscription avec « Impossible
  // de vérifier vos informations » — exactement à la personne que l'exemption
  // devait servir. Constaté le 2026-09-06, deux fiches portaient déjà ce numéro.
  if (!isPhoneExemptFromUniqueness(telephone)) {
    // `limit(1)` plutôt que `maybeSingle()` : si des doublons existent déjà en
    // base, on veut simplement le constater. Les transformer en erreur de
    // lecture ferait refuser une inscription légitime pour un défaut de données
    // qui ne concerne pas le nouvel inscrit.
    const { data: dejaPris, error: erreurRecherche } = await supabase
      .from('washers')
      .select('id')
      .eq('phone', telephone)
      // Une page « proposition » porte le numéro du prospect qu'on démarche :
      // c'est ainsi qu'on la construit avant de l'appeler. Sans ce filtre, le
      // jour où il s'inscrit — souvent pendant le rendez-vous —, son propre
      // numéro lui était refusé comme « déjà associé à un compte » (URHUS AUTO,
      // 2026-09-11). `not is true` plutôt que `eq false` : une fiche où la
      // colonne serait NULL reste comptée, la protection des vrais comptes ne
      // se desserre pas.
      .not('is_preview', 'is', true)
      .limit(1)

    if (erreurRecherche) {
      // Laisser passer en cas d'échec de lecture reviendrait à désactiver la
      // protection en silence, exactement le motif qu'on traque ailleurs.
      logger.error('signup.phone_check_failed', {}, erreurRecherche)
      return NextResponse.json(
        { error: 'Impossible de vérifier vos informations. Réessayez dans un instant.' },
        { status: 503 },
      )
    }

    if (dejaPris?.length) {
      // Message volontairement identique en esprit à celui de l'email déjà
      // utilisé : on ne révèle pas à qui appartient le numéro.
      return NextResponse.json(
        { error: 'Ce numéro de téléphone est déjà associé à un compte' },
        { status: 400 },
      )
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: false,
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
  // Date ET adresse IP de l'acceptation des CGV, posées au moment précis de
  // l'inscription — pas recalculées plus tard, qui prouverait seulement que
  // la case EST cochée aujourd'hui, pas qu'elle l'était à l'inscription.
  const cgvAccepteesLe = new Date().toISOString()

  // Le lien public est formé du nom de l'entreprise et de quatre caractères
  // tirés au hasard. La collision est improbable — il faut le même nom ET le
  // même tirage — mais pas impossible, et `slug` est UNIQUE en base : elle se
  // solderait par un échec d'inscription devant un vrai prospect, sans qu'il
  // comprenne pourquoi. On retente simplement avec un autre suffixe.
  let washerError: { code?: string; message?: string } | null = null
  for (let essai = 0; essai < 3; essai++) {
    const id = randomUUID()
    const { error } = await supabase
      .from('washers')
      .insert({
        id,
        user_id: authData.user.id,
        name: name.trim(),
        slug: `${baseSlug}-${randomUUID().slice(0, 4)}`,
        phone: telephone,
        trial_ends_at: trialEndsAt,
        subscription_status: 'trial',
        // Pendant l'essai, le laveur a le produit complet : c'est ce qu'on lui
        // vend, et c'est ce qu'il avait avant l'arrivée de l'offre gratuite.
        // Écrit ici plutôt que laissé à la valeur par défaut de la colonne :
        // cette valeur par défaut a changé avec la grille 2026, et un compte
        // d'essai bridé à 5 réservations n'aurait plus rien d'un essai.
        plan: PLAN_ESSAI,
        cgv_acceptees_le: cgvAccepteesLe,
        cgv_acceptees_ip: ip,
      })

    washerError = error
    if (!error) break
    if (error.code !== '23505') break
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

  // La reprise de l'aperçu prospect et la notification de l'équipe attendent
  // la confirmation de l'email (voir `app/auth/confirm/route.ts`) : avant, le
  // compte peut encore être supprimé par « recommencer l'inscription », et une
  // page déjà reprise partirait avec lui.
  //
  // Un envoi raté ne fait pas échouer l'inscription : le compte existe, et
  // /verifier-email propose de renvoyer le lien.
  await envoyerLienConfirmation(supabase, {
    userId: authData.user.id,
    email: email.trim(),
    washerName: name.trim(),
    origin: trustedOrigin(request.headers.get('origin')),
  })

  return NextResponse.json({ success: true })
}
