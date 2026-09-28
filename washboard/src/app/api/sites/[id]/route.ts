import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

const ADRESSE_MAX = 300
const NOTE_MAX = 500

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await req.json().catch(() => ({})) as { adresse?: unknown; note?: unknown }
  const maj: Record<string, unknown> = {}
  if (corps.adresse !== undefined) {
    const adresse = typeof corps.adresse === 'string' ? corps.adresse.trim() : ''
    if (!adresse) return NextResponse.json({ error: 'Indiquez l’adresse du site.' }, { status: 400 })
    if (adresse.length > ADRESSE_MAX) return NextResponse.json({ error: 'Cette adresse est trop longue.' }, { status: 400 })
    maj.adresse = adresse
  }
  if (corps.note !== undefined) {
    maj.note = typeof corps.note === 'string' ? corps.note.trim().slice(0, NOTE_MAX) || null : null
  }
  if (Object.keys(maj).length === 0) return NextResponse.json({ error: 'Rien à enregistrer.' }, { status: 400 })

  const { error } = await supabase.from('sites').update(maj).eq('id', id)
  if (error) return errorResponse('sites.patch.db', error)
  logger.info('sites.maj', { siteId: id })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) return errorResponse('sites.delete.db', error)
  logger.info('sites.supprime', { siteId: id })
  return NextResponse.json({ success: true })
}
