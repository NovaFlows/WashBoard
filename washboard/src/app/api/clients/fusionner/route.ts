import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Fusionner un doublon (menu « … » de la fiche, 2026-09-28) : deux fiches qui sont en réalité la
// même personne (`lib/doublons.ts` les repère par téléphone ou par nom). Toutes les réservations
// et tous les documents de la fiche SOURCE prennent l'email et le téléphone de la fiche CIBLE —
// c'est elle qui les absorbe, la source disparaît. Irréversible.
//
// Deux temps : d'abord les réglages (notes, véhicules, ne plus contacter…) de la source sont
// combinés dans ceux de la cible, ICI, en réutilisant le PATCH habituel plutôt qu'en le
// réécrivant. Ensuite `fusionner_clients` (fonction SQL, SECURITY DEFINER — voir le SQL donné
// dans la conversation du 2026-09-28) réassigne réservations et documents et supprime la ligne
// de réglages de la source, sous un verrou : deux fusions du même laveur en même temps ne
// doivent pas se marcher dessus.

function cleValide(cle: string): boolean {
  return /^[^\s]+@[^\s]+\.[^\s]+$/.test(cle) || /^tel:\d{6,}$/.test(cle)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (errWasher || !washer) {
    logger.error('clients.fusionner.washer_read_failed', {}, errWasher)
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  const corps = await req.json().catch(() => ({})) as {
    cleSource?: unknown; cleCible?: unknown; emailCible?: unknown; telephoneCible?: unknown
  }
  const cleSource = typeof corps.cleSource === 'string' ? corps.cleSource : ''
  const cleCible = typeof corps.cleCible === 'string' ? corps.cleCible : ''
  const emailCible = typeof corps.emailCible === 'string' ? corps.emailCible.trim() : ''
  const telephoneCible = typeof corps.telephoneCible === 'string' ? corps.telephoneCible.trim() : ''

  if (!cleValide(cleSource) || !cleValide(cleCible)) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })
  }
  if (cleSource === cleCible) return NextResponse.json({ error: 'Ces deux fiches n’en font déjà qu’une.' }, { status: 400 })
  if (!emailCible && !telephoneCible) {
    return NextResponse.json({ error: 'La fiche à garder n’a ni email ni téléphone.' }, { status: 400 })
  }

  // Réglages des deux fiches : la cible garde les siens en priorité, la source ne comble que ce
  // qui manque — fusionner ne doit jamais effacer un réglage déjà pris sur la fiche qu'on garde.
  const { data: lignes, error: errLignes } = await supabase
    .from('clients')
    .select('cle, ne_plus_contacter, notes, vehicules, nom, telephone, entreprise_id, role_entreprise')
    .eq('washer_id', washer.id)
    .in('cle', [cleSource, cleCible])
  if (errLignes) {
    logger.error('clients.fusionner.lignes_read_failed', { washerId: washer.id }, errLignes)
    return NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 503 })
  }
  const source = lignes?.find(l => l.cle === cleSource) ?? null
  const cible = lignes?.find(l => l.cle === cleCible) ?? null

  const combiner = (a: string | null | undefined, b: string | null | undefined) => {
    const [x, y] = [a?.trim(), b?.trim()].filter(Boolean)
    if (x && y && x !== y) return `${x} / ${y}`
    return x || y || null
  }

  const { error: errUpsert } = await supabase
    .from('clients')
    .upsert(
      {
        washer_id: washer.id,
        cle: cleCible,
        ne_plus_contacter: !!(source?.ne_plus_contacter || cible?.ne_plus_contacter),
        notes: combiner(cible?.notes, source?.notes),
        vehicules: combiner(cible?.vehicules, source?.vehicules),
        nom: cible?.nom || source?.nom || null,
        telephone: cible?.telephone || source?.telephone || null,
        entreprise_id: cible?.entreprise_id ?? source?.entreprise_id ?? null,
        role_entreprise: cible?.entreprise_id ? cible?.role_entreprise : source?.role_entreprise ?? null,
        maj_le: new Date().toISOString(),
      },
      { onConflict: 'washer_id,cle' },
    )
  if (errUpsert) return errorResponse('clients.fusionner.upsert.db', errUpsert)

  const { error: errRpc } = await supabase.rpc('fusionner_clients', {
    p_washer_id: washer.id,
    p_cle_source: cleSource,
    p_email_cible: emailCible,
    p_telephone_cible: telephoneCible,
  })
  if (errRpc) return errorResponse('clients.fusionner.rpc.db', errRpc)

  logger.info('clients.fusion', { washerId: washer.id })
  return NextResponse.json({ success: true })
}
