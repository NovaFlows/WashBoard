import { getArticle } from '@/lib/blog'
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = getArticle('lavage-auto-sans-eau')!.title

export default function Image() {
  return renderOgImage({ title: getArticle('lavage-auto-sans-eau')!.title })
}
