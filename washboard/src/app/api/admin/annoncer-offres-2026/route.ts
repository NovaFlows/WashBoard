import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendNouvellesOffres } from '@/lib/email'
import { notifierLaveur, notifierEquipe } from '@/lib/push'
import { logger } from '@/lib/logger'
import { COMPTES_INTERNES_EXCLUS_DIFFUSION } from '@/lib/plan'

// Diffusion UNIQUE de l'annonce des 4 offres 2026 (email + notification push)
// à tous les laveurs réels. Ce n'est volontairement PAS un cron : rien ne la
// relance, personne ne doit la recevoir deux fois. Elle vit ici plutôt que
// dans un script jetable pour réutiliser les vrais templates email/push de
// la production — les mêmes que ceux relus, testés et déployés, pas une
// copie qui finirait par diverger.
//
// Protégée par CRON_SECRET (le même secret que les crons existants, pour ne
// pas ajouter une variable d'environnement de plus à retenir).
//
// `?confirmer=1` déclenche l'envoi réel ; sans lui, la route ne fait qu'un
// aperçu — liste des destinataires, aucun envoi — pour se relire avant
// d'écrire à de vrais clients.
//
// `?test=<email>` envoie UNIQUEMENT ce mail-là (le vrai template, pas une
// copie) et s'arrête là — ni la liste des laveurs, ni la notification
// d'équipe, ni le compteur ne sont touchés. Sert à voir le rendu réel avant
// de déclencher la diffusion à tout le monde.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const test = request.nextUrl.searchParams.get('test')
  if (test) {
    await sendNouvellesOffres({ to: test, washerName: 'NovaFlows' })
    return NextResponse.json({ test: true, envoyeA: test })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const confirmer = request.nextUrl.searchParams.get('confirmer') === '1'

  // `is_preview` écarte les fiches de démonstration (aucun compte réel
  // derrière, `user_id` est d'ailleurs toujours vide pour elles) ;
  // `account_status` écarte un compte en cours de suppression (voir
  // AutooNettoyage, dont l'accès a été coupé le 2026-09-26 — lui écrire une
  // annonce commerciale n'aurait aucun sens).
  const { data: washers, error } = await admin
    .from('washers')
    .select('id, user_id, name, slug')
    .eq('is_preview', false)
    .eq('account_status', 'active')
    .not('user_id', 'is', null)

  if (error) {
    logger.error('admin.annoncer_offres.read_failed', {}, error)
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
      logger.warn('admin.annoncer_offres.sans_email', { washerId: washer.id })
    } else {
      try {
        await sendNouvellesOffres({ to: user.email, washerName: washer.name })
        counts.email++
      } catch (e) {
        counts.echecsEmail++
        logger.error('admin.annoncer_offres.email_failed', { washerId: washer.id }, e)
      }
    }

    // En plus de l'email, jamais à sa place : `notifierLaveur` ne lève
    // jamais (voir lib/push.ts) — un raté ici ne doit pas faire échouer le
    // reste de la diffusion.
    await notifierLaveur(washer.id, {
      title: '🚗 Nouveau : 4 offres WashBoard',
      body: 'Découverte, Starter, Pro, Business — votre accès actuel ne change pas.',
      url: '/dashboard/abonnement',
      tag: 'annonce-offres-2026',
    })
    counts.push++
  }

  logger.info('admin.annoncer_offres.termine', { total: destinataires.length, ...counts })
  await notifierEquipe({
    title: 'Annonce des 4 offres envoyée',
    body: `${counts.email} emails envoyés, ${counts.echecsEmail} échecs, ${counts.sansEmail} sans email, ${destinataires.length} laveurs au total.`,
  })

  return NextResponse.json({ apercu: false, total: destinataires.length, ...counts })
}
