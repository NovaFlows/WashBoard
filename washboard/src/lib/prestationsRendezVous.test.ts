import { describe, expect, it } from 'vitest'
import { ajouterPrestation, prestationsAjoutees, prixAjout, retirerPrestation, type RdvAvecPrestations } from './prestationsRendezVous'
import { lignesDetailPrix } from './detailRendezVous'
import { lignesFacture } from './facture'
import { MAX_PRESTATIONS, type PrestationCatalogue } from './plusieursPrestations'

const W = 'washer-1'
const logo = { id: 'opt-logo', label: 'Logo (AMG / M / Porsche ext)', price: 10, category: 'Finition', duration_minutes: 15 }

// Le cas de Paint Étrier 77 : « Peinture 4 étriers » réservée avec une option, il faut ajouter
// « Peinture 2 étriers arrière » avant de confirmer.
const rdvEnLigne = (): RdvAvecPrestations => ({
  status: 'pending',
  facture_numero: null,
  service_id: 'svc-4',
  scheduled_at: '2026-11-27T07:30:00.000Z',
  booked_price: 160,
  is_smart_slot: false,
  smart_discount: 0,
  vehicle_count: 1,
  vehicles_detail: [{ type: 'voiture', count: 1, unit_price: 150, label: 'Voiture', addons: [logo] }],
  selected_addons: [logo],
  services: { price: 150, duration_minutes: 120 },
})

const prestation = (p: Partial<PrestationCatalogue> = {}): PrestationCatalogue => ({
  id: 'svc-2', washer_id: W, name: 'Peinture 2 étriers', price: 80,
  vehicle_price_overrides: { suv: 95 }, duration_minutes: 60, vehicle_types: ['voiture', 'suv'], ...p,
})

describe('ajouterPrestation', () => {
  it('ajoute la prestation au véhicule et à la liste à plat, au prix du catalogue', () => {
    const v = ajouterPrestation(rdvEnLigne(), prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.ancienPrix).toBe(160)
    expect(v.nouveauPrix).toBe(240)
    expect(v.ecart).toBe(80)
    expect(v.libelle).toBe('Peinture 2 étriers')
    expect(v.colonnes.booked_price).toBe(240)
    const option = { id: 'prestation:svc-2', label: 'Peinture 2 étriers', price: 80, category: 'prestation', duration_minutes: 60 }
    expect(v.colonnes.vehicles_detail?.[0].addons).toEqual([logo, option])
    expect(v.colonnes.selected_addons).toEqual([logo, option])
    // 120 min + 15 (option) + 60 (ajoutée) à partir de 07:30 UTC.
    expect(v.colonnes.ends_at).toBe('2026-11-27T10:45:00.000Z')
  })

  it('le détail du prix et la facture montrent la prestation, et retombent sur le nouveau total', () => {
    const v = ajouterPrestation(rdvEnLigne(), prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    const apres = { ...rdvEnLigne(), ...v.colonnes, services: { name: 'Peinture 4 étriers', price: 150, duration_minutes: 120 } }
    expect(lignesDetailPrix(apres).map(l => [l.genre, l.libelle, l.montant])).toEqual([
      ['principale', 'Peinture 4 étriers', 150],
      ['prestation', 'Peinture 2 étriers', 80],
      ['option', 'Logo (AMG / M / Porsche ext)', 10],
    ])
    const facture = lignesFacture({
      ...apres, client_name: 'C', client_email: '', address: '', is_professional: false, company_name: null,
      siret: null, billing_address: null, travel_fee: 0, vehicle_count: 1,
      vehicles_detail: apres.vehicles_detail ?? null, selected_addons: apres.selected_addons,
      booked_price: apres.booked_price, is_smart_slot: false, smart_discount: 0,
    })
    // Même ordre que pour une prestation choisie en ligne : celui de `selected_addons`.
    expect(facture.map(l => l.designation)).toEqual(['Peinture 4 étriers — Voiture', 'Option : Logo (AMG / M / Porsche ext)', 'Peinture 2 étriers'])
    expect(facture.reduce((s, l) => s + l.totalTtc, 0)).toBe(240)
  })

  it('plusieurs véhicules : le prix de chaque type, une fois par exemplaire', () => {
    const rdv = { ...rdvEnLigne(), booked_price: 450, vehicles_detail: [
      { type: 'voiture', count: 2, unit_price: 150, addons: [] },
      { type: 'suv', count: 1, unit_price: 150, addons: [] },
    ], selected_addons: [] }
    expect(prixAjout(rdv, prestation())).toBe(80 * 2 + 95)
    const v = ajouterPrestation(rdv, prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.booked_price).toBe(450 + 255)
    expect(v.colonnes.vehicles_detail?.map(x => x.addons?.map(a => a.price))).toEqual([[80], [95]])
    expect(v.colonnes.selected_addons.map(a => a.price)).toEqual([80, 95])
  })

  it('rendez-vous saisi à la main (véhicules sans options) : passe au format par véhicule', () => {
    const rdv = { ...rdvEnLigne(), booked_price: 150, vehicles_detail: [{ type: 'voiture', count: 1, unit_price: 150 }], selected_addons: [] }
    const v = ajouterPrestation(rdv, prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.vehicles_detail?.[0].addons?.map(a => a.id)).toEqual(['prestation:svc-2'])
    expect(v.colonnes.booked_price).toBe(230)
  })

  it('ancien rendez-vous à options communes : la liste commune, comptée une fois', () => {
    const rdv = { ...rdvEnLigne(), vehicle_count: 2, vehicles_detail: [{ type: 'suv', count: 2, unit_price: 150 }] }
    const v = ajouterPrestation(rdv, prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.vehicles_detail).toEqual(rdv.vehicles_detail)
    expect(v.colonnes.selected_addons.map(a => [a.id, a.price])).toEqual([['opt-logo', 10], ['prestation:svc-2', 95]])
    expect(v.colonnes.booked_price).toBe(255)
  })

  it('sans véhicule détaillé : une option commune au prix de base', () => {
    const rdv = { ...rdvEnLigne(), vehicles_detail: null, selected_addons: null, booked_price: 150 }
    const v = ajouterPrestation(rdv, prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.selected_addons.map(a => a.id)).toEqual(['prestation:svc-2'])
    expect(v.colonnes.booked_price).toBe(230)
  })

  it('remise du laveur et créneau avantageux déjà appliqués : seul l’écart s’ajoute', () => {
    const rdv = { ...rdvEnLigne(), booked_price: 140, remise_laveur: 20, is_smart_slot: true, smart_discount: 5 }
    const v = ajouterPrestation(rdv, prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.ancienPrix).toBe(135)
    expect(v.nouveauPrix).toBe(215)
    expect(v.colonnes.booked_price).toBe(220)
  })

  it('prestation offerte (0 €) : nommée sur le rendez-vous, prix inchangé, durée comptée', () => {
    const v = ajouterPrestation(rdvEnLigne(), prestation({ price: 0, vehicle_price_overrides: {} }), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(v.ecart).toBe(0)
    expect(v.colonnes.booked_price).toBe(160)
    expect(v.colonnes.ends_at).toBe('2026-11-27T10:45:00.000Z')
  })

  it('une prestation en veille reste ajoutable par le laveur', () => {
    expect(ajouterPrestation(rdvEnLigne(), prestation({ en_veille: true }), W).ok).toBe(true)
  })

  it('refuse : autre laveur, prestation principale, déjà ajoutée, trop de prestations', () => {
    expect(ajouterPrestation(rdvEnLigne(), prestation({ washer_id: 'autre' }), W)).toMatchObject({ ok: false, statut: 404 })
    expect(ajouterPrestation(rdvEnLigne(), prestation({ id: 'svc-4' }), W)).toMatchObject({ ok: false, statut: 409 })
    const v = ajouterPrestation(rdvEnLigne(), prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    expect(ajouterPrestation({ ...rdvEnLigne(), ...v.colonnes }, prestation(), W)).toMatchObject({ ok: false, statut: 409 })

    let rdv: RdvAvecPrestations = rdvEnLigne()
    for (let i = 1; i < MAX_PRESTATIONS; i++) {
      const r = ajouterPrestation(rdv, prestation({ id: `p${i}` }), W)
      if (!r.ok) throw new Error(r.erreur)
      rdv = { ...rdv, ...r.colonnes }
    }
    expect(prestationsAjoutees(rdv)).toHaveLength(MAX_PRESTATIONS - 1)
    expect(ajouterPrestation(rdv, prestation({ id: 'une-de-trop' }), W)).toMatchObject({ ok: false, statut: 409 })
  })

  it('refuse un rendez-vous annulé ou déjà facturé', () => {
    expect(ajouterPrestation({ ...rdvEnLigne(), status: 'cancelled' }, prestation(), W)).toMatchObject({ ok: false, statut: 409 })
    expect(ajouterPrestation({ ...rdvEnLigne(), status: 'done', facture_numero: 'F-2026-0001' }, prestation(), W)).toMatchObject({ ok: false, statut: 409 })
  })
})

describe('retirerPrestation', () => {
  const avecAjout = (): RdvAvecPrestations => {
    const v = ajouterPrestation(rdvEnLigne(), prestation(), W)
    if (!v.ok) throw new Error(v.erreur)
    return { ...rdvEnLigne(), ...v.colonnes }
  }

  it('retire la prestation partout et rend le prix et la durée d’avant', () => {
    const v = retirerPrestation(avecAjout(), 'svc-2')
    if (!v.ok) throw new Error(v.erreur)
    expect(v.ecart).toBe(-80)
    expect(v.libelle).toBe('Peinture 2 étriers')
    expect(v.colonnes.booked_price).toBe(160)
    expect(v.colonnes.vehicles_detail?.[0].addons).toEqual([logo])
    expect(v.colonnes.selected_addons).toEqual([logo])
    expect(v.colonnes.ends_at).toBe('2026-11-27T09:45:00.000Z')
  })

  it('retire le montant compté à l’époque, même si le catalogue a changé depuis', () => {
    const rdv = avecAjout()
    rdv.vehicles_detail![0].addons![1] = { ...rdv.vehicles_detail![0].addons![1], price: 70 }
    const v = retirerPrestation(rdv, 'svc-2')
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.booked_price).toBe(170)
  })

  it('plusieurs exemplaires : retire le prix de chacun', () => {
    const rdv = { ...rdvEnLigne(), booked_price: 460, vehicles_detail: [{ type: 'voiture', count: 2, unit_price: 150, addons: [{ id: 'prestation:svc-2', label: 'P2', price: 80, category: 'prestation' }] }], selected_addons: [{ id: 'prestation:svc-2', label: 'P2', price: 80, category: 'prestation' }] }
    const v = retirerPrestation(rdv, 'svc-2')
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.booked_price).toBe(300)
  })

  it('ancien format : retire l’option commune une fois', () => {
    const rdv = { ...rdvEnLigne(), booked_price: 255, vehicles_detail: [{ type: 'suv', count: 2, unit_price: 150 }], selected_addons: [logo, { id: 'prestation:svc-2', label: 'P2', price: 95, category: 'prestation' }] }
    const v = retirerPrestation(rdv, 'svc-2')
    if (!v.ok) throw new Error(v.erreur)
    expect(v.colonnes.booked_price).toBe(160)
    expect(v.colonnes.selected_addons).toEqual([logo])
  })

  it('refuse : prestation principale, absente, annulé, facturé', () => {
    expect(retirerPrestation(avecAjout(), 'svc-4')).toMatchObject({ ok: false, statut: 409 })
    expect(retirerPrestation(avecAjout(), 'inconnue')).toMatchObject({ ok: false, statut: 404 })
    expect(retirerPrestation({ ...avecAjout(), status: 'cancelled' }, 'svc-2')).toMatchObject({ ok: false, statut: 409 })
    expect(retirerPrestation({ ...avecAjout(), facture_numero: 'F-1' }, 'svc-2')).toMatchObject({ ok: false, statut: 409 })
    // Une option ordinaire n'est pas une prestation : elle ne se retire pas par ce chemin.
    expect(retirerPrestation(avecAjout(), 'opt-logo')).toMatchObject({ ok: false, statut: 404 })
  })

  it('jamais sous l’acompte, jamais sous zéro', () => {
    expect(retirerPrestation({ ...avecAjout(), acompte_statut: 'recu', acompte_montant: 200 }, 'svc-2')).toMatchObject({ ok: false, statut: 409 })
    expect(retirerPrestation({ ...avecAjout(), acompte_statut: 'recu', acompte_montant: 60 }, 'svc-2').ok).toBe(true)
    expect(retirerPrestation({ ...avecAjout(), booked_price: 50 }, 'svc-2')).toMatchObject({ ok: false, statut: 409 })
  })
})
