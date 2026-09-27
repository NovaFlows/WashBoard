import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Ce que le laveur peut encore changer après l'émission : noter la réponse du client à un
// devis, dire qu'une facture a été payée, et retirer un devis qui n'a servi à rien. Rien
// d'autre.
//
// Le CONTENU d'une facture émise, lui, ne se modifie ni ne se supprime : sa numérotation doit
// rester continue et ses mentions figées. Corriger une facture passe par un avoir — que
// WashBoard ne sait pas encore faire, et qu'il vaut mieux refuser clairement que bricoler. Le
// paiement n'en fait pas partie : il ne réécrit rien, il note un fait qui arrive après.

const REPONSES = ['accepte', 'refuse'] as const

async function documentDuLaveur(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: washer } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return { erreur: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }

  const { data: document, error } = await supabase
    .from('documents')
    .select('id, genre, statut, numero, paye_le')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .maybeSingle()

  if (error) {
    logger.error('documents.id.read_failed', { documentId: id }, error)
    return { erreur: NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 503 }) }
  }
  if (!document) return { erreur: NextResponse.json({ error: 'Document introuvable' }, { status: 404 }) }
  return { supabase, document }
}

/** Note la réponse du client à un devis, ou le paiement d'une facture. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await documentDuLaveur(id)
  if (ctx.erreur) return ctx.erreur
  const document = ctx.document!

  const corps = await req.json().catch(() => ({})) as { statut?: string; paye?: unknown }

  // « Payée » / « Pas encore » : une facture seulement, et rien d'autre ne bouge — ni le
  // numéro, ni le contenu, ni le statut d'envoi. Le démarquage existe pour la faute de frappe
  // (le laveur tape payée sur la mauvaise ligne) : sans lui, il faudrait toucher la base.
  if (typeof corps.paye === 'boolean') {
    if (document.genre !== 'facture') {
      return NextResponse.json({ error: 'Un devis ne s’encaisse pas : c’est la facture qui se paie.' }, { status: 400 })
    }
    const paye_le = corps.paye ? new Date().toISOString() : null
    const { error } = await ctx.supabase!.from('documents').update({ paye_le }).eq('id', id)
    if (error) return errorResponse('documents.patch.paiement', error)
    logger.info('documents.paiement', { documentId: id, paye: corps.paye })
    return NextResponse.json({ paye_le })
  }

  const { statut } = corps
  if (!REPONSES.includes(statut as typeof REPONSES[number])) {
    return NextResponse.json({ error: 'Réponse inconnue' }, { status: 400 })
  }
  if (document.genre !== 'devis') {
    return NextResponse.json({ error: 'Une facture ne s’accepte pas : elle est due.' }, { status: 400 })
  }
  if (document.statut === 'transforme') {
    return NextResponse.json({ error: 'Ce devis a déjà été transformé en facture.' }, { status: 409 })
  }

  const { error } = await ctx.supabase!
    .from('documents')
    .update({ statut, repondu_le: new Date().toISOString() })
    .eq('id', id)

  if (error) return errorResponse('documents.patch.db', error)
  logger.info('documents.reponse', { documentId: id, statut })
  return NextResponse.json({ statut })
}

/** Retire un devis. Une facture, jamais. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await documentDuLaveur(id)
  if (ctx.erreur) return ctx.erreur
  const document = ctx.document!

  if (document.genre === 'facture') {
    return NextResponse.json({
      error: 'Une facture émise ne se supprime pas : sa numérotation doit rester continue.',
    }, { status: 400 })
  }
  if (document.statut === 'transforme') {
    return NextResponse.json({
      error: 'Ce devis est devenu une facture : il doit rester, c’est elle qui le justifie.',
    }, { status: 400 })
  }

  const { error } = await ctx.supabase!.from('documents').delete().eq('id', id)
  if (error) return errorResponse('documents.delete.db', error)
  logger.info('documents.supprime', { documentId: id, numero: document.numero })
  return NextResponse.json({ success: true })
}
