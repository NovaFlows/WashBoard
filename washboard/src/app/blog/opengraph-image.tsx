import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Le blog WashBoard — conseils pour les pros du nettoyage à domicile'

export default function Image() {
  return renderOgImage({ title: 'Conseils pour les pros du nettoyage à domicile', eyebrow: 'Le blog' })
}
