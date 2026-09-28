import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Droit d'accès et droit à l'effacement (articles 15 et 17 du RGPD, menu « … » de la fiche,
// 2026-09-28) — libellés et mécanique revus par l'agent `legal` avant construction (voir le
// compte rendu de la conversation).
//
// « Exporter » ne fait QUE journaliser : le fichier lui-même se construit dans le navigateur,
// depuis la fiche déjà chargée (`enregistrerExport`, `clientsApi.ts`) — aucune donnée
// supplémentaire ne transite par ici. Journaliser sert la responsabilité du laveur (article 5.2)
// en cas de contrôle : pouvoir montrer qu'une demande a été traitée, sans reconstituer les
// données déjà effacées dans la trace elle-même (`client_rgpd_journal` ne porte que l'action et
// la date, jamais le contenu).
//
// « Anonymiser » (droit à l'effacement, article 17, exception de conservation comptable
// 17.3.b) remplace nom/email/téléphone/adresse par des valeurs anonymes sur TOUTES les
// réservations et TOUS les documents de ce client — jamais les montants, dates ou numéros de
// facture. `anonymiser_client` (fonction SQL, SECURITY DEFINER — voir le SQL donné dans la
// conversation) fait la réécriture sous un verrou, comme `fusionner_clients`. Irréversible : la
// confirmation avec case à cocher vit dans `ClientProfileModalV2.tsx`, pas ici — ce serait trop
// tard pour reculer une fois la requête partie.

function cleValide(cle: string): boolean {
  return /^[^\s]+@[^\s]+\.[^\s]+$/.test(cle) || /^tel:\d{6,}$/.test(cle)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle: cleBrute } = await params
  const cle = decodeURIComponent(cleBrute)
  if (!cleValide(cle)) return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (errWasher || !washer) {
    logger.error('clients.rgpd.washer_read_failed', {}, errWasher)
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  const corps = await req.json().catch(() => ({})) as { action?: unknown }
  if (corps.action !== 'export' && corps.action !== 'anonymiser') {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  if (corps.action === 'anonymiser') {
    const { error } = await supabase.rpc('anonymiser_client', { p_washer_id: washer.id, p_cle: cle })
    if (error) return errorResponse('clients.rgpd.anonymiser.db', error)
  }

  const { error: errJournal } = await supabase
    .from('client_rgpd_journal')
    .insert({ washer_id: washer.id, cle, action: corps.action, utilisateur_id: user.id })
  // Une panne de journalisation ne doit pas faire échouer l'action elle-même (surtout
  // l'anonymisation, déjà faite et irréversible à ce stade) — seulement une trace, pas d'écrire.
  if (errJournal) logger.error('clients.rgpd.journal_failed', { washerId: washer.id, action: corps.action }, errJournal)

  logger.info('clients.rgpd', { washerId: washer.id, action: corps.action })
  return NextResponse.json({ success: true })
}
