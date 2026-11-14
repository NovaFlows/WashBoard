import { describe, expect, it } from 'vitest'
import { resumerPrevisions, symboleDe, type ReponseMet } from './meteo'

describe('symboleDe', () => {
  it.each([
    ['clearsky_day', 'soleil'], ['clearsky_night', 'nuit'], ['fair_day', 'soleil'],
    ['partlycloudy_day', 'peu-nuageux'], ['partlycloudy_night', 'peu-nuageux-nuit'],
    ['cloudy', 'nuageux'], ['fog', 'brouillard'],
    ['lightrain', 'bruine'], ['rain', 'pluie'], ['heavyrain', 'pluie'], ['lightrainshowers_day', 'bruine'], ['rainshowers_day', 'pluie'],
    ['heavyrainandthunder', 'orage'], ['lightssleetshowersandthunder_day', 'orage'],
    ['snow', 'neige'], ['sleet', 'neige'],
    ['', 'nuageux'], [null, 'nuageux'], ['inconnu', 'nuageux'],
  ])('%s → %s', (code, attendu) => {
    expect(symboleDe(code as string | null)).toBe(attendu)
  })
})

const heure = (iso: string) => Number(iso.slice(11, 13)) + 1 // « heure locale » factice : UTC + 1

function serie(debutIso: string, n: number, f: (i: number) => { t: number; code?: string; mm?: number; vent?: number }): ReponseMet {
  const base = Date.parse(debutIso)
  return {
    properties: {
      timeseries: Array.from({ length: n }, (_, i) => {
        const v = f(i)
        return {
          time: new Date(base + i * 3_600_000).toISOString(),
          data: {
            instant: { details: { air_temperature: v.t, ...(v.vent === undefined ? {} : { wind_speed: v.vent }) } },
            next_1_hours: { summary: { symbol_code: v.code ?? 'clearsky_day' }, details: { precipitation_amount: v.mm ?? 0 } },
          },
        }
      }),
    },
  }
}

describe('resumerPrevisions', () => {
  const maintenant = Date.parse('2026-11-14T10:20:00Z')

  it('prend l\'heure en cours, les extrêmes sur 24 h et arrondit', () => {
    const r = serie('2026-11-14T09:00:00Z', 30, i => ({ t: 8.4 + i * 0.5, code: 'partlycloudy_day' }))
    const m = resumerPrevisions(r, maintenant, heure)!
    // 09:00 est passée de plus d'une heure à 10 h 20 : la première prévision retenue est celle de 10:00 (index 1)
    expect(m.temperature).toBe(9) // 8.4 + 0.5 = 8.9
    expect(m.symbole).toBe('peu-nuageux')
    expect(m.min).toBe(9)
    expect(m.max).toBe(20) // fenêtre de 24 h : index 1 à 24 → 8.9 … 20.4
    expect(m.pluieVers).toBeNull()
  })

  it('annonce l\'heure de la première pluie notable dans les 12 prochaines heures', () => {
    const r = serie('2026-11-14T10:00:00Z', 30, i => ({ t: 10, mm: i === 5 ? 1.2 : i === 3 ? 0.1 : 0 }))
    expect(resumerPrevisions(r, maintenant, heure)!.pluieVers).toBe(16) // 15:00Z → 16 h locale
  })

  it('donne le vent en km/h (m/s × 3,6, arrondi), null sans mesure', () => {
    expect(resumerPrevisions(serie('2026-11-14T10:00:00Z', 30, () => ({ t: 10, vent: 3.9 })), maintenant, heure)!.vent).toBe(14)
    expect(resumerPrevisions(serie('2026-11-14T10:00:00Z', 30, () => ({ t: 10 })), maintenant, heure)!.vent).toBeNull()
  })

  it('ignore la pluie de nuit (avant 6 h, dès 22 h)', () => {
    // 10:00Z = 11 h locale ; l'index 12 serait 23 h : hors fenêtre de 12 h, on teste donc avec un décalage horaire
    const nuit = (iso: string) => Number(iso.slice(11, 13)) + 13 // 10:00Z → 23 h locale
    const r = serie('2026-11-14T10:00:00Z', 30, i => ({ t: 10, mm: i === 2 ? 2 : 0 }))
    expect(resumerPrevisions(r, maintenant, nuit)!.pluieVers).toBeNull()
  })

  it('ignore la pluie au-delà de 12 heures', () => {
    const r = serie('2026-11-14T10:00:00Z', 30, i => ({ t: 10, mm: i === 20 ? 3 : 0 }))
    expect(resumerPrevisions(r, maintenant, heure)!.pluieVers).toBeNull()
  })

  it('renvoie null sans données exploitables', () => {
    expect(resumerPrevisions(null, maintenant, heure)).toBeNull()
    expect(resumerPrevisions({}, maintenant, heure)).toBeNull()
    expect(resumerPrevisions({ properties: { timeseries: [] } }, maintenant, heure)).toBeNull()
    expect(resumerPrevisions({ properties: { timeseries: [{ time: '2026-11-14T10:00:00Z', data: {} }] } }, maintenant, heure)).toBeNull()
  })
})
