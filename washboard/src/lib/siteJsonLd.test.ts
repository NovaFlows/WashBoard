import { describe, it, expect } from 'vitest'
import { buildSiteJsonLd } from './siteJsonLd'
import { PLAN_CARDS } from './plan'

const graphe = buildSiteJsonLd('https://exemple.test')
const noeud = (type: string) =>
  graphe['@graph'].find((n: { '@type': string }) => n['@type'] === type)!

describe('buildSiteJsonLd', () => {
  it('produit un JSON strictement valide', () => {
    const brut = JSON.stringify(graphe)
    expect(() => JSON.parse(brut)).not.toThrow()
    // Aucune entité HTML : c'est le double échappement qui casse les résultats
    // enrichis, et il vient toujours d'un rendu qui ré-échappe le JSON.
    expect(brut).not.toMatch(/&quot;|&amp;|&#/)
  })

  it('déclare le contexte et les deux entités attendues', () => {
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

  it('construit toutes les URL sur le domaine fourni', () => {
    const brut = JSON.stringify(graphe)
    expect(brut).toContain('https://exemple.test/LogoWashBoard.png')
    expect(brut).not.toContain('washboard.fr')
  })
})
