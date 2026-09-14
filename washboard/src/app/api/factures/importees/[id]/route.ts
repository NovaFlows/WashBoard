import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_FACTURES_IMPORTEES } from '@/lib/importFactures'
import { logger } from '@/lib/logger'

async function lireFacture(id: string, washerId: string) {
  // Filtre sur le laveur en plus de l'identifiant : l'identifiant seul
  // permettrait de télécharger la facture d'un autre en devinant son numéro.
  return createAdminClient()
    .from('factures_importees')
    .select('id, chemin, nom_fichier')
    .eq('id', id)
    .eq('washer_id', washerId)
    .maybeSingle()
}

// Téléchargement : un lien temporaire (60 s) vers le stockage privé. Le lien
// public n'existe pas — ces factures portent les noms et adresses des clients.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const { data: facture, error } = await lireFacture(id, washerId)
  if (error) logger.error('factures_importees.lecture_failed', { washerId }, error)
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const { data: lien, error: errLien } = await createAdminClient().storage
    .from(BUCKET_FACTURES_IMPORTEES)
    .createSignedUrl(facture.chemin, 60, { download: facture.nom_fichier })
  if (errLien || !lien) {
    logger.error('factures_importees.lien_failed', { washerId }, errLien)
    return NextResponse.json({ error: 'Téléchargement impossible pour le moment.' }, { status: 500 })
  }
  return NextResponse.redirect(lien.signedUrl)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const { data: facture, error } = await lireFacture(id, washerId)
  if (error) logger.error('factures_importees.lecture_failed', { washerId }, error)
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const admin = createAdminClient()
  const { error: errLigne } = await admin.from('factures_importees').delete().eq('id', id).eq('washer_id', washerId)
  if (errLigne) {
    logger.error('factures_importees.delete_failed', { washerId }, errLigne)
    return NextResponse.json({ error: 'Suppression impossible pour le moment.' }, { status: 500 })
  }
  // Le fichier après la ligne : un fichier orphelin ne se voit nulle part, une
  // ligne sans fichier donnerait un lien cassé dans la liste.
  const { error: errFichier } = await admin.storage.from(BUCKET_FACTURES_IMPORTEES).remove([facture.chemin])
  if (errFichier) logger.warn('factures_importees.fichier_orphelin', { washerId }, errFichier)
  return NextResponse.json({ ok: true })
}
