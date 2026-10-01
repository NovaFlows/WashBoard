import { describe, it, expect } from 'vitest'
import { buildSiteJsonLd } from './siteJsonLd'
import { PLAN_CARDS } from './plan'
import { FAQ_ITEMS } from './faq'

const graphe = buildSiteJsonLd('https://exemple.test')
// Le graphe mélange quatre formes d'objet différentes : on passe par
// `Record<string, unknown>` pour pouvoir ensuite re-caster chaque nœud vers
// la forme précise attendue par chaque test, sans que TypeScript ne rejette
// le cast faute de recouvrement structurel entre les quatre types.
const graphNodes = graphe['@graph'] as Array<Record<string, unknown>>
const noeud = (type: string) => graphNodes.find((n) => n['@type'] === type)!

describe('buildSiteJsonLd', () => {
  it('produit un JSON strictement valide', () => {
    const brut = JSON.stringify(graphe)
    expect(() => JSON.parse(brut)).not.toThrow()
    // Aucune entité HTML : c'est le double échappement qui casse les résultats
    // enrichis, et il vient toujours d'un rendu qui ré-échappe le JSON.
    expect(brut).not.toMatch(/&quot;|&amp;|&#/)
  })

  it('déclare le contexte et les entités de marque/produit', () => {
    expect(graphe['@context']).toBe('https://schema.org')
    expect(noeud('Organization')).toBeTruthy()
    expect(noeud('SoftwareApplication')).toBeTruthy()
  })

  it('annonce exactement les prix affichés sur le site', () => {
    const prix = PLAN_CARDS.map(c => c.price).sort((a, b) => a - b)
    const offres = (noeud('SoftwareApplication') as { offers: Record<string, unknown> }).offers
    expect(offres.lowPrice).toBe(String(prix[0]))
    expect(offres.highPrice).toBe(String(prix[prix.length - 1]))
    expect(offres.offerCount).toBe(PLAN_CARDS.length)
    expect(offres.priceCurrency).toBe('EUR')
  })

  it('n’invente aucune note ni aucun avis', () => {
    // Annoncer des étoiles qu'on n'a pas est le motif de sanction le plus
    // courant sur les données structurées.
    const brut = JSON.stringify(graphe)
    expect(brut).not.toContain('aggregateRating')
    expect(brut).not.toContain('reviewCount')
    expect(brut).not.toContain('ratingValue')
  })

  it('relie le logiciel à l’organisation par identifiant', () => {
    const org = noeud('Organization') as { '@id': string }
    const soft = noeud('SoftwareApplication') as { publisher: { '@id': string } }
    expect(soft.publisher['@id']).toBe(org['@id'])
  })

  it('construit les URL propres au site sur le domaine fourni', () => {
    const org = noeud('Organization') as { url: string; logo: { url: string } }
    expect(org.url).toBe('https://exemple.test')
    expect(org.logo.url).toBe('https://exemple.test/LogoWashBoard.png')
  })

  it('ne code en dur le domaine de production nulle part ailleurs', () => {
    // Le filet d'origine : en preview/staging, aucune URL du graphe ne doit
    // retomber sur washboard.fr. Seul `sameAs` y échappe légitimement (profils
    // externes fixes) — on l'écarte, et on vérifie tout le reste du graphe.
    const sansSocial = JSON.parse(JSON.stringify(graphe)) as {
      '@graph': Array<Record<string, unknown>>
    }
    for (const n of sansSocial['@graph']) delete n.sameAs
    expect(JSON.stringify(sansSocial)).not.toContain('washboard.fr')
  })

  it('déclare les comptes sociaux sans les reconstruire depuis le domaine du site', () => {
    // `sameAs` pointe vers des profils externes fixes (Instagram, TikTok...) :
    // contrairement au logo ou à `url`, ils ne dépendent jamais du siteUrl
    // passé en paramètre (utile en preview/staging).
    const org = noeud('Organization') as { sameAs?: string[] }
    expect(org.sameAs).toBeDefined()
    expect(org.sameAs!.length).toBeGreaterThan(0)
    for (const url of org.sameAs!) {
      expect(url).not.toContain('exemple.test')
      expect(url).toMatch(/^https:\/\//)
    }
  })

  it('déclare une entité WebSite reliée à l’organisation', () => {
    const site = noeud('WebSite') as { url: string; name: string; publisher: { '@id': string } }
    const org = noeud('Organization') as { '@id': string }
    expect(site.url).toBe('https://exemple.test')
    expect(site.name).toBe('WashBoard')
    expect(site.publisher['@id']).toBe(org['@id'])
  })

  it('génère le FAQPage à partir de FAQ_ITEMS, sans copie manuelle', () => {
    const faq = noeud('FAQPage') as {
      mainEntity: Array<{ '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }>
    }
    expect(faq.mainEntity).toHaveLength(FAQ_ITEMS.length)
    faq.mainEntity.forEach((entry, i) => {
      expect(entry['@type']).toBe('Question')
      expect(entry.name).toBe(FAQ_ITEMS[i].q)
      expect(entry.acceptedAnswer['@type']).toBe('Answer')
      expect(entry.acceptedAnswer.text).toBe(FAQ_ITEMS[i].a)
    })
  })

  it('déclare les quatre entités attendues dans le graphe', () => {
    const types = graphe['@graph'].map((n: { '@type': string }) => n['@type'])
    expect(types).toEqual(['Organization', 'SoftwareApplication', 'WebSite', 'FAQPage'])
  })
})
