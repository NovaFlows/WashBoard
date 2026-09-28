import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Meilleur logiciel de gestion pour laveur auto mobile — comparatif WashBoard'

export default function Image() {
  return renderOgImage({
    title: 'Meilleur logiciel de gestion pour laveur auto mobile',
    eyebrow: 'Comparatif',
    footer: 'WhatsApp, Excel, Calendly… ou un logiciel dédié',
    screenshot: { src: '/landing/crm-clair.webp', frame: 'browser' },
  })
}
