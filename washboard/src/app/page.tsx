import LandingPage from '@/components/landing/LandingPage'
import { buildSiteJsonLd } from '@/lib/siteJsonLd'

export default function Home() {
  // Injecte cote serveur : les donnees structurees doivent etre dans le HTML
  // initial, sinon un robot qui n execute pas le JavaScript ne les voit jamais.
  const jsonLd = buildSiteJsonLd()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
