import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { selectionnerFantomes } from '@/lib/ghostAccounts'

// Purge définitive des comptes dont la suppression a été demandée il y a plus
// de 30 jours. Appelée quotidiennement par Vercel Cron (voir vercel.json).
// Vercel ajoute automatiquement l'en-tête « Authorization: Bearer <CRON_SECRET> »
// si la variable d'environnement CRON_SECRET est définie.
//
// Fait aussi office de purge RGPD pour `booking_funnel_events` (recommandation
// CNIL : 13 mois max pour des données de mesure d'audience). Rattachée ici
// plutôt qu'à un cron dédié : même nature (purge programmée, service-role,
// déjà planifiée quotidiennement dans vercel.json), et créer une seconde
// entrée de cron pour quelques lignes de purge serait disproportionné.
const GRACE_DAYS = 30
const FUNNEL_EVENTS_RETENTION_MONTHS = 13

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Purge des événements d'entonnoir de plus de 13 mois, indépendamment du
  // statut des comptes : cette rétention s'applique à tous les laveurs, pas
  // seulement à ceux en cours de suppression.
  const funnelCutoff = new Date()
  funnelCutoff.setMonth(funnelCutoff.getMonth() - FUNNEL_EVENTS_RETENTION_MONTHS)
  const { error: funnelPurgeError, count: funnelPurged } = await admin
    .from('booking_funnel_events')
    .delete({ count: 'exact' })
    .lt('created_at', funnelCutoff.toISOString())

  if (funnelPurgeError) {
    logger.error('purge.funnel_events.delete_failed', {}, funnelPurgeError)
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: toPurge, error } = await admin
    .from('washers')
    .select('id, user_id, logo_url')
    .eq('account_status', 'pending_deletion')
    .lt('deletion_scheduled_at', cutoff)

  if (error) return errorResponse('cron.purge-accounts.get.db', error)

  let purged = 0
  let failed = 0
  for (const w of toPurge ?? []) {
    // 1. Dépenses (au cas où elles ne se cascadent pas via le washer).
    //
    // L'échec était avalé : le service_role n'avait pas le droit de supprimer
    // ces tables (42501), donc les données de dépenses d'un compte supprimé
    // pouvaient survivre à la purge RGPD sans que personne ne le sache.
    // On saute ce laveur plutôt que de supprimer son compte auth : sans le
    // washer, ces lignes deviendraient orphelines et non rattachables. La purge
    // reessaiera au prochain passage.
    const depenses = await Promise.all([
      admin.from('washer_expenses').delete().eq('washer_id', w.id),
      admin.from('washer_recurring_expenses').delete().eq('washer_id', w.id),
    ])
    const echec = depenses.find(r => r.error)
    if (echec?.error) {
      logger.error('purge.expenses.delete_failed', { washerId: w.id }, echec.error)
      failed++
      continue
    }

    // 2. Logo dans le storage (best-effort)
    if (w.logo_url) {
      try {
        const m = w.logo_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
        if (m) await admin.storage.from(m[1]).remove([decodeURIComponent(m[2])])
      } catch { /* non bloquant */ }
    }

    // 3. Utilisateur auth → cascade sur washers + services/bookings/dispos/catégories
    if (w.user_id) {
      const { error: delErr } = await admin.auth.admin.deleteUser(w.user_id)
      if (delErr) {
        logger.error('purge.delete_user_failed', { washerId: w.id, userId: w.user_id }, delErr)
        failed++
        continue
      }
    } else {
      await admin.from('washers').delete().eq('id', w.id)
    }
    purged++
  }

  // ── Comptes fantômes ─────────────────────────────────────────────
  //
  // Un utilisateur d'authentification sans fiche laveur ne sert à rien, mais
  // bloque son adresse email à vie : la personne ne peut plus se réinscrire, et
  // rien ne le signale. L'inscription tente déjà d'annuler la création quand
  // l'insertion de la fiche échoue, mais cette annulation peut échouer à son
  // tour (réseau coupé, processus interrompu) — et personne ne repasse derrière.
  // Trois de ces comptes traînaient en production le 2026-09-03, dont un qui
  // empêchéait une vraie réinscription.
  //
  // Le délai de 24 h est essentiel : sans lui, on supprimerait le compte d'un
  // laveur en train de s'inscrire, entre la création de l'utilisateur et
  // l'insertion de sa fiche.
  const AGE_MIN_HEURES = 24
  let ghostsPurged = 0
  let ghostsFailed = 0

  try {
    // Les deux listes sont PAGINÉES, et c'est vital.
    //
    // Sans cela, un compte absent d'une page tronquée passait pour un fantôme
    // et était DÉFINITIVEMENT supprimé, avec ses réservations en cascade.
    // Invisible aujourd'hui (7 comptes), catastrophique au premier millier :
    // PostgREST plafonne à 1000 lignes SANS erreur, et l'API d'authentification
    // pagine elle aussi. Signalé par un audit externe le 2026-09-05.
    const utilisateurs: { id: string; created_at: string }[] = []
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      utilisateurs.push(...data.users.map(u => ({ id: u.id, created_at: u.created_at })))
      if (data.users.length < 200) break
    }

    const rattaches: string[] = []
    for (let debut = 0; ; debut += 1000) {
      const { data, error } = await admin
        .from('washers').select('user_id').range(debut, debut + 999)
      if (error) throw error
      rattaches.push(...(data ?? []).map(w => w.user_id).filter(Boolean))
      if (!data || data.length < 1000) break
    }

    // La sélection vit dans `lib/ghostAccounts` : elle décide de suppressions
    // définitives et mérite d'être vérifiable sans base de données.
    // Les erreurs de lecture ont déjà été relevées plus haut : sans cela une
    // liste vide ferait passer TOUS les utilisateurs pour des fantômes.
    const aSupprimer = selectionnerFantomes(
      utilisateurs,
      rattaches,
      new Date(),
      AGE_MIN_HEURES,
    )

    for (const id of aSupprimer) {
      const u = { id, created_at: utilisateurs.find(x => x.id === id)?.created_at }
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) {
        logger.error('purge.ghost.delete_failed', { userId: u.id }, delErr)
        ghostsFailed++
      } else {
        logger.info('purge.ghost.deleted', { userId: u.id, createdAt: u.created_at })
        ghostsPurged++
      }
    }
  } catch (e) {
    logger.error('purge.ghost.scan_failed', {}, e)
    ghostsFailed++
  }

  return NextResponse.json({
    ok: failed === 0 && ghostsFailed === 0 && !funnelPurgeError,
    purged,
    failed,
    ghostsPurged,
    ghostsFailed,
    funnelEventsPurged: funnelPurged ?? 0,
  })
}
