import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendAnnoncePwa } from '@/lib/email'
import { notifierLaveur, notifierEquipe } from '@/lib/push'
import { logger } from '@/lib/logger'

// Diffusion UNIQUE de l'annonce de la nouvelle application (email +
// notification push) à tous les laveurs réels — même principe que
// annoncer-offres-2026 : pas un cron, rien ne la relance, personne ne doit la
// recevoir deux fois.
//
// Protégée par CRON_SECRET.
//
// `?confirmer=1` déclenche l'envoi réel ; sans lui, aperçu seul (liste des
// destinataires, aucun envoi).
//
// `?test=<email>` envoie le vrai email ET la vraie notification push à CE
// laveur précis (retrouvé par son adresse), sans toucher aux autres ni à la
// notification d'équipe — pour voir le rendu réel avant de déclencher la
// diffusion à tout le monde.
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
    // Un seul email est à retrouver : une page suffit très largement (même
    // limite que notifierEquipe dans lib/push.ts).
    const { data: comptes, error: errComptes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (errComptes) {
      logger.error('admin.annoncer_pwa.test.users_read_failed', {}, errComptes)
      return NextResponse.json({ error: 'Lecture des comptes impossible' }, { status: 500 })
    }
    const utilisateur = comptes.users.find(u => u.email?.toLowerCase() === test.toLowerCase())
    if (!utilisateur) return NextResponse.json({ error: `Aucun compte avec l'email ${test}` }, { status: 404 })

    const { data: washer, error: errWasher } = await admin
      .from('washers').select('id, name').eq('user_id', utilisateur.id).maybeSingle()
    if (errWasher || !washer) {
      return NextResponse.json({ error: `Aucune fiche laveur pour ${test}` }, { status: 404 })
    }

    await sendAnnoncePwa({ to: test, washerName: washer.name })
    await notifierLaveur(washer.id, {
      title: '🚀 WashBoard évolue',
      body: 'Venez essayer la nouvelle version de l\'application.',
      url: '/dashboard/guide#guide-application',
      tag: 'annonce-pwa-2026',
    })
    return NextResponse.json({ test: true, envoyeA: test, washer: washer.name })
  }

  const confirmer = request.nextUrl.searchParams.get('confirmer') === '1'

  // Même filtre que pour l'annonce des 4 offres : fiches de démonstration et
  // compte en cours de suppression écartés.
  const { data: washers, error } = await admin
    .from('washers')
    .select('id, user_id, name, slug')
    .eq('is_preview', false)
    .eq('account_status', 'active')
    .not('user_id', 'is', null)

  if (error) {
    logger.error('admin.annoncer_pwa.read_failed', {}, error)
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 })
  }

  // Comptes internes (équipe, comptes de test) — liste à la main, comme pour
  // COMPTES_TEST_RETOUR_GRATUIT dans lib/plan.ts.
  const SLUGS_EXCLUS = ['kookiclean-1f09', 'test-config-15d2']
  const destinataires = (washers ?? []).filter(w => !SLUGS_EXCLUS.includes(w.slug))

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
      logger.warn('admin.annoncer_pwa.sans_email', { washerId: washer.id })
    } else {
      try {
        await sendAnnoncePwa({ to: user.email, washerName: washer.name })
        counts.email++
      } catch (e) {
        counts.echecsEmail++
        logger.error('admin.annoncer_pwa.email_failed', { washerId: washer.id }, e)
      }
    }

    await notifierLaveur(washer.id, {
      title: '🚀 WashBoard évolue',
      body: 'Venez essayer la nouvelle version de l\'application.',
      url: '/dashboard/guide#guide-application',
      tag: 'annonce-pwa-2026',
    })
    counts.push++
  }

  logger.info('admin.annoncer_pwa.termine', { total: destinataires.length, ...counts })
  await notifierEquipe({
    title: 'Annonce de la nouvelle application envoyée',
    body: `${counts.email} emails envoyés, ${counts.echecsEmail} échecs, ${counts.sansEmail} sans email, ${destinataires.length} laveurs au total.`,
  })

  return NextResponse.json({ apercu: false, total: destinataires.length, ...counts })
}
