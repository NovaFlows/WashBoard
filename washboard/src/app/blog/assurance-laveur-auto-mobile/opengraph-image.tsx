import { getArticle, THEME_LABEL } from '@/lib/blog'
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

const article = getArticle('assurance-laveur-auto-mobile')!

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = article.title

export default function Image() {
  return renderOgImage({ title: article.title, eyebrow: THEME_LABEL[article.theme] })
}
