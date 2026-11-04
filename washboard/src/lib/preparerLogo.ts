// Préparation d'un logo avant envoi, dans le navigateur : détourage adapté à l'image
// (voir `detourageLogo.ts`), cadrage serré, puis réduction (`compressImage`).
// Partagé par l'écran Apparence (`useApparenceV2`) et l'inscription (`Onboarding`).

import { analyserBord, cadrer, partVisible, retirerFondUni, type Pixels } from '@/lib/detourageLogo'
import { compressImage, LOGO_OPTIONS } from '@/lib/imageCompression'
import { envoyerImage } from '@/lib/apparenceApi'
import { retirerLeFond } from '@/hooks/retirerLeFond'

/** Côté le plus long pendant le traitement : au-delà, le calcul sur les pixels est lent
 *  sur téléphone pour rien, l'image finale ne dépasse pas `LOGO_OPTIONS.maxSide`. */
const COTE_TRAITEMENT = 1200
/** Un détourage qui laisse moins que cela a effacé le logo : on garde l'image d'origine. */
const PART_VISIBLE_MIN = 0.005

/** `complet` : fond et creux des lettres retirés ; `sans-creux` : seulement le fond autour
 *  (le laveur a vu disparaître une partie de son logo) ; `original` : l'image telle quelle. */
export type ModeLogo = 'complet' | 'sans-creux' | 'original'

export type Retouches = { fondRetire: boolean; creuxRetires: boolean }

export type ResultatLogo =
  | ({ ok: true; url: string } & Retouches)
  | { ok: false; etape: 'detourage' | 'envoi'; message: string | null; erreur?: unknown }

async function lirePixels(source: Blob): Promise<Pixels> {
  const bitmap = await createImageBitmap(source)
  const f = Math.min(1, COTE_TRAITEMENT / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * f)), height = Math.max(1, Math.round(bitmap.height * f))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas indisponible')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return { data: ctx.getImageData(0, 0, width, height).data, width, height }
}

async function enPng(p: Pixels): Promise<Blob> {
  const cadre = cadrer(p) ?? { x: 0, y: 0, width: p.width, height: p.height }
  const plein = document.createElement('canvas')
  plein.width = p.width
  plein.height = p.height
  plein.getContext('2d')!.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.width, p.height), 0, 0)
  const canvas = document.createElement('canvas')
  canvas.width = cadre.width
  canvas.height = cadre.height
  canvas.getContext('2d')!.drawImage(plein, cadre.x, cadre.y, cadre.width, cadre.height, 0, 0, cadre.width, cadre.height)
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('export impossible')
  return blob
}

const TEL_QUEL: Retouches = { fondRetire: false, creuxRetires: false }

/** Image prête à réduire, et ce qui y a été retiré (pour proposer de revenir en arrière). */
export async function preparerLogo(fichier: File, mode: ModeLogo): Promise<{ image: Blob } & Retouches> {
  // Un SVG est vectoriel : le passer en pixels le dégraderait (voir `compressImage`).
  if (mode === 'original' || fichier.type === 'image/svg+xml') return { image: fichier, ...TEL_QUEL }

  const pixels = await lirePixels(fichier)
  const analyse = analyserBord(pixels)
  if (analyse.methode === 'deja-detoure') return { image: await enPng(pixels), ...TEL_QUEL }
  if (analyse.methode === 'fond-uni') {
    const copie = { ...pixels, data: new Uint8ClampedArray(pixels.data) }
    const creux = retirerFondUni(copie, analyse.fond, { creux: mode === 'complet' })
    if (partVisible(copie) >= PART_VISIBLE_MIN) return { image: await enPng(copie), fondRetire: true, creuxRetires: creux > 0 }
    return { image: fichier, ...TEL_QUEL }
  }
  const detoure = await lirePixels(await retirerLeFond(fichier))
  if (partVisible(detoure) >= PART_VISIBLE_MIN) return { image: await enPng(detoure), fondRetire: true, creuxRetires: false }
  return { image: fichier, ...TEL_QUEL }
}

/** Prépare, réduit et envoie le logo. `onEnvoi` : la préparation est finie, l'envoi commence. */
export async function preparerEtEnvoyerLogo(fichier: File, mode: ModeLogo, onEnvoi: () => void): Promise<ResultatLogo> {
  let prepare: { image: Blob } & Retouches
  try {
    prepare = await preparerLogo(fichier, mode)
  } catch (erreur) {
    return { ok: false, etape: 'detourage', message: null, erreur }
  }
  onEnvoi()
  const source = prepare.image instanceof File ? prepare.image : new File([prepare.image], 'logo.png', { type: 'image/png' })
  const reduit = await compressImage(source, LOGO_OPTIONS)
  const r = await envoyerImage('logo', reduit)
  if (!r.ok) return { ok: false, etape: 'envoi', message: r.message }
  return { ok: true, url: r.data, fondRetire: prepare.fondRetire, creuxRetires: prepare.creuxRetires }
}
