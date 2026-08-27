import { describe, it, expect } from 'vitest'
import { detectDevice, extractReferrerHost } from './funnelTracking'

describe('detectDevice', () => {
  it('classe en mobile sous 640px', () => {
    expect(detectDevice(375)).toBe('mobile')
    expect(detectDevice(639)).toBe('mobile')
  })

  it('classe en tablet entre 640 et 1023px', () => {
    expect(detectDevice(640)).toBe('tablet')
    expect(detectDevice(1023)).toBe('tablet')
  })

  it('classe en desktop à partir de 1024px', () => {
    expect(detectDevice(1024)).toBe('desktop')
    expect(detectDevice(1920)).toBe('desktop')
  })
})

describe('extractReferrerHost', () => {
  it('retourne undefined si le referrer est vide', () => {
    expect(extractReferrerHost('', 'www.washboard.fr')).toBeUndefined()
  })

  it('retourne undefined si le referrer est le même site (navigation interne)', () => {
    expect(extractReferrerHost('https://www.washboard.fr/dashboard', 'www.washboard.fr')).toBeUndefined()
  })

  it('extrait le host pour un referrer externe', () => {
    expect(extractReferrerHost('https://www.google.com/search?q=laveur', 'www.washboard.fr')).toBe('www.google.com')
    expect(extractReferrerHost('https://www.instagram.com/', 'www.washboard.fr')).toBe('www.instagram.com')
  })

  it('ne fuite jamais le chemin ou les paramètres de la query', () => {
    const host = extractReferrerHost('https://www.google.com/search?q=email@example.com', 'www.washboard.fr')
    expect(host).toBe('www.google.com')
  })

  it('retourne undefined pour un referrer malformé plutôt que de lever une exception', () => {
    expect(extractReferrerHost('pas-une-url', 'www.washboard.fr')).toBeUndefined()
  })
})
