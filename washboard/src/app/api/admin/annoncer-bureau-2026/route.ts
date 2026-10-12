import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendAnnonceBureau } from '@/lib/email'
import { notifierLaveur, notifierEquipe } from '@/lib/push'
import { logger } from '@/lib/logger'
import { COMPTES_INTERNES_EXCLUS_DIFFUSION } from '@/lib/plan'

// Diffusion UNIQUE de l'annonce du nouveau design ordinateur (email + notification push) à
// tous les laveurs réels (Alexandre, 2026-10-12). Même principe que annoncer-pwa-2026 : pas
// un cron, rien ne la relance, personne ne doit la recevoir deux fois.
//
// Protégée par CRON_SECRET.
//
// Sans paramètre : aperçu seul (liste des destinataires, AUCUN envoi).
// `?test=<email>` : le vrai email ET la vraie notification à CE laveur seulement.
// `?confirmer=1` : l'envoi réel à tous.

const NOTIFICATION = {
  title: '💻 Nouveau design sur ordinateur',
  body: 'WashBoard a fait peau neuve sur ordinateur. Une visite guidée vous attend à votre prochaine connexion.',
  url: '/dashboard',
  tag: 'annonce-bureau-2026',
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const test = request.nextUrl.searchParams.get('test')
  if (test) {
    const { data: comptes, error: errComptes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (errComptes) {
      logger.error('admin.annoncer_bureau.test.users_read_failed', {}, errComptes)
      return NextResponse.json({ error: 'Lecture des comptes impossible' }, { status: 500 })
    }
    const utilisateur = comptes.users.find(u => u.email?.toLowerCase() === test.toLowerCase())
    if (!utilisateur) return NextResponse.json({ error: `Aucun compte avec l'email ${test}` }, { status: 404 })

    const { data: washer, error: errWasher } = await admin
      .from('washers').select('id, name').eq('user_id', utilisateur.id).maybeSingle()
    if (errWasher || !washer) {
      return NextResponse.json({ error: `Aucune fiche laveur pour ${test}` }, { status: 404 })
    }

    await sendAnnonceBureau({ to: test, washerName: washer.name })
    await notifierLaveur(washer.id, NOTIFICATION)
    return NextResponse.json({ test: true, envoyeA: test, washer: washer.name })
  }

  const confirmer = request.nextUrl.searchParams.get('confirmer') === '1'

  // Même filtre que les annonces précédentes : fiches de démonstration, comptes en cours de
  // suppression et comptes internes de l'équipe écartés.
  const { data: washers, error } = await admin
    .from('washers')
    .select('id, user_id, name, slug')
    .eq('is_preview', false)
    .eq('account_status', 'active')
    .not('user_id', 'is', null)

  if (error) {
    logger.error('admin.annoncer_bureau.read_failed', {}, error)
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 })
  }

  const destinataires = (washers ?? []).filter(w => !COMPTES_INTERNES_EXCLUS_DIFFUSION.includes(w.slug))

  if (!confirmer) {
    return NextResponse.json({
      apercu: true,
      total: destinataires.length,
      laveurs: destinataires.map(w => ({ name: w.name, slug: w.slug })),
    })
  }

  const counts = { email: 0, echecsEmail: 0, sansEmail: 0, push: 0 }

  for (const washer of destinataires) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) {
      counts.sansEmail++
      logger.warn('admin.annoncer_bureau.sans_email', { washerId: washer.id })
    } else {
      try {
        await sendAnnonceBureau({ to: user.email, washerName: washer.name })
        counts.email++
      } catch (e) {
        counts.echecsEmail++
        logger.error('admin.annoncer_bureau.email_failed', { washerId: washer.id }, e)
      }
    }

    await notifierLaveur(washer.id, NOTIFICATION)
    counts.push++
  }

  logger.info('admin.annoncer_bureau.termine', { total: destinataires.length, ...counts })
  await notifierEquipe({
    title: 'Annonce du design ordinateur envoyée',
    body: `${counts.email} emails envoyés, ${counts.echecsEmail} échecs, ${counts.sansEmail} sans email, ${destinataires.length} laveurs au total.`,
  })

  return NextResponse.json({ apercu: false, total: destinataires.length, ...counts })
}
