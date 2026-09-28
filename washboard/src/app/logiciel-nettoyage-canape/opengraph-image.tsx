import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Le logiciel de gestion pour le nettoyage de canapés à domicile — WashBoard'

export default function Image() {
  return renderOgImage({
    title: 'Le logiciel de gestion pour le nettoyage de canapés à domicile',
    eyebrow: 'Canapés, matelas & textiles à domicile',
    footer: 'Le logiciel pensé pour le nettoyage de canapés à domicile',
    // facture-demo.webp est presque carré (1100×980) : le cadre "card" par
    // défaut (340×460, portrait étroit) rognait le nom de l'émetteur et le
    // total sur les côtés. Cadre élargi pour coller à son format réel.
    screenshot: { src: '/landing/facture-demo.webp', frame: 'card', width: 440, height: 400 },
  })
}
