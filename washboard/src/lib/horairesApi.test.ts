import { describe, it, expect, vi, afterEach } from 'vitest'
import { ajouterPlages, creerPlage, retirerPlage } from './horairesApi'
import { phraseEchecAjout, unSeulALaFois } from './horaires'

afterEach(() => vi.unstubAllGlobals())

const reponse = (status: number, corps?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => { if (corps === undefined) throw new Error('vide'); return corps } }) as Response

const ligne = (jour: number) => ({ id: `a-${jour}`, washer_id: 'w', day_of_week: jour, start_time: '08:00', end_time: '18:00' })

/** Un faux serveur : répond selon le jour du corps POSTé. */
function serveur(echecs: Record<number, Response> = {}) {
  const appels: number[] = []
  const mock = vi.fn(async (_url: string, init: RequestInit) => {
    const { day_of_week } = JSON.parse(String(init.body))
    appels.push(day_of_week)
    return echecs[day_of_week] ?? reponse(200, { data: ligne(day_of_week) })
  })
  vi.stubGlobal('fetch', mock)
  return { mock, appels }
}

describe('creerPlage', () => {
  it('POST /api/availabilities avec le jour (dimanche = 0) et les heures brutes, et rend la ligne créée', async () => {
    const { mock } = serveur()
    const r = await creerPlage(0, '09:00', '12:30')
    expect(r).toEqual({ ok: true, data: ligne(0) })
    const [url, init] = mock.mock.calls[0]
    expect(url).toBe('/api/availabilities')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ day_of_week: 0, start_time: '09:00', end_time: '12:30' })
  })

  it('un refus explicite du serveur arrive tel quel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(400, { error: 'Les horaires doivent être alignés sur 30 minutes' })))
    expect(await creerPlage(1, '08:07', '18:00')).toEqual({ ok: false, message: 'Les horaires doivent être alignés sur 30 minutes' })
  })

  it('une panne serveur donne une phrase et une référence, jamais le texte technique', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { error: 'Une erreur interne est survenue.', errorId: '12345678-aaaa' })))
    const r = await creerPlage(1, '08:00', '18:00')
    expect(r).toEqual({ ok: false, message: 'Enregistrement impossible. Réessayez dans un instant. (réf. 12345678)' })
  })

  it('un succès sans la ligne créée est un échec : pas de doublon si on retente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(200, {})))
    const r = await creerPlage(1, '08:00', '18:00')
    expect(r.ok).toBe(false)
  })

  it('une panne réseau devient une phrase claire', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await creerPlage(1, '08:00', '18:00')
    expect(!r.ok && r.message).toContain('connexion')
  })
})

describe('retirerPlage', () => {
  it('DELETE /api/availabilities/[id], sans corps', async () => {
    const mock = vi.fn().mockResolvedValue(reponse(200, { success: true }))
    vi.stubGlobal('fetch', mock)
    expect(await retirerPlage('a-1')).toEqual({ ok: true, data: null })
    expect(mock).toHaveBeenCalledWith('/api/availabilities/a-1', { method: 'DELETE' })
  })

  it('un échec est rapporté : la plage ne doit pas disparaître de l’écran comme si elle était retirée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(500, { errorId: 'abcdef12-x' })))
    const r = await retirerPlage('a-1')
    expect(r).toEqual({ ok: false, message: 'Suppression impossible. Réessayez dans un instant. (réf. abcdef12)' })
  })

  it('session expirée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Non autorisé' })))
    expect(await retirerPlage('a-1')).toEqual({ ok: false, message: 'Votre session a expiré. Reconnectez-vous.' })
  })
})

describe('ajouterPlages', () => {
  it('un POST par jour, lundi d’abord, dimanche en dernier', async () => {
    const { appels } = serveur()
    const r = await ajouterPlages([0, 5, 1], '08:00', '18:00')
    expect(appels).toEqual([1, 5, 0])
    expect(r.map(x => x.jour)).toEqual([1, 5, 0])
    expect(r.every(x => x.ok)).toBe(true)
  })

  it('un jour coché deux fois n’est créé qu’une fois', async () => {
    const { appels } = serveur()
    await ajouterPlages([1, 1, 2], '08:00', '18:00')
    expect(appels).toEqual([1, 2])
  })

  it('échec partiel : les jours créés sont rendus, le jour en échec aussi, et les suivants sont tentés', async () => {
    const { appels } = serveur({ 3: reponse(500, { errorId: 'aaaaaaaa-1' }) })
    const r = await ajouterPlages([1, 2, 3, 4, 5], '08:00', '18:00')
    expect(appels).toEqual([1, 2, 3, 4, 5])
    expect(r.filter(x => x.ok).map(x => x.jour)).toEqual([1, 2, 4, 5])
    expect(r.filter(x => !x.ok).map(x => x.jour)).toEqual([3])
    const phrase = phraseEchecAjout(r)
    expect(phrase).toContain('Ajouté : lundi, mardi, jeudi et vendredi.')
    expect(phrase).toContain('Pas ajouté : mercredi.')
  })

  it('tout échoue : aucune ligne créée, tous les jours sont nommés', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const r = await ajouterPlages([1, 2], '08:00', '18:00')
    expect(r.every(x => !x.ok)).toBe(true)
    expect(phraseEchecAjout(r)).toContain('Pas ajouté : lundi et mardi.')
  })

  it('aucun jour : aucun appel', async () => {
    const { mock } = serveur()
    expect(await ajouterPlages([], '08:00', '18:00')).toEqual([])
    expect(mock).not.toHaveBeenCalled()
  })
})

describe('état vide, un tap : le double tap ne crée pas de doublons', () => {
  it('deux taps rapprochés sur « Lun–Ven 8h–18h » = cinq POST, pas dix', async () => {
    const { appels } = serveur()
    const ajouter = unSeulALaFois((jours: number[], debut: string, fin: string) => ajouterPlages(jours, debut, fin))

    const premier = ajouter([1, 2, 3, 4, 5], '08:00', '18:00')
    const second = ajouter([1, 2, 3, 4, 5], '08:00', '18:00')

    expect(await second).toBeNull()
    expect(await premier).toHaveLength(5)
    expect(appels).toEqual([1, 2, 3, 4, 5])
  })

  it('après la série, une nouvelle série peut repartir (retenter les jours en échec)', async () => {
    const { appels } = serveur()
    const ajouter = unSeulALaFois((jours: number[]) => ajouterPlages(jours, '08:00', '18:00'))
    await ajouter([1])
    await ajouter([2])
    expect(appels).toEqual([1, 2])
  })
})
