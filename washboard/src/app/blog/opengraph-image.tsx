import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Le blog WashBoard — conseils pour laveurs auto mobiles'

export default function Image() {
  return renderOgImage({ title: 'Conseils pour laveurs auto mobiles', eyebrow: 'Le blog' })
}
