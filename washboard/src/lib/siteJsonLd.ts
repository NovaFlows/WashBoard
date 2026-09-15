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

// URLs des comptes sociaux officiels de WashBoard, pour le `sameAs` de
// l'Organization : elles disent à Google/aux IA que ces comptes et
// washboard.fr décrivent la même entité, ce qui aide à consolider la fiche
// de marque (Knowledge Panel) et la reconnaissance du nom "WashBoard".
//
// Confirmées le 2026-09-15 (Alexandre) : Instagram "washboard.fr" et TikTok
// "wash_board.fr" — deux identifiants différents, c'est voulu, ne pas les
// uniformiser. Pas de paramètre `?lang=` sur l'URL TikTok : on garde l'URL
// canonique du profil, pas une variante localisée.
//
// Seuls ces deux réseaux existent pour l'instant. Ne pas ajouter LinkedIn/
// Facebook/X tant qu'un compte réel n'a pas été créé et confirmé — un
// `sameAs` cassé ou qui pointe vers un compte qui n'appartient pas à
// WashBoard dessert l'entité plus qu'il ne l'aide.
const SOCIAL_SAME_AS: string[] = [
  'https://www.instagram.com/washboard.fr/',
  'https://www.tiktok.com/@wash_board.fr',
]

export function buildSiteJsonLd(siteUrl: string = SITE_URL_FALLBACK) {
  const prix = PLAN_CARDS.map(c => c.price).sort((a, b) => a - b)

  const organisation = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'WashBoard',
    url: siteUrl,
    logo: { '@type': 'ImageObject', url: `${siteUrl}/LogoWashBoard.png` },
    description:
      "Logiciel de gestion pour les pros du nettoyage et de l'entretien à domicile (lavage auto, detailing, ménage, entretien de piscine...) : page de réservation en ligne, agenda, suivi clients et comptabilité.",
    // N'apparaît que si des URLs réelles sont renseignées ci-dessus : un
    // tableau vide ne doit pas se retrouver dans le JSON-LD publié.
    ...(SOCIAL_SAME_AS.length > 0 ? { sameAs: SOCIAL_SAME_AS } : {}),
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
      "L'outil de gestion des pros du nettoyage et de l'entretien à domicile : réservation en ligne sans compte client, créneaux groupés par quartier, relances et avis automatiques, comptabilité.",
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
