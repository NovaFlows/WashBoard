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

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const ACCENT = '#00C4D4'

type ScreenshotSpec = {
  /** Chemin sous `public/`, ex. `/landing/calendrier-clair.webp`. */
  src: string
  /** `browser` = capture d'écran large (calendrier, stats) avec une barre de fenêtre.
   *  `card` = capture verticale ou document (réservation mobile, facture) présentée comme une carte. */
  frame: 'browser' | 'card'
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
      ? 42
      : len > 40
        ? 48
        : 56
    : len > 70
      ? 52
      : len > 45
        ? 60
        : 68

  const dataUri = screenshot ? await screenshotDataUri(screenshot.src) : null
  const frameWidth = screenshot?.width ?? (screenshot?.frame === 'browser' ? 500 : 340)
  const frameHeight = screenshot?.height ?? (screenshot?.frame === 'browser' ? 380 : 460)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #09111E 0%, #101C3A 55%, #1651E8 130%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Halo décoratif : un dégradé radial suffit à donner de la profondeur
            sans `filter: blur()` — non fiable avec ce moteur (bords sombres
            constatés au rendu PNG). */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: screenshot ? -80 : -140,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: `radial-gradient(circle at 32% 32%, ${ACCENT}55 0%, ${ACCENT}00 70%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -220,
            left: -140,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: '#1651E855',
            display: 'flex',
          }}
        />

        {/* Colonne de texte */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 0 56px 72px',
            width: screenshot ? 660 : '100%',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'linear-gradient(155deg, #3B78FF 0%, #1651E8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 800,
                marginRight: 16,
              }}
            >
              W
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>WashBoard</div>
              <div style={{ fontSize: 18, color: ACCENT, letterSpacing: 2.5, textTransform: 'uppercase' }}>
                {eyebrow}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ width: 6, borderRadius: 3, background: ACCENT, display: 'flex', marginRight: 24, flexShrink: 0 }} />
            <div
              style={{
                fontSize,
                fontWeight: 800,
                lineHeight: 1.14,
                letterSpacing: -1.2,
                maxWidth: screenshot ? 560 : 980,
                display: 'flex',
              }}
            >
              {title}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 21, color: '#B9C6EE' }}>
            <div style={{ display: 'flex' }}>{footer}</div>
            <div style={{ display: 'flex', marginTop: 10, color: '#5E76B8', fontSize: 18 }}>washboard.fr</div>
          </div>
        </div>

        {/* Colonne visuelle : capture d'écran réelle du produit, si fournie */}
        {screenshot && dataUri && (
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
                borderRadius: 16,
                overflow: 'hidden',
                background: '#F1F5F9',
                boxShadow: '0 40px 80px -20px rgba(3, 7, 18, 0.65)',
                transform: 'rotate(3deg)',
              }}
            >
              {screenshot.frame === 'browser' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 30,
                    padding: '0 14px',
                    background: '#E2E8F0',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 9999, background: '#F87171', display: 'flex', marginRight: 7 }} />
                  <div style={{ width: 10, height: 10, borderRadius: 9999, background: '#FBBF24', display: 'flex', marginRight: 7 }} />
                  <div style={{ width: 10, height: 10, borderRadius: 9999, background: '#34D399', display: 'flex' }} />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUri}
                alt=""
                width={frameWidth}
                height={screenshot.frame === 'browser' ? frameHeight - 30 : frameHeight}
                style={{ objectFit: 'cover', objectPosition: 'top' }}
              />
            </div>
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE },
  )
}
