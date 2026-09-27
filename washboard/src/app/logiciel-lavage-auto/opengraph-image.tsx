import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Le logiciel de gestion pour laveur auto mobile — WashBoard'

export default function Image() {
  return renderOgImage({
    title: 'Le logiciel de gestion pour laveur auto mobile',
    eyebrow: 'Lavage auto & detailing mobile',
    footer: 'Le logiciel pensé pour le lavage auto mobile',
    screenshot: { src: '/landing/reservation-clair.webp', frame: 'card' },
  })
}
