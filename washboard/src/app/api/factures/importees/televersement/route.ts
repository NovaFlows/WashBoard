import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireWasher } from '@/lib/requireWasher'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_FACTURES_IMPORTEES, extensionStockage } from '@/lib/importFactures'
import { LIMITES } from '@/lib/zipFactures'
import { logger } from '@/lib/logger'

// Prépare l'envoi d'UNE facture importée : renvoie un lien à usage unique vers
// le stockage privé, dans le dossier du laveur connecté.
//
// Le fichier ne passe pas par ce serveur : sur Vercel, une requête ne peut pas
// dépasser 4,5 Mo. Le navigateur l'envoie directement au stockage. C'est ici,
// en revanche, que le nom du fichier est choisi — jamais par le navigateur.
export async function POST(req: Request) {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { washerId } = auth.ctx

  const { type, taille } = await req.json().catch(() => ({})) as { type?: unknown; taille?: unknown }
  const ext = extensionStockage(type)
  if (!ext) return NextResponse.json({ error: 'Format non accepté : PDF, JPG ou PNG.' }, { status: 400 })
  if (!Number.isInteger(taille) || (taille as number) <= 0 || (taille as number) > LIMITES.tailleFichier) {
    return NextResponse.json({ error: 'Fichier vide ou de plus de 10 Mo.' }, { status: 400 })
  }

  const chemin = `${washerId}/${randomUUID()}.${ext}`
  const { data, error } = await createAdminClient().storage
    .from(BUCKET_FACTURES_IMPORTEES)
    .createSignedUploadUrl(chemin)

  if (error || !data) {
    logger.error('factures_importees.televersement_failed', { washerId }, error)
    return NextResponse.json({ error: 'Envoi impossible pour le moment. Réessayez dans un instant.' }, { status: 500 })
  }
  return NextResponse.json({ chemin, token: data.token })
}
