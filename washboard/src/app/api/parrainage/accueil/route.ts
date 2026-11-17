import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { carteParrainageVisible, dateRetourCarte, phraseRecompense, type FormeRecompense } from '@/lib/parrainage'

// Ce que l'accueil affiche pour le parrainage : la carte de rappel et, une seule fois par
// filleul devenu client, la célébration. Lecture et écriture par le serveur uniquement.

async function laveurConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('washers')
    .select('id, grandfathered, created_at, parrainage_carte_revoir_le')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) logger.error('parrainage.accueil.laveur', { userId: user.id }, error)
  return data ? { admin, laveur: data } : null
}

export async function GET() {
  const c = await laveurConnecte()
  if (!c) return NextResponse.json({ carte: false, celebration: null })
  const { admin, laveur } = c

  const [filleuls, reservation, aFeter] = await Promise.all([
    admin.from('parrainages').select('id', { count: 'exact', head: true }).eq('parrain_id', laveur.id),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', laveur.id).limit(1),
    laveur.grandfathered
      ? Promise.resolve({ data: [], error: null })
      : admin
        .from('parrainages')
        .select('id, recompense_forme, recompense_detail, filleul:washers!parrainages_filleul_id_fkey(name)')
        .eq('parrain_id', laveur.id)
        .not('recompense_le', 'is', null)
        .is('celebre_le', null)
        .neq('recompense_forme', 'aucune')
        .order('recompense_le', { ascending: false })
        .limit(1),
  ])
  if (filleuls.error || reservation.error || aFeter.error) {
    logger.warn('parrainage.accueil.lecture', { washerId: laveur.id }, filleuls.error ?? reservation.error ?? aFeter.error)
    return NextResponse.json({ carte: false, celebration: null })
  }

  const ligne = (aFeter.data ?? [])[0] as { recompense_forme: FormeRecompense; recompense_detail: Record<string, string> | null; filleul: { name: string } | { name: string }[] | null } | undefined
  const filleul = ligne ? (Array.isArray(ligne.filleul) ? ligne.filleul[0] : ligne.filleul) : null
  const celebration = ligne && filleul
    ? { filleul: filleul.name, phrase: phraseRecompense({ forme: ligne.recompense_forme, colonnes: ligne.recompense_detail ?? {} }) }
    : null

  const carte = carteParrainageVisible({
    grandfathered: laveur.grandfathered,
    createdAt: laveur.created_at,
    revoirLe: laveur.parrainage_carte_revoir_le,
    aDesFilleuls: (filleuls.count ?? 0) > 0,
    aUneReservation: (reservation.count ?? 0) > 0,
  })
  return NextResponse.json({ carte, celebration })
}

export async function POST(request: Request) {
  const c = await laveurConnecte()
  if (!c) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { admin, laveur } = c
  const corps = await request.json().catch(() => null) as { action?: string } | null

  if (corps?.action === 'fermer_carte') {
    const { error } = await admin.from('washers').update({ parrainage_carte_revoir_le: dateRetourCarte() }).eq('id', laveur.id)
    if (error) logger.warn('parrainage.accueil.fermer_carte', { washerId: laveur.id }, error)
    return NextResponse.json({ ok: !error })
  }
  if (corps?.action === 'celebre') {
    const { error } = await admin
      .from('parrainages')
      .update({ celebre_le: new Date().toISOString() })
      .eq('parrain_id', laveur.id)
      .not('recompense_le', 'is', null)
      .is('celebre_le', null)
    if (error) logger.warn('parrainage.accueil.celebre', { washerId: laveur.id }, error)
    return NextResponse.json({ ok: !error })
  }
  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
