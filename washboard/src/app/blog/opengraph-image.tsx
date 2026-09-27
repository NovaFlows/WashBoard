import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/ogImage'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Le blog WashBoard — lavage auto & detailing'

export default function Image() {
  // Titre et pied de page alignés sur le recentrage automobile du
  // 2026-09-27 (le H1 et le <title> de /blog ont changé ce jour-là, cette
  // image ne les avait pas suivis) : voir src/app/blog/page.tsx. Le pied de
  // page par défaut de renderOgImage ("Conseils pour les pros du nettoyage à
  // domicile") reste volontairement inchangé pour les 14 articles
  // individuels : décision séparée, pas prise ici.
  return renderOgImage({
    title: 'Lavage auto & detailing : les conseils du blog',
    eyebrow: 'Le blog',
    footer: 'Et les autres métiers mobiles, aussi',
  })
}
