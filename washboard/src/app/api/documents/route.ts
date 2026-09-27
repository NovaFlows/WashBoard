import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import { construireDocument, validerDocument, type SaisieDocument } from '@/lib/documents'
import { infosFacturationManquantes, phraseManques, type VendeurFacturable } from '@/lib/facture'
import { aujourdhuiParis } from '@/lib/chiffresPeriode'

// Devis et factures écrits à la main (voir `lib/documents.ts`). Deux verrous tiennent tout :
//
//  1. le contenu est construit ICI, à partir de la fiche du laveur en base — le navigateur
//     n'envoie que ce que le laveur a tapé. Un client qui poste un SIRET ou un nom légal
//     choisi ne fabrique pas une facture au nom de quelqu'un d'autre ;
//  2. le NUMÉRO n'est jamais calculé ici : `emettre_document` l'attribue en base, sous verrou,
//     depuis le compteur du laveur — le même que les factures de réservation pour une facture,
//     un compteur séparé pour les devis.

const COLONNES_VENDEUR =
  'id, name, phone, logo_url, brand_color, facture_statut, facture_nom_legal, facture_siret, ' +
  'facture_adresse, facture_forme_juridique, facture_capital, facture_immatriculation, ' +
  'facture_regime_tva, facture_taux_tva, facture_numero_tva'

async function laveurConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: washer, error } = await supabase
    .from('washers').select(COLONNES_VENDEUR).eq('user_id', user.id).single()
  if (error || !washer) {
    logger.error('documents.washer.read_failed', {}, error)
    return { erreur: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }
  }
  return { supabase, washer: washer as unknown as VendeurFacturable & { id: string } }
}

/** Les devis et factures du laveur, du plus récent au plus ancien. */
export async function GET(req: NextRequest) {
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur

  const genre = req.nextUrl.searchParams.get('genre')
  let requete = ctx.supabase!
    .from('documents')
    .select('id, genre, statut, numero, contenu, emis_le, envoye_le, valable_jusquau, repondu_le, facture_id, devis_id, created_at')
    .eq('washer_id', ctx.washer!.id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (genre === 'devis' || genre === 'facture') requete = requete.eq('genre', genre)

  const { data, error } = await requete
  if (error) return errorResponse('documents.get.db', error)
  return NextResponse.json({ documents: data })
}

/** Écrit un document et l'émet dans la foulée : il naît numéroté, ou il ne naît pas. */
export async function POST(req: NextRequest) {
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur
  const washer = ctx.washer!

  const corps = await req.json().catch(() => null) as { saisie?: SaisieDocument; devisId?: string } | null
  const saisie = corps?.saisie
  if (!saisie || (saisie.genre !== 'devis' && saisie.genre !== 'facture')) {
    return NextResponse.json({ error: 'Document invalide' }, { status: 400 })
  }

  const refus = validerDocument(saisie, aujourdhuiParis(Date.now()))
  if (refus) return NextResponse.json({ error: refus }, { status: 400 })

  // Un document sans SIRET ni adresse n'est pas un document : il porterait le nom du laveur
  // sans l'identifier. Même exigence pour un devis — c'est lui qui engage le prix.
  const manques = infosFacturationManquantes(washer)
  if (manques.length > 0) {
    return NextResponse.json({ error: phraseManques(manques), manques }, { status: 409 })
  }

  const contenu = construireDocument(saisie, washer)
  const admin = createAdminClient()

  const { data: cree, error: errInsert } = await admin
    .from('documents')
    .insert({
      washer_id: washer.id,
      genre: saisie.genre,
      statut: 'emis',
      contenu,
      valable_jusquau: contenu.valableJusquau,
      devis_id: corps?.devisId ?? null,
    })
    .select('id')
    .single()

  if (errInsert || !cree) return errorResponse('documents.post.insert', errInsert)

  const { data, error: errNumero } = await admin.rpc('emettre_document', { p_document_id: cree.id })
  if (errNumero) {
    // Sans numéro le document n'existe pas vraiment : on retire la ligne plutôt que de laisser
    // un document muet dans la liste.
    await admin.from('documents').delete().eq('id', cree.id)
    return errorResponse('documents.post.emission', errNumero)
  }

  const numero = (Array.isArray(data) ? data[0] : data) as { numero?: string } | null
  logger.info('documents.emis', { washerId: washer.id, genre: saisie.genre, numero: numero?.numero })
  return NextResponse.json({ id: cree.id, numero: numero?.numero ?? null }, { status: 201 })
}
