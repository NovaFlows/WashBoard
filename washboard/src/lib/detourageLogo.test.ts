import { describe, it, expect } from 'vitest'
import { analyserBord, cadrer, partVisible, retirerFondUni, type Pixels } from './detourageLogo'

type RVBA = [number, number, number, number]

function image(width: number, height: number, fond: RVBA, dessin: (x: number, y: number) => RVBA | null = () => null): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = dessin(x, y) ?? fond
      data.set(c, (y * width + x) * 4)
    }
  }
  return { data, width, height }
}
const px = (p: Pixels, x: number, y: number) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4))

const BLANC: RVBA = [255, 255, 255, 255]
const NOIR: RVBA = [0, 0, 0, 255]
const BLEU: RVBA = [30, 80, 200, 255]
const TRANSPARENT: RVBA = [0, 0, 0, 0]

// Écusson bleu (10..29) avec une lettre blanche au centre (18..21), sur fond blanc.
const ecusson = (x: number, y: number): RVBA | null => {
  if (x >= 18 && x <= 21 && y >= 18 && y <= 21) return BLANC
  if (x >= 10 && x <= 29 && y >= 10 && y <= 29) return BLEU
  return null
}

describe('analyserBord', () => {
  it('reconnaît un logo déjà détouré', () => {
    expect(analyserBord(image(40, 40, TRANSPARENT, ecusson)).methode).toBe('deja-detoure')
  })

  it('reconnaît un fond uni, même légèrement bruité (JPEG)', () => {
    const p = image(40, 40, BLANC, (x, y) => ecusson(x, y) ?? ((x + y) % 3 === 0 ? [248, 250, 247, 255] : null))
    const a = analyserBord(p)
    expect(a.methode).toBe('fond-uni')
    if (a.methode === 'fond-uni') expect(a.fond.every(c => c > 240)).toBe(true)
  })

  it('laisse le modèle aux fonds dégradés', () => {
    const p = image(40, 40, BLANC, x => [x * 6, 255 - x * 6, 128, 255])
    expect(analyserBord(p).methode).toBe('ia')
  })
})

describe('retirerFondUni', () => {
  it('retire le fond relié au bord sans toucher au dessin', () => {
    const p = image(40, 40, BLANC, ecusson)
    retirerFondUni(p, [255, 255, 255])
    expect(px(p, 0, 0)[3]).toBe(0)
    expect(px(p, 5, 35)[3]).toBe(0)
    expect(px(p, 12, 12)).toEqual(BLEU)
  })

  it('retire le creux d’une lettre, enfermé dans le dessin', () => {
    // Un « O » noir de 30 px sur fond blanc : son centre blanc doit laisser voir la page.
    const o = (x: number, y: number): RVBA | null => {
      const d = Math.hypot(x - 50, y - 50)
      return d <= 15 && d >= 11 ? NOIR : null
    }
    const p = image(100, 100, BLANC, o)
    expect(retirerFondUni(p, [255, 255, 255])).toBe(1)
    expect(px(p, 50, 50)[3]).toBe(0)
    expect(px(p, 50, 37)).toEqual(NOIR)
  })

  it('garde un texte blanc posé au milieu d’un écusson', () => {
    // Petite zone blanche loin de l'extérieur : une vraie partie du dessin, pas un creux.
    const ecu = (x: number, y: number): RVBA | null => {
      if (x >= 48 && x <= 52 && y >= 48 && y <= 52) return BLANC
      return Math.hypot(x - 50, y - 50) <= 40 ? BLEU : null
    }
    const p = image(100, 100, BLANC, ecu)
    expect(retirerFondUni(p, [255, 255, 255])).toBe(0)
    expect(px(p, 50, 50)).toEqual(BLANC)
  })

  it('garde une grande surface enfermée (panneau blanc)', () => {
    const cadre = (x: number, y: number): RVBA | null => {
      if (x >= 10 && x <= 89 && y >= 10 && y <= 89) return x <= 12 || x >= 87 || y <= 12 || y >= 87 ? NOIR : BLANC
      return null
    }
    const p = image(100, 100, BLANC, cadre)
    expect(retirerFondUni(p, [255, 255, 255])).toBe(0)
    expect(px(p, 50, 50)).toEqual(BLANC)
  })

  it('sans les creux : tout ce qui est enfermé reste', () => {
    const o = (x: number, y: number): RVBA | null => {
      const d = Math.hypot(x - 50, y - 50)
      return d <= 15 && d >= 11 ? NOIR : null
    }
    const p = image(100, 100, BLANC, o)
    expect(retirerFondUni(p, [255, 255, 255], { creux: false })).toBe(0)
    expect(px(p, 50, 50)).toEqual(BLANC)
    expect(px(p, 0, 0)[3]).toBe(0)
  })

  it('adoucit un bord lissé au lieu de laisser un liseré du fond', () => {
    // Pixel gris clair entre le fond blanc et le dessin noir.
    const p = image(20, 20, BLANC, (x, y) => (x >= 8 && x <= 12 && y >= 8 && y <= 12 ? NOIR : x === 7 && y === 10 ? [200, 200, 200, 255] : null))
    retirerFondUni(p, [255, 255, 255])
    const [r, , , a] = px(p, 7, 10)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(255)
    expect(r).toBeLessThan(200)
    expect(px(p, 10, 10)).toEqual(NOIR)
  })

  it('fond noir : même chose', () => {
    const p = image(40, 40, NOIR, ecusson)
    retirerFondUni(p, [0, 0, 0])
    expect(px(p, 0, 0)[3]).toBe(0)
    expect(px(p, 12, 12)).toEqual(BLEU)
  })
})

describe('cadrer', () => {
  it('serre le cadre autour du dessin, avec une marge', () => {
    const p = image(100, 100, TRANSPARENT, (x, y) => (x >= 40 && x <= 59 && y >= 45 && y <= 54 ? NOIR : null))
    const c = cadrer(p)!
    expect(c.x).toBeLessThanOrEqual(40)
    expect(c.x).toBeGreaterThanOrEqual(36)
    expect(c.x + c.width).toBeGreaterThanOrEqual(60)
    expect(c.width).toBeLessThan(30)
    expect(c.height).toBeLessThan(20)
  })

  it('ne sort jamais de l’image', () => {
    const p = image(30, 30, TRANSPARENT, (x, y) => (x === 0 && y === 0) || (x === 29 && y === 29) ? NOIR : null)
    expect(cadrer(p)).toEqual({ x: 0, y: 0, width: 30, height: 30 })
  })

  it('rend null quand rien n’est visible', () => {
    expect(cadrer(image(10, 10, TRANSPARENT))).toBeNull()
  })
})

describe('partVisible', () => {
  it('mesure la part de pixels visibles', () => {
    expect(partVisible(image(10, 10, TRANSPARENT, (x) => (x < 5 ? NOIR : null)))).toBe(0.5)
  })
})
