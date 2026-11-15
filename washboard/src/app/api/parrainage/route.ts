import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { SITE_URL_FALLBACK } from '@/lib/plan'
import { lienParrainage } from '@/lib/parrainage'
import { codeDuLaveur, filleulsDuParrain } from '@/lib/parrainageServeur'

// L'écran Parrainage du laveur connecté : son code, son lien, ses filleuls (nom et statut
// seulement) et ses mois gagnés. Le code est créé à la première ouverture.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: laveur, error } = await admin
    .from('washers')
    .select('id, name, code_parrainage, pro_offert_jusqu_au')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    logger.error('parrainage.get.laveur', { userId: user.id }, error)
    return NextResponse.json({ error: 'Impossible de charger ton parrainage.' }, { status: 503 })
  }
  if (!laveur) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const [code, filleuls] = await Promise.all([
    codeDuLaveur(admin, laveur),
    filleulsDuParrain(admin, laveur.id),
  ])
  if (!code || !filleuls) return NextResponse.json({ error: 'Impossible de charger ton parrainage.' }, { status: 503 })

  const base = process.env.NEXT_PUBLIC_APP_URL || SITE_URL_FALLBACK
  return NextResponse.json({
    code,
    lien: lienParrainage(base, code),
    filleuls,
    moisGagnes: filleuls.filter(f => f.recompenseLe).length,
    proOffertJusquAu: laveur.pro_offert_jusqu_au ?? null,
  })
}
