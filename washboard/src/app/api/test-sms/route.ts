import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'
import { hasFeature } from '@/lib/plan'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers')
    .select('name, phone, sms_sender, plan, grandfathered, google_review_url')
    .eq('user_id', user.id)
    .single()

  if (!washer) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })
  if (!hasFeature(washer, 'avis_sms')) {
    return NextResponse.json({ error: 'Fonctionnalité réservée aux plans Pro et Business' }, { status: 403 })
  }
  if (!washer.phone) {
    return NextResponse.json({ error: 'Ajoutez votre numéro de téléphone dans Paramètres > Général pour recevoir le SMS test' }, { status: 400 })
  }

  const sender = (washer.sms_sender ?? washer.name).slice(0, 11)
  const reviewLink = washer.google_review_url ?? 'https://g.page/r/votre-lien-avis'

  try {
    await sendSms({
      to: washer.phone,
      sender,
      content: `[TEST] Bonjour, merci pour votre confiance ! Pouvez-vous laisser un avis sur notre travail ? ${reviewLink}`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur envoi SMS' }, { status: 500 })
  }
}
