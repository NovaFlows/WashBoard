import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/** Enregistre l'appareil du laveur pour les notifications. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { endpoint, keys } = await request.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Abonnement incomplet' }, { status: 400 })
  }

  // `endpoint` est unique : se réabonner depuis le même appareil met à jour la
  // ligne existante au lieu d'en créer une seconde.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      washer_id: washer.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) {
    logger.error('push.subscribe_failed', { washerId: washer.id }, error)
    return NextResponse.json(
      { error: "Impossible d'activer les notifications. Réessayez dans un instant." },
      { status: 503 },
    )
  }

  return NextResponse.json({ success: true })
}

/** Désinscrit l'appareil. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { endpoint } = await request.json()
  if (!endpoint) return NextResponse.json({ error: 'Endpoint manquant' }, { status: 400 })

  // La politique RLS restreint déjà la suppression aux appareils du laveur.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) {
    logger.error('push.unsubscribe_failed', {}, error)
    return NextResponse.json({ error: 'Impossible de désactiver les notifications.' }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}
