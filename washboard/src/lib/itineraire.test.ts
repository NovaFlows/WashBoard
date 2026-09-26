import { describe, expect, it } from 'vitest'
import { applicationsItineraire, detecterPlateforme } from '@/lib/itineraire'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

describe('detecterPlateforme', () => {
  it('reconnaît un iPhone', () => {
    expect(detecterPlateforme(IPHONE)).toBe('ios')
  })

  it('reconnaît un Android', () => {
    expect(detecterPlateforme(ANDROID)).toBe('android')
  })

  it('reconnaît un iPad qui se présente comme un Mac (iPadOS 13+)', () => {
    expect(detecterPlateforme(MAC, 'MacIntel', 5)).toBe('ios')
  })

  it('ne prend pas un vrai Mac pour un iPad', () => {
    expect(detecterPlateforme(MAC, 'MacIntel', 0)).toBe('autre')
  })

  it('classe un ordinateur Windows en « autre »', () => {
    expect(detecterPlateforme(WINDOWS, 'Win32', 0)).toBe('autre')
  })

  it('reste sûr sans information', () => {
    expect(detecterPlateforme('')).toBe('autre')
  })
})

describe('applicationsItineraire', () => {
  const adresse = "52 Rue d'Enghien, 95600 Eaubonne, France"

  it('propose Plans, Waze puis Google Maps sur iPhone', () => {
    expect(applicationsItineraire(adresse, 'ios').map(a => a.id)).toEqual(['plans', 'waze', 'google'])
  })

  it('ne propose JAMAIS Plans sur Android', () => {
    const ids = applicationsItineraire(adresse, 'android').map(a => a.id)
    expect(ids).toEqual(['google', 'waze'])
    expect(ids).not.toContain('plans')
  })

  it('ne propose pas Plans sur ordinateur non plus', () => {
    expect(applicationsItineraire(adresse, 'autre').map(a => a.id)).not.toContain('plans')
  })

  it('encode l’adresse (apostrophe, virgules, accents) dans chaque lien', () => {
    const codee = encodeURIComponent(adresse)
    for (const app of applicationsItineraire(adresse, 'ios')) {
      expect(app.lien).toContain(codee)
      expect(app.lien).not.toContain(' ')
    }
  })

  it('construit les liens universels attendus', () => {
    const [plans, waze, google] = applicationsItineraire('Paris', 'ios')
    expect(plans.lien).toBe('https://maps.apple.com/?daddr=Paris&dirflg=d')
    expect(waze.lien).toBe('https://waze.com/ul?q=Paris&navigate=yes')
    expect(google.lien).toBe('https://www.google.com/maps/dir/?api=1&destination=Paris&travelmode=driving')
  })
})
