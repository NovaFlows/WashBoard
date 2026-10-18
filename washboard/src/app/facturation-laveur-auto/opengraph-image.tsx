import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Logiciel de facturation pour laveur auto mobile — WashBoard'

export default function Image() {
  return renderOgImage({
    title: 'Logiciel de facturation pour laveur auto mobile',
    eyebrow: 'Lavage auto & detailing mobile',
    footer: 'Factures conformes, créées à la fin de chaque rendez-vous',
  })
}
