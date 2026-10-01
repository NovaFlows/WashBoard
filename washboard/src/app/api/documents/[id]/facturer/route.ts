import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import { saisieDepuisContenu, construireDocument } from '@/lib/documents'
import { aujourdhuiParis } from '@/lib/chiffresPeriode'
import { infosFacturationManquantes, phraseManques, type FactureContenu, type VendeurFacturable } from '@/lib/facture'

// « Transformer en facture » : le geste qui donne son intérêt au devis.
//
// La facture est reconstruite à partir du contenu FIGÉ du devis, en base — pas à partir de ce
// que le navigateur renvoie. Le client, les lignes, la remise et le mot du laveur sont donc
// exactement ceux que le client a acceptés ; seules les mentions du laveur sont reprises à
// jour (s'il a changé d'adresse entre-temps, c'est la nouvelle qui vaut sur la facture).
//
// Le devis garde son numéro et passe en « Facturé » : les deux documents restent, et la
// facture pointe vers le devis dont elle vient.

const COLONNES_VENDEUR =
  'id, name, phone, logo_url, brand_color, facture_statut, facture_nom_legal, facture_siret, ' +
  'facture_adresse, facture_forme_juridique, facture_capital, facture_immatriculation, ' +
  'facture_regime_tva, facture_taux_tva, facture_numero_tva'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select(COLONNES_VENDEUR).eq('user_id', user.id).single()
  if (errWasher || !washer) {
    logger.error('documents.facturer.washer_read_failed', {}, errWasher)
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }
  const vendeur = washer as unknown as VendeurFacturable & { id: string }

  const { data: devis, error: errDevis } = await supabase
    .from('documents')
    .select('id, genre, statut, numero, contenu, facture_id')
    .eq('id', id)
    .eq('washer_id', vendeur.id)
    .maybeSingle()

  if (errDevis) {
    logger.error('documents.facturer.read_failed', { documentId: id }, errDevis)
    return NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 503 })
  }
  if (!devis) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
  if (devis.genre !== 'devis') {
    return NextResponse.json({ error: 'Ce document est déjà une facture.' }, { status: 400 })
  }
  // Deux taps sur le bouton ne doivent pas consommer deux numéros de facture.
  if (devis.statut === 'transforme' && devis.facture_id) {
    return NextResponse.json({ id: devis.facture_id, deja: true })
  }

  const manques = infosFacturationManquantes(vendeur)
  if (manques.length > 0) {
    return NextResponse.json({ error: phraseManques(manques), manques }, { status: 409 })
  }

  const saisie = saisieDepuisContenu(devis.contenu as FactureContenu, 'facture')
  // Un devis chiffre souvent un travail sans date. Une facture, elle, dit quand la prestation
  // a eu lieu : à défaut, c'est le jour où on facture — on ne facture pas ce qui n'est pas fait.
  if (!saisie.date) saisie.date = aujourdhuiParis(Date.now())
  const contenu = construireDocument(saisie, vendeur)
  const admin = createAdminClient()

  const { data: cree, error: errInsert } = await admin
    .from('documents')
    .insert({
      washer_id: vendeur.id,
      genre: 'facture',
      statut: 'emis',
      contenu,
      devis_id: devis.id,
    })
    .select('id')
    .single()

  if (errInsert || !cree) return errorResponse('documents.facturer.insert', errInsert)

  const { data, error: errNumero } = await admin.rpc('emettre_document', { p_document_id: cree.id })
  if (errNumero) {
    await admin.from('documents').delete().eq('id', cree.id)
    return errorResponse('documents.facturer.emission', errNumero)
  }

  // Le devis ne bascule qu'une fois la facture née et numérotée : un devis marqué « Facturé »
  // sans facture en face serait un mensonge que rien ne rattrape.
  const { error: errLien } = await admin
    .from('documents')
    .update({ statut: 'transforme', facture_id: cree.id })
    .eq('id', devis.id)
  if (errLien) logger.error('documents.facturer.lien_failed', { devisId: devis.id, factureId: cree.id }, errLien)

  const numero = (Array.isArray(data) ? data[0] : data) as { numero?: string } | null
  logger.info('documents.facture_depuis_devis', { devisId: devis.id, factureId: cree.id, numero: numero?.numero })
  return NextResponse.json({ id: cree.id, numero: numero?.numero ?? null }, { status: 201 })
}
