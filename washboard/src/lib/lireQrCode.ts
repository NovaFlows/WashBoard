import jsQR from 'jsqr'

/** Lit le contenu d'un QR code dans une image (capture d'écran), dans le navigateur. Rend
 *  `null` si aucun QR code n'est trouvé. L'image n'est envoyée nulle part.
 *
 *  Une capture de téléphone est grande (1 170 × 2 532 px) : on la réduit à 1 200 px de côté
 *  au plus, assez pour lire le QR code sans faire ramer un vieux téléphone. */
export async function lireQrCode(fichier: File): Promise<string | null> {
  const bitmap = await createImageBitmap(fichier)
  const echelle = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const largeur = Math.round(bitmap.width * echelle)
  const hauteur = Math.round(bitmap.height * echelle)
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close()
  const pixels = ctx.getImageData(0, 0, largeur, hauteur)
  return jsQR(pixels.data, largeur, hauteur, { inversionAttempts: 'attemptBoth' })?.data ?? null
}
