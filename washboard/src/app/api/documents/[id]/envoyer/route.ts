import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendDocument } from '@/lib/email'
import { validerEnvoi } from '@/lib/documents'
import type { FactureContenu } from '@/lib/facture'
import { FUSEAU } from '@/lib/dateUtils'

// Envoi du devis ou de la facture au client, par email, à la demande du laveur.
//
// Le statut ne passe à « envoyé » que si Resend a accepté le message : afficher « envoyé »
// sur un envoi qui a échoué ferait attendre au laveur une réponse qui ne viendra jamais.

const jourSeul = (date: string) =>
  new Date(`${date}T12:00:00.000Z`)
    .toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id, name').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { data: document, error } = await supabase
    .from('documents')
    .select('id, genre, statut, numero, contenu')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .maybeSingle()

  if (error) {
    logger.error('documents.envoyer.read_failed', { documentId: id }, error)
    return NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 503 })
  }
  if (!document?.numero) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  const contenu = document.contenu as FactureContenu
  const refus = validerEnvoi(contenu)
  if (refus) return NextResponse.json({ error: refus }, { status: 400 })

  try {
    const { error: errEnvoi } = await sendDocument({
      to: contenu.client.email,
      clientName: contenu.client.entreprise || contenu.client.nom,
      washerName: washer.name,
      washerEmail: user.email ?? null,
      genre: document.genre as 'devis' | 'facture',
      numero: document.numero as string,
      documentId: document.id as string,
      montantTtc: contenu.totaux.ttc,
      valableJusquau: contenu.valableJusquau ? jourSeul(contenu.valableJusquau) : null,
    })
    if (errEnvoi) throw errEnvoi
  } catch (e) {
    logger.error('documents.envoyer.echec', { documentId: id }, e)
    return NextResponse.json({
      error: 'L’email n’est pas parti. Vérifiez l’adresse du client et réessayez.',
    }, { status: 503 })
  }

  // Un devis déjà accepté ou refusé ne revient pas à « en attente » parce qu'on le renvoie.
  const { error: errStatut } = await supabase
    .from('documents')
    .update({
      envoye_le: new Date().toISOString(),
      ...(document.statut === 'emis' ? { statut: 'envoye' } : {}),
    })
    .eq('id', id)
  if (errStatut) logger.error('documents.envoyer.statut_failed', { documentId: id }, errStatut)

  logger.info('documents.envoye', { documentId: id, genre: document.genre, numero: document.numero })
  return NextResponse.json({ success: true })
}
