import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

// Image de partage (Open Graph / Twitter) générée à la volée par Next.
//
// Sans image, un article partagé sur LinkedIn, WhatsApp ou X s'affiche comme un
// lien nu — et Google Discover ignore les pages sans visuel. Générer l'image
// depuis le titre évite d'avoir à produire un visuel par article à la main.
//
// Chaque route `opengraph-image.tsx` appelle cette fonction avec son titre.
//
// Habillage refonte 2026 (2026-10-16) : fond papier, Archivo, vrai logo, et
// captures de la nouvelle version (ordinateur + mobile) dans `public/og/`.

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

// Jetons v2 de globals.css (thème clair).
const FOND = '#F6F5F3'
const ENCRE = '#16161A'
const GRIS = '#6B6B76'
const GRIS_CLAIR = '#9A9AA4'
const ACCENT = '#306090'

type ScreenshotSpec = {
  /** Chemin sous `public/`, ex. `/og/agenda-ordinateur.webp`. */
  src: string
  /** `browser` = capture d'écran large (agenda, stats) avec une barre de fenêtre.
   *  `card` = capture verticale ou document (réservation mobile, facture) présentée comme une carte. */
  frame: 'browser' | 'card'
  /** Avec `browser` : capture de la version mobile, posée dans un téléphone
   *  devant la fenêtre — pour montrer les deux versions d'un coup. */
  mobile?: string
  /** Dimensions du cadre. À défaut, une taille standard par type de frame —
   *  à ajuster si le format source (portrait très étroit, document presque
   *  carré...) fait déborder le recadrage `object-fit: cover` et coupe du
   *  texte important (constaté avec la facture, trop large pour le cadre
   *  "card" par défaut : le nom de l'émetteur et le total étaient rognés). */
  width?: number
  height?: number
}

// Satori (le moteur derrière ImageResponse) ne décode pas le WebP : testé en
// passant le fichier tel quel en data URI, le rendu plantait avec
// `TypeError: u2 is not iterable`. On relit donc le fichier depuis `public/`
// et on le réencode en PNG une fois (via sharp, déjà une dépendance du
// projet), en base64 inline. Comme ces pages n'ont pas de paramètre
// dynamique, cette conversion ne tourne qu'au build, pas à chaque visite.
const screenshotCache = new Map<string, string>()

async function screenshotDataUri(relPath: string): Promise<string> {
  const cached = screenshotCache.get(relPath)
  if (cached) return cached
  const absPath = path.join(process.cwd(), 'public', relPath)
  const webp = fs.readFileSync(absPath)
  const png = await sharp(webp).png().toBuffer()
  const uri = `data:image/png;base64,${png.toString('base64')}`
  screenshotCache.set(relPath, uri)
  return uri
}

// Satori ne lit ni le woff2 ni les polices variables : Archivo en TTF statique.
function polices() {
  const lire = (fichier: string) => fs.readFileSync(path.join(process.cwd(), 'public/og', fichier))
  return [
    { name: 'Archivo', data: lire('archivo-500.ttf'), weight: 500 as const, style: 'normal' as const },
    { name: 'Archivo', data: lire('archivo-800.ttf'), weight: 800 as const, style: 'normal' as const },
  ]
}

const OMBRE = '0 30px 60px -18px rgba(22, 22, 26, 0.28), 0 8px 18px -6px rgba(22, 22, 26, 0.12)'

export async function renderOgImage({
  title,
  eyebrow = 'Le blog',
  footer = 'Conseils pour les pros du nettoyage à domicile',
  screenshot,
}: {
  title: string
  eyebrow?: string
  footer?: string
  screenshot?: ScreenshotSpec
}) {
  // Titre long : on réduit la taille plutôt que de le couper.
  // Un peu plus petit quand une capture d'écran partage l'espace.
  const len = title.length
  const fontSize = screenshot
    ? len > 60
      ? 44
      : len > 40
        ? 50
        : 58
    : len > 70
      ? 54
      : len > 45
        ? 62
        : 70

  const [dataUri, mobileUri, logoUri] = await Promise.all([
    screenshot ? screenshotDataUri(screenshot.src) : null,
    screenshot?.mobile ? screenshotDataUri(screenshot.mobile) : null,
    screenshotDataUri('/LogoWashBoard.png'),
  ])
  const duo = screenshot?.frame === 'browser' && !!mobileUri
  const frameWidth = screenshot?.width ?? (duo ? 680 : screenshot?.frame === 'browser' ? 520 : 340)
  const frameHeight = screenshot?.height ?? (duo ? 368 : screenshot?.frame === 'browser' ? 390 : 460)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: FOND,
          color: ENCRE,
          fontFamily: 'Archivo',
          position: 'relative',
        }}
      >
        {/* Colonne de texte */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 0 52px 68px',
            width: screenshot ? (duo ? 500 : 640) : '100%',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUri} alt="" width={54} height={54} style={{ marginRight: 16, borderRadius: 12 }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>WashBoard</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: GRIS, letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 2 }}>
                {eyebrow}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: -1.8,
              maxWidth: screenshot ? (duo ? 440 : 540) : 1000,
              display: 'flex',
            }}
          >
            {title}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', fontSize: duo ? 18 : 20, fontWeight: 500, color: GRIS }}>
            <div style={{ display: 'flex' }}>{footer}</div>
            <div style={{ display: 'flex', marginTop: 8, color: ACCENT, fontWeight: 800, fontSize: 19 }}>washboard.fr</div>
          </div>
        </div>

        {/* Ordinateur + mobile : la fenêtre déborde à droite, le téléphone la chevauche. */}
        {duo && dataUri && mobileUri && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: OG_SIZE.width, height: OG_SIZE.height, display: 'flex' }}>
            <div
              style={{
                position: 'absolute',
                left: 596,
                top: 86,
                width: frameWidth,
                height: frameHeight,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 14,
                overflow: 'hidden',
                background: '#FFFFFF',
                border: '1px solid rgba(22, 22, 26, 0.08)',
                boxShadow: OMBRE,
              }}
            >
              <BarreFenetre />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUri} alt="" width={frameWidth} height={frameHeight - 28} style={{ objectFit: 'cover', objectPosition: 'top left' }} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 524,
                top: 262,
                width: 196,
                height: 330,
                display: 'flex',
                padding: 7,
                borderRadius: 34,
                background: ENCRE,
                boxShadow: OMBRE,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mobileUri} alt="" width={182} height={316} style={{ borderRadius: 27, objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          </div>
        )}

        {/* Capture seule, si fournie */}
        {screenshot && dataUri && !duo && (
          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: frameWidth,
                height: frameHeight,
                borderRadius: 14,
                overflow: 'hidden',
                background: '#FFFFFF',
                border: '1px solid rgba(22, 22, 26, 0.08)',
                boxShadow: OMBRE,
                transform: 'rotate(2deg)',
              }}
            >
              {screenshot.frame === 'browser' && <BarreFenetre />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUri}
                alt=""
                width={frameWidth}
                height={screenshot.frame === 'browser' ? frameHeight - 28 : frameHeight}
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
            </div>
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: polices() },
  )
}

function BarreFenetre() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 28,
        padding: '0 13px',
        background: FOND,
        borderBottom: '1px solid rgba(22, 22, 26, 0.06)',
        flexShrink: 0,
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: 9999, background: GRIS_CLAIR, display: 'flex', marginRight: 6, opacity: 0.55 }} />
      <div style={{ width: 9, height: 9, borderRadius: 9999, background: GRIS_CLAIR, display: 'flex', marginRight: 6, opacity: 0.55 }} />
      <div style={{ width: 9, height: 9, borderRadius: 9999, background: GRIS_CLAIR, display: 'flex', opacity: 0.55 }} />
    </div>
  )
}
