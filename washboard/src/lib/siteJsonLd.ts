import { PLAN_CARDS, SITE_URL_FALLBACK } from '@/lib/plan'

// Données structurées de la page d'accueil (schema.org).
//
// Elles décrivent à Google ce qu'est WashBoard : une organisation, et un
// logiciel avec une gamme de prix. C'est ce qui permet d'afficher un panneau
// de marque et les tarifs directement dans les résultats de recherche.
//
// Les prix sont DÉRIVÉS de PLAN_CARDS, jamais recopiés : annoncer un tarif
// différent de celui affiché sur la page ferait retirer les résultats
// enrichis. Changer un prix dans plan.ts suffit à mettre ceci à jour.
//
// Volontairement absent : `aggregateRating`. Nous n'avons pas d'avis clients
// vérifiables, et en inventer est précisément ce qui fait sanctionner un site.

export function buildSiteJsonLd(siteUrl: string = SITE_URL_FALLBACK) {
  const prix = PLAN_CARDS.map(c => c.price).sort((a, b) => a - b)

  const organisation = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'WashBoard',
    url: siteUrl,
    logo: { '@type': 'ImageObject', url: `${siteUrl}/LogoWashBoard.png` },
    description:
      'Logiciel de gestion pour laveurs auto mobiles : page de réservation en ligne, agenda, suivi clients et comptabilité.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      telephone: '+33684140438',
      email: 'novaflows.pro@gmail.com',
      areaServed: 'FR',
      availableLanguage: 'French',
    },
  }

  const logiciel = {
    '@type': 'SoftwareApplication',
    '@id': `${siteUrl}/#software`,
    name: 'WashBoard',
    url: siteUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'fr-FR',
    description:
      "L'outil de gestion des laveurs auto mobiles : réservation en ligne sans compte client, créneaux groupés par quartier, relances et avis automatiques, comptabilité.",
    publisher: { '@id': `${siteUrl}/#organization` },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: String(prix[0]),
      highPrice: String(prix[prix.length - 1]),
      offerCount: prix.length,
      availability: 'https://schema.org/InStock',
    },
  }

  return { '@context': 'https://schema.org', '@graph': [organisation, logiciel] }
}
