import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron, parseTestMode, createAdminClient } from '@/lib/cronRequest'
import { notifierLaveur } from '@/lib/push'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { journeeParis, rendezVousNonTermines, messageRappel } from '@/lib/rappelTerminer'
import { logger } from '@/lib/logger'

// Rappel du soir : notification aux laveurs qui avaient des rendez-vous
// aujourd'hui et ne les ont pas tous marqués « Terminé » — sans quoi leurs
// factures ne sont pas émises et leur compta n'est pas à jour.
//
// Planification : cron-job.org, tous les jours à 22 h, FUSEAU Europe/Paris
// (et non UTC, sinon le rappel glisserait d'une heure au changement d'heure).
// Mode test : ?test=1&washer=<id> — ne notifie que ce laveur.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const test = parseTestMode(request)
  if ('error' in test) return NextResponse.json({ error: test.error }, { status: 400 })

  const admin = createAdminClient()
  const { jour, debut, fin } = journeeParis(new Date())

  const { data: reservations, error } = await toutesLesLignes<{ id: string; washer_id: string; status: string }>(
    (d, f) => {
      const base = admin
        .from('bookings')
        .select('id, washer_id, status')
        .gte('scheduled_at', debut)
        .lt('scheduled_at', fin)
        .in('status', ['pending', 'confirmed'])
      return (test.enabled ? base.eq('washer_id', test.washerId) : base).order('id').range(d, f)
    },
  )
  if (error) {
    logger.error('cron.rappel_terminer.read_failed', { jour }, error)
    return NextResponse.json({ ok: false, error: 'Lecture des rendez-vous impossible' }, { status: 500 })
  }

  const parLaveur = rendezVousNonTermines(reservations)
  if (parLaveur.size === 0) return NextResponse.json({ ok: true, jour, notifies: 0 })

  // Ni les comptes désactivés, ni les pages de présentation (sans laveur réel).
  const { data: actifs, error: errLaveurs } = await admin
    .from('washers')
    .select('id')
    .in('id', [...parLaveur.keys()])
    .eq('account_status', 'active')
    .eq('is_preview', false)
  if (errLaveurs) {
    logger.error('cron.rappel_terminer.washers_read_failed', { jour }, errLaveurs)
    return NextResponse.json({ ok: false, error: 'Lecture des laveurs impossible' }, { status: 500 })
  }

  // `notifierLaveur` ne lève jamais : un laveur sans notification activée est
  // simplement ignoré, sans bloquer les autres.
  for (const laveur of actifs ?? []) {
    await notifierLaveur(laveur.id as string, messageRappel(parLaveur.get(laveur.id as string) ?? 1, jour))
  }

  logger.info('cron.rappel_terminer.envoye', { jour, laveurs: actifs?.length ?? 0, rendezVous: reservations.length })
  return NextResponse.json({ ok: true, jour, notifies: actifs?.length ?? 0, rendezVous: reservations.length })
}
