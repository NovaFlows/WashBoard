import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

const NOM_MAX = 200

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await req.json().catch(() => ({})) as { nom?: unknown; delaiPaiementJours?: unknown }
  const maj: Record<string, unknown> = {}

  if (corps.nom !== undefined) {
    const nom = typeof corps.nom === 'string' ? corps.nom.trim() : ''
    if (!nom) return NextResponse.json({ error: 'Indiquez le nom de l’entreprise.' }, { status: 400 })
    if (nom.length > NOM_MAX) return NextResponse.json({ error: 'Ce nom est trop long.' }, { status: 400 })
    maj.nom = nom
  }
  if (corps.delaiPaiementJours !== undefined) {
    if (corps.delaiPaiementJours === null) {
      maj.delai_paiement_jours = null
    } else {
      const n = Number(corps.delaiPaiementJours)
      if (!Number.isFinite(n) || n < 0 || n > 3650) {
        return NextResponse.json({ error: 'Le délai de paiement doit être un nombre de jours raisonnable.' }, { status: 400 })
      }
      maj.delai_paiement_jours = Math.round(n)
    }
  }
  if (Object.keys(maj).length === 0) return NextResponse.json({ error: 'Rien à enregistrer.' }, { status: 400 })
  maj.maj_le = new Date().toISOString()

  // RLS filtre déjà sur `washer_id` : cette requête ne peut rien changer chez un autre laveur.
  const { error } = await supabase.from('entreprises').update(maj).eq('id', id)
  if (error) return errorResponse('entreprises.patch.db', error)

  logger.info('entreprises.maj', { entrepriseId: id })
  return NextResponse.json({ ok: true })
}

/** Supprime l'entreprise. Contrairement à un client, rien ici ne touche des réservations ni des
 *  factures : les sites disparaissent avec elle (`on delete cascade`), ses contacts redeviennent
 *  de simples clients (`entreprise_id` repasse à `null`, `on delete set null`) — ils ne perdent
 *  ni leurs réservations, ni leurs documents, ni leur historique. Une suppression sans risque,
 *  qui ne demande donc pas de confirmation en deux temps côté serveur (la feuille en demande
 *  une côté écran, par précaution ordinaire). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase.from('entreprises').delete().eq('id', id)
  if (error) return errorResponse('entreprises.delete.db', error)

  logger.info('entreprises.supprimee', { entrepriseId: id })
  return NextResponse.json({ success: true })
}
