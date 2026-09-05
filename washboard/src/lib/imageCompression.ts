// Réduction des images avant envoi.
//
// Pourquoi : un logo est servi à CHAQUE visiteur de la page de réservation.
// Celui d'un client pesait 1,9 Mo et un autre 4 Mo, stockés tels quels. Pendant
// une semaine de trafic TikTok (~800 visiteurs), cela a suffi à dépasser de
// 60 % le quota mensuel de bande passante Supabase — et à mettre le projet
// sous menace de restriction (constaté le 2026-09-05).
//
// Un logo s'affiche au plus sur 200 pixels de large. Le réduire ne coûte
// aucune qualité visible et divise son poids par vingt.

/** Côté le plus long, en pixels, au-delà duquel l'image est réduite. */
export type CompressionOptions = {
  maxSide: number
  /** Qualité JPEG/WebP entre 0 et 1. Ignoré pour le PNG. */
  quality: number
  type: 'image/webp' | 'image/jpeg' | 'image/png'
}

export const LOGO_OPTIONS: CompressionOptions = {
  // Large de côté pour rester net sur les écrans à forte densité, où un logo
  // de 200 points occupe 400 à 600 pixels réels.
  maxSide: 600,
  quality: 0.9,
  type: 'image/webp',
}

export const BACKGROUND_OPTIONS: CompressionOptions = {
  maxSide: 1920,
  quality: 0.82,
  type: 'image/webp',
}

/** Dimensions après réduction, en conservant les proportions.
 *
 *  Une image déjà plus petite que la limite n'est jamais agrandie : on ne
 *  fabrique pas des pixels qui n'existent pas. */
export function scaledDimensions(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const plusGrand = Math.max(width, height)
  if (plusGrand <= maxSide || plusGrand === 0) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const facteur = maxSide / plusGrand
  return {
    width: Math.max(1, Math.round(width * facteur)),
    height: Math.max(1, Math.round(height * facteur)),
  }
}

/** Réduit et recompresse une image dans le navigateur.
 *
 *  Renvoie le fichier d'origine si la compression échoue ou n'apporte rien :
 *  mieux vaut envoyer une image lourde qu'empêcher quelqu'un de mettre son
 *  logo. */
export async function compressImage(file: File, options: CompressionOptions): Promise<File> {
  if (typeof document === 'undefined') return file
  if (!file.type.startsWith('image/')) return file
  // Les SVG sont déjà légers et vectoriels : les passer dans un canvas les
  // transformerait en pixels, ce qui les alourdirait et les flouterait.
  if (file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height, options.maxSide)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, options.type, options.quality))
    if (!blob) return file

    // Une image déjà bien optimisée peut ressortir plus lourde du canvas :
    // on garde alors l'originale.
    if (blob.size >= file.size) return file

    const nom = file.name.replace(/\.[^.]+$/, '') + (options.type === 'image/webp' ? '.webp' : '.jpg')
    return new File([blob], nom, { type: options.type })
  } catch {
    return file
  }
}
