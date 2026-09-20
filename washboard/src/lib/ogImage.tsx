import { ImageResponse } from 'next/og'

// Image de partage (Open Graph / Twitter) générée à la volée par Next.
//
// Sans image, un article partagé sur LinkedIn, WhatsApp ou X s'affiche comme un
// lien nu — et Google Discover ignore les pages sans visuel. Générer l'image
// depuis le titre évite d'avoir à produire un visuel par article à la main.
//
// Chaque route `opengraph-image.tsx` appelle cette fonction avec son titre.

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export function renderOgImage({ title, eyebrow = 'Le blog' }: { title: string; eyebrow?: string }) {
  // Titre long : on réduit la taille plutôt que de le couper.
  const fontSize = title.length > 70 ? 52 : title.length > 45 ? 60 : 68

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #0B1220 0%, #101C3A 55%, #1651E8 140%)',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#1651E8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            W
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>WashBoard</div>
            <div style={{ fontSize: 20, color: '#9DB4FF', letterSpacing: 2, textTransform: 'uppercase' }}>
              {eyebrow}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: -1.5,
            maxWidth: 1000,
            display: 'flex',
          }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: '#C7D4FF' }}>
          <div style={{ display: 'flex' }}>Conseils pour les pros du nettoyage à domicile</div>
          <div style={{ display: 'flex' }}>washboard.fr</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  )
}
