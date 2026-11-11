import { describe, it, expect } from 'vitest'
import { POLITIQUE_PROTECTION, positionFiligrane, signerJetonLecture, texteFiligrane, verifierJetonLecture } from './formationProtection'

const SECRET = 'secret-de-test-assez-long-pour-hmac'
const T0 = new Date('2026-11-11T10:00:00Z')

describe('jeton de lecture', () => {
  it('un jeton signé est accepté, avec son laveur et sa leçon', () => {
    const jeton = signerJetonLecture({ userId: 'u-1', leconId: 'l-2-2', secret: SECRET, maintenant: T0 })
    const r = verifierJetonLecture(jeton, { secret: SECRET, maintenant: new Date(T0.getTime() + 30_000) })
    expect(r).toMatchObject({ ok: true, userId: 'u-1', leconId: 'l-2-2' })
  })
  it('expire après la durée prévue', () => {
    const jeton = signerJetonLecture({ userId: 'u-1', leconId: 'l-1-1', secret: SECRET, maintenant: T0 })
    const apres = new Date(T0.getTime() + (POLITIQUE_PROTECTION.dureeJetonSec + 1) * 1000)
    expect(verifierJetonLecture(jeton, { secret: SECRET, maintenant: apres })).toEqual({ ok: false, raison: 'expire' })
  })
  it('refuse un autre secret', () => {
    const jeton = signerJetonLecture({ userId: 'u-1', leconId: 'l-1-1', secret: SECRET, maintenant: T0 })
    expect(verifierJetonLecture(jeton, { secret: 'autre-secret', maintenant: T0 })).toEqual({ ok: false, raison: 'signature' })
  })
  it('refuse une charge modifiée : on ne change ni de laveur ni de leçon', () => {
    const jeton = signerJetonLecture({ userId: 'u-1', leconId: 'l-1-1', secret: SECRET, maintenant: T0 })
    const [, signature] = jeton.split('.')
    const forge = Buffer.from(JSON.stringify({ u: 'u-2', l: 'l-1-1', e: 9999999999 })).toString('base64url')
    expect(verifierJetonLecture(`${forge}.${signature}`, { secret: SECRET, maintenant: T0 })).toEqual({ ok: false, raison: 'signature' })
  })
  it('refuse ce qui n’a pas la forme d’un jeton, sans lever d’erreur', () => {
    for (const mauvais of [undefined, null, 42, '', 'abc', 'a.b.c', '.', 'a.', '.b']) {
      expect(verifierJetonLecture(mauvais, { secret: SECRET, maintenant: T0 }).ok).toBe(false)
    }
  })
  it('une signature de mauvaise longueur ne fait pas planter la comparaison', () => {
    const jeton = signerJetonLecture({ userId: 'u-1', leconId: 'l-1-1', secret: SECRET, maintenant: T0 })
    const [charge] = jeton.split('.')
    expect(verifierJetonLecture(`${charge}.court`, { secret: SECRET, maintenant: T0 })).toEqual({ ok: false, raison: 'signature' })
  })
})

describe('filigrane', () => {
  it('dit qui regarde et quand', () => {
    expect(texteFiligrane({ email: 'laveur@exemple.fr', userId: '12345678-aaaa-bbbb', maintenant: T0 })).toBe('laveur@exemple.fr · 12345678 · 2026-11-11 10:00')
  })
  it('la position est stable pour un même instant et change d’un pas à l’autre', () => {
    expect(positionFiligrane(100)).toEqual(positionFiligrane(100 + 1))
    const positions = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(positionFiligrane(i * POLITIQUE_PROTECTION.deplacementFiligraneSec))))
    expect(positions.size).toBeGreaterThan(10)
  })
  it('reste à l’intérieur de la zone vidéo, loin des bords', () => {
    for (let i = 0; i < 200; i++) {
      const { x, y } = positionFiligrane(i * POLITIQUE_PROTECTION.deplacementFiligraneSec)
      expect(x).toBeGreaterThanOrEqual(8); expect(x).toBeLessThanOrEqual(68)
      expect(y).toBeGreaterThanOrEqual(8); expect(y).toBeLessThanOrEqual(84)
    }
  })
})
