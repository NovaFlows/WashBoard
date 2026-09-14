import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_FACTURES_IMPORTEES, cheminAppartient, validerSaisie } from '@/lib/importFactures'
import { LIMITES } from '@/lib/zipFactures'
import { logger } from '@/lib/logger'

// Enregistre les factures importées que le laveur a vérifiées (date, montant).
export async function POST(req: Request) {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const { factures } = await req.json().catch(() => ({})) as { factures?: unknown }
  if (!Array.isArray(factures) || factures.length === 0 || factures.length > LIMITES.nombreFichiers) {
    return NextResponse.json({ error: `Entre 1 et ${LIMITES.nombreFichiers} factures par envoi.` }, { status: 400 })
  }

  const lignes = []
  for (const brut of factures) {
    const r = validerSaisie(brut, washerId)
    if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: 400 })
    lignes.push({
      washer_id: washerId,
      chemin: r.valeur.chemin,
      nom_fichier: r.valeur.nomFichier,
      type_fichier: r.valeur.typeFichier,
      taille: r.valeur.taille,
      date_facture: r.valeur.dateFacture,
      montant: r.valeur.montant,
      numero: r.valeur.numero,
    })
  }

  const { error } = await createAdminClient().from('factures_importees').insert(lignes)
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Une de ces factures est déjà enregistrée.' }, { status: 409 })
    }
    logger.error('factures_importees.insert_failed', { washerId, nombre: lignes.length }, error)
    return NextResponse.json({ error: 'L’enregistrement a échoué. Réessayez dans un instant.' }, { status: 500 })
  }
  logger.info('factures_importees.ajoutees', { washerId, nombre: lignes.length })
  return NextResponse.json({ ajoutees: lignes.length })
}

// Annulation d'un import en cours : retire du stockage les fichiers envoyés
// mais jamais enregistrés. Un fichier déjà enregistré n'est jamais touché ici
// — il se supprime depuis la liste, facture par facture.
export async function DELETE(req: Request) {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const { chemins } = await req.json().catch(() => ({})) as { chemins?: unknown }
  const candidats = Array.isArray(chemins)
    ? chemins.filter((c): c is string => cheminAppartient(c, washerId)).slice(0, LIMITES.nombreFichiers)
    : []
  if (candidats.length === 0) return NextResponse.json({ supprimes: 0 })

  const admin = createAdminClient()
  const { data: enregistres, error: errLecture } = await admin
    .from('factures_importees').select('chemin').eq('washer_id', washerId).in('chemin', candidats)
  if (errLecture) {
    // Sans savoir lesquels sont enregistrés, on ne supprime rien.
    logger.error('factures_importees.annulation.read_failed', { washerId }, errLecture)
    return NextResponse.json({ error: 'Annulation impossible pour le moment.' }, { status: 503 })
  }
  const garder = new Set((enregistres ?? []).map(e => e.chemin))
  const aSupprimer = candidats.filter(c => !garder.has(c))
  if (aSupprimer.length > 0) {
    const { error } = await admin.storage.from(BUCKET_FACTURES_IMPORTEES).remove(aSupprimer)
    if (error) logger.warn('factures_importees.annulation.remove_failed', { washerId }, error)
  }
  return NextResponse.json({ supprimes: aSupprimer.length })
}
