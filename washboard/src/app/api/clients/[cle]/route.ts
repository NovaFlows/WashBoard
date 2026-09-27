import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Réglages écrits à la main sur un client — table `clients`, SQL donné dans la conversation du
// 2026-09-28 (proposition de Yanis : « ne plus contacter », discutée avec Alexandre).
//
// Un seul réglage pour l'instant : `nePlusContacter`. La ligne naît au premier écrit (upsert
// sur `washer_id, cle`) : pas de ligne pour un client qu'on n'a jamais touché, son absence vaut
// « rien de particulier » — même principe que les documents (voir `lib/clientProfile.ts`).
//
// Client RLS-scopé, pas le client admin : rien ici n'a besoin de sortir du garde-fou
// « ce laveur ne touche que ses propres lignes », contrairement à la numérotation des
// documents (verrou en base, hors de portée du navigateur).

/** `cle` vient de `cleClient` : un email en minuscules, ou `tel:` + des chiffres. Rejeter le
 *  reste évite d'écrire une ligne pour une clé qui ne correspondra jamais à aucun client. */
function cleValide(cle: string): boolean {
  return /^[^\s]+@[^\s]+\.[^\s]+$/.test(cle) || /^tel:\d{6,}$/.test(cle)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle: cleBrute } = await params
  const cle = decodeURIComponent(cleBrute)
  if (!cleValide(cle)) return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (errWasher || !washer) {
    logger.error('clients.patch.washer_read_failed', {}, errWasher)
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  const corps = await req.json().catch(() => ({})) as { nePlusContacter?: unknown }
  if (typeof corps.nePlusContacter !== 'boolean') {
    return NextResponse.json({ error: 'nePlusContacter doit être vrai ou faux' }, { status: 400 })
  }

  const { error } = await supabase
    .from('clients')
    .upsert(
      { washer_id: washer.id, cle, ne_plus_contacter: corps.nePlusContacter, maj_le: new Date().toISOString() },
      { onConflict: 'washer_id,cle' },
    )
  if (error) return errorResponse('clients.patch.db', error)

  logger.info('clients.reglage', { washerId: washer.id, nePlusContacter: corps.nePlusContacter })
  return NextResponse.json({ cle, nePlusContacter: corps.nePlusContacter })
}
