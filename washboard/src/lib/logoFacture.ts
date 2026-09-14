import sharp from 'sharp'
import { logger } from '@/lib/logger'

/** Le logo d'une facture ne peut venir que de notre stockage de logos.
 *
 *  L'adresse est lue sur la facture, donc sur la fiche du laveur, qu'il peut
 *  modifier : sans ce contrôle, n'importe quelle adresse saisie ferait
 *  interroger par notre serveur une machine de son choix, y compris interne. */
export function logoUrlAutorisee(url: string): boolean {
  try {
    const cible = new URL(url)
    const stockage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    return cible.protocol === 'https:'
      && cible.host === stockage.host
      && cible.pathname.startsWith('/storage/v1/object/public/logos/')
  } catch {
    return false
  }
}

/** Logo prêt pour le PDF, qui n'affiche que du PNG ou du JPEG, alors que les
 *  logos sont compressés en WebP à l'envoi. Jamais bloquant : sans logo, la
 *  facture sort quand même. */
export async function logoPourPdf(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || !logoUrlAutorisee(url)) return null
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!reponse.ok) {
      logger.warn('facture.logo.fetch_failed', { status: reponse.status })
      return null
    }
    const image = Buffer.from(await reponse.arrayBuffer())
    return await sharp(image)
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
  } catch (e) {
    logger.warn('facture.logo.conversion_failed', {}, e)
    return null
  }
}
