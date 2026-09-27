import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'WashBoard — logiciel de lavage, nettoyage auto & detailing à domicile'

export default function Image() {
  return renderOgImage({
    title: 'Logiciel de lavage, nettoyage auto & detailing à domicile',
    eyebrow: 'Nettoyage & entretien automobile',
    footer: 'Réservation, planning, facturation — un seul outil',
    screenshot: { src: '/landing/calendrier-clair.webp', frame: 'browser' },
  })
}
