import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Optimiser sa tournée de lavage auto mobile — WashBoard'

export default function Image() {
  return renderOgImage({
    title: 'Le trajet mange une prestation par jour',
    eyebrow: 'Optimisation de tournée',
    footer: 'Créneaux groupés au temps de trajet réel — WashBoard',
    screenshot: { src: '/landing/calendrier-clair.webp', frame: 'browser' },
  })
}
