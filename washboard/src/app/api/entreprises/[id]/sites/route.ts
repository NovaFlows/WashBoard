import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

const ADRESSE_MAX = 300
const NOTE_MAX = 500

/** Ajoute un site à une entreprise. RLS vérifie déjà que `id` appartient à ce laveur (policy
 *  `sites_insert`, via `entreprises.washer_id`) : un `id` d'un autre laveur ferait échouer
 *  l'écriture sans qu'on ait besoin de le vérifier ici. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entrepriseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await req.json().catch(() => ({})) as { adresse?: unknown; note?: unknown }
  const adresse = typeof corps.adresse === 'string' ? corps.adresse.trim() : ''
  if (!adresse) return NextResponse.json({ error: 'Indiquez l’adresse du site.' }, { status: 400 })
  if (adresse.length > ADRESSE_MAX) return NextResponse.json({ error: 'Cette adresse est trop longue.' }, { status: 400 })
  const note = typeof corps.note === 'string' ? corps.note.trim().slice(0, NOTE_MAX) : null

  const { data, error } = await supabase
    .from('sites')
    .insert({ entreprise_id: entrepriseId, adresse, note: note || null })
    .select('id')
    .single()

  if (error) return errorResponse('entreprises.sites.post.db', error)
  logger.info('entreprises.site_ajoute', { entrepriseId, siteId: data.id })
  return NextResponse.json({ id: data.id })
}
