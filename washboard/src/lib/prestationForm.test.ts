import { describe, it, expect } from 'vitest'
import type { Service, ServiceAddon, ServiceCategory } from '@/types'
import { PRESETS } from '@/components/dashboard/admin/CategoriesManager'
import {
  FORMULAIRE_VIDE, formulaireNeuf, formulaireDepuisService, sansCategorieDe, changerCategorie, basculerType,
  changerPrixType, typesOrphelins, retirerOrphelins, corpsPrestation, appliquerAuService,
  categoriesOptionProposees, categorieOptionNormalisee, nouvelleOption, phrasesDuree, listeJours,
  sousTitrePrestations, prixListe, nomDuType, resumeTypes, detailPrestation, resumePrixParType,
  resumeOptions, resumeDescription, typesDepuisModele, prestationsUtilisantTypes, CATEGORIE_OPTION_REPLI,
  type FormulairePrestation,
} from './prestationForm'
import { champsManquants } from './prestation'

const voiture: ServiceCategory = {
  id: 'cat-voiture', washer_id: 'w', name: 'Voiture', display_order: 0,
  types: [{ id: 'citadine', name: 'Citadine' }, { id: 'berline', name: 'Berline' }, { id: 'SUV', name: 'SUV / 4x4' }],
}
const canape: ServiceCategory = {
  id: 'cat-canape', washer_id: 'w', name: 'Canapé', display_order: 1,
  types: [{ id: 'aaaaaaaa-1111-2222-3333-444444444444', name: '2 places' }, { id: 'bbbbbbbb-1111-2222-3333-444444444444', name: '3 places' }],
}

const service = (p: Partial<Service> = {}): Service => ({
  id: 's1', washer_id: 'w', category_id: 'cat-voiture', name: 'Lavage complet', description: null,
  price: 80, duration_minutes: 90, vehicle_types: ['citadine', 'berline'], vehicle_price_overrides: {}, addons: [], ...p,
})

const rempli = (p: Partial<FormulairePrestation> = {}): FormulairePrestation => ({
  ...FORMULAIRE_VIDE, name: 'Lavage', price: '80', duration_minutes: '90', category_id: 'cat-voiture',
  vehicle_types: ['citadine', 'berline', 'SUV'], ...p,
})

describe('formulaireNeuf', () => {
  it('présélectionne la première catégorie avec TOUS ses types cochés', () => {
    const f = formulaireNeuf([voiture, canape])
    expect(f.category_id).toBe('cat-voiture')
    expect(f.vehicle_types).toEqual(['citadine', 'berline', 'SUV'])
    expect(champsManquants({ ...f, name: 'x', price: '1', duration_minutes: '30' })).toEqual([])
  })

  it('sans catégorie : formulaire vide, sans type', () => {
    expect(formulaireNeuf([])).toEqual(FORMULAIRE_VIDE)
  })

  it('ne partage aucun tableau avec le modèle vide (deux formulaires ne se contaminent pas)', () => {
    const a = formulaireNeuf([])
    a.vehicle_types.push('x')
    a.addons.push({ id: '1', label: 'a', category: 'c', price: 1 })
    expect(FORMULAIRE_VIDE.vehicle_types).toEqual([])
    expect(formulaireNeuf([]).addons).toEqual([])
  })
})

describe('formulaireDepuisService', () => {
  it('reprend la prestation en chaînes de saisie, description nulle → vide', () => {
    const f = formulaireDepuisService(service({ price: 80.5, addons: [{ id: 'a', label: 'Poils', category: 'Options', price: 15 }] }))
    expect(f).toMatchObject({ category_id: 'cat-voiture', name: 'Lavage complet', description: '', price: '80.5', duration_minutes: '90' })
    expect(f.addons).toHaveLength(1)
  })

  it('catégorie nulle → chaîne vide ; surcharges absentes → objet vide', () => {
    const s = service({ category_id: null }) as Service & { vehicle_price_overrides: unknown }
    ;(s as { vehicle_price_overrides: unknown }).vehicle_price_overrides = null
    const f = formulaireDepuisService(s)
    expect(f.category_id).toBe('')
    expect(f.vehicle_price_overrides).toEqual({})
  })

  it('copie les tableaux : modifier le formulaire ne touche pas la prestation', () => {
    const s = service()
    const f = formulaireDepuisService(s)
    f.vehicle_types.push('SUV')
    expect(s.vehicle_types).toEqual(['citadine', 'berline'])
  })
})

describe('sansCategorieDe', () => {
  it('rien si la catégorie existe', () => {
    expect(sansCategorieDe(service(), [voiture])).toBeNull()
  })
  it('les types d’origine si la catégorie a disparu ou n’a jamais existé', () => {
    const s = service({ category_id: null, vehicle_types: ['SUV'], vehicle_price_overrides: { SUV: 90 } })
    expect(sansCategorieDe(s, [voiture])).toEqual({ vehicle_types: ['SUV'], vehicle_price_overrides: { SUV: 90 } })
    expect(sansCategorieDe(service({ category_id: 'supprimee' }), [voiture])).not.toBeNull()
  })
})

describe('changerCategorie (règle de changeCategory du site)', () => {
  it('coche tout de la nouvelle catégorie et remet les prix par type à zéro', () => {
    const f = changerCategorie(rempli({ vehicle_price_overrides: { SUV: 99 } }), 'cat-canape', [voiture, canape], null)
    expect(f.category_id).toBe('cat-canape')
    expect(f.vehicle_types).toEqual(canape.types.map(t => t.id))
    expect(f.vehicle_price_overrides).toEqual({})
  })

  it('« Sans catégorie » rend les types et les prix d’origine', () => {
    const origine = { vehicle_types: ['SUV'], vehicle_price_overrides: { SUV: 90 } }
    const f = changerCategorie(rempli({ vehicle_types: ['a'] }), '', [voiture], origine)
    expect(f.category_id).toBe('')
    expect(f.vehicle_types).toEqual(['SUV'])
    expect(f.vehicle_price_overrides).toEqual({ SUV: 90 })
    // copie, pas la même référence : cocher ensuite ne doit pas modifier l'origine
    f.vehicle_types.push('x')
    expect(origine.vehicle_types).toEqual(['SUV'])
  })

  it('« Sans catégorie » sans origine : aucun type', () => {
    const f = changerCategorie(rempli(), '', [voiture], null)
    expect(f.vehicle_types).toEqual([])
    expect(f.vehicle_price_overrides).toEqual({})
  })

  it('catégorie inconnue : aucun type plutôt qu’un plantage', () => {
    expect(changerCategorie(rempli(), 'inconnue', [voiture], null).vehicle_types).toEqual([])
  })

  it('ne touche ni au nom, ni au prix, ni aux options', () => {
    const options: ServiceAddon[] = [{ id: 'a', label: 'Poils', category: 'Options', price: 15 }]
    const f = changerCategorie(rempli({ addons: options, description: 'd' }), 'cat-canape', [voiture, canape], null)
    expect(f).toMatchObject({ name: 'Lavage', price: '80', duration_minutes: '90', description: 'd', addons: options })
  })
})

describe('basculerType (règle de toggleVehicle du site)', () => {
  it('décocher retire le type ET son prix : pas de surcharge orpheline', () => {
    const f = basculerType(rempli({ vehicle_price_overrides: { SUV: 99, berline: 85 } }), 'SUV')
    expect(f.vehicle_types).toEqual(['citadine', 'berline'])
    expect(f.vehicle_price_overrides).toEqual({ berline: 85 })
  })

  it('cocher ajoute le type à la fin, sans toucher aux prix', () => {
    const f = basculerType(rempli({ vehicle_types: ['citadine'], vehicle_price_overrides: { citadine: 70 } }), 'SUV')
    expect(f.vehicle_types).toEqual(['citadine', 'SUV'])
    expect(f.vehicle_price_overrides).toEqual({ citadine: 70 })
  })

  it('ne modifie pas le formulaire d’origine', () => {
    const f0 = rempli({ vehicle_price_overrides: { SUV: 99 } })
    basculerType(f0, 'SUV')
    expect(f0.vehicle_types).toContain('SUV')
    expect(f0.vehicle_price_overrides).toEqual({ SUV: 99 })
  })

  it('décocher le dernier type rend la prestation non enregistrable (règle « sans type refusé »)', () => {
    const f = basculerType(rempli({ vehicle_types: ['citadine'] }), 'citadine')
    expect(champsManquants(f)).toContain('type')
  })
})

describe('changerPrixType', () => {
  it('pose un prix, le vide efface (retour au prix de base)', () => {
    const f = changerPrixType(rempli(), 'SUV', '95')
    expect(f.vehicle_price_overrides).toEqual({ SUV: 95 })
    expect(changerPrixType(f, 'SUV', '').vehicle_price_overrides).toEqual({})
  })
  it('0 est un prix (« sur devis »), pas un vide', () => {
    expect(changerPrixType(rempli(), 'SUV', '0').vehicle_price_overrides).toEqual({ SUV: 0 })
  })
  it('une saisie illisible efface plutôt que d’enregistrer NaN', () => {
    expect(changerPrixType(rempli({ vehicle_price_overrides: { SUV: 9 } }), 'SUV', 'abc').vehicle_price_overrides).toEqual({})
  })
})

describe('types orphelins', () => {
  const svcTypes = ['citadine', 'ancien-uuid', 'berline']
  it('repère les types absents de la catégorie', () => {
    expect(typesOrphelins(svcTypes, voiture)).toEqual(['ancien-uuid'])
  })
  it('sans catégorie : rien à comparer, rien à signaler', () => {
    expect(typesOrphelins(svcTypes, undefined)).toEqual([])
  })
  it('retirerOrphelins garde les autres types et leurs prix, sans les orphelins', () => {
    const f = retirerOrphelins(rempli({ vehicle_types: svcTypes, vehicle_price_overrides: { citadine: 70, 'ancien-uuid': 5 } }), voiture)
    expect(f.vehicle_types).toEqual(['citadine', 'berline'])
    expect(f.vehicle_price_overrides).toEqual({ citadine: 70 })
  })
  it('retirerOrphelins rend le même formulaire quand il n’y en a pas', () => {
    const f = rempli()
    expect(retirerOrphelins(f, voiture)).toBe(f)
  })
})

describe('corpsPrestation (payload du site)', () => {
  it('convertit les chaînes en nombres, catégorie vide → null, description vide → null', () => {
    expect(corpsPrestation(rempli({ category_id: '', description: '   ' }))).toEqual({
      category_id: null, name: 'Lavage', description: null, price: 80, duration_minutes: 90,
      vehicle_types: ['citadine', 'berline', 'SUV'], vehicle_price_overrides: {}, addons: [],
    })
  })
  it('garde la description trimée et le nom sans espaces autour', () => {
    const c = corpsPrestation(rempli({ name: '  Lavage  ', description: ' Complet ' }))
    expect(c.name).toBe('Lavage')
    expect(c.description).toBe('Complet')
  })
  it('un prix décimal reste décimal, 0 reste 0', () => {
    expect(corpsPrestation(rempli({ price: '80.5' })).price).toBe(80.5)
    expect(corpsPrestation(rempli({ price: '0' })).price).toBe(0)
  })
})

describe('appliquerAuService', () => {
  it('remplace les champs éditables et garde id et laveur', () => {
    const s = appliquerAuService(service(), rempli({ name: 'Nouveau', price: '100' }))
    expect(s).toMatchObject({ id: 's1', washer_id: 'w', name: 'Nouveau', price: 100 })
  })
})

describe('options : catégories', () => {
  const service2 = service({ addons: [{ id: 'z', label: 'Cire', category: 'traitements SPECIAUX', price: 20 }] })

  it('propose d’abord les orthographes déjà employées, puis les modèles, sans doublon', () => {
    const liste = categoriesOptionProposees(
      [{ id: 'a', label: 'Poils', category: 'Suppléments intérieur', price: 15 }],
      [service2],
    )
    expect(liste).toEqual(['Suppléments intérieur', 'traitements SPECIAUX', 'Suppléments extérieur'])
  })

  it('sans option existante : les trois modèles', () => {
    expect(categoriesOptionProposees([], [])).toEqual(['Suppléments intérieur', 'Suppléments extérieur', 'Traitements spéciaux'])
  })

  it('une prestation sans champ addons ne fait pas planter', () => {
    const sans = { ...service(), addons: undefined } as unknown as Service
    expect(categoriesOptionProposees([], [sans])).toHaveLength(3)
  })

  it('une saisie qui ne diffère que par la casse, les accents ou les espaces reprend l’existante', () => {
    const connues = ['Suppléments intérieur', 'Options']
    expect(categorieOptionNormalisee('supplements INTERIEUR', connues)).toBe('Suppléments intérieur')
    expect(categorieOptionNormalisee('  suppléments   intérieur ', connues)).toBe('Suppléments intérieur')
    expect(categorieOptionNormalisee('options', connues)).toBe('Options')
  })

  it('une vraie nouvelle catégorie est gardée, nettoyée', () => {
    expect(categorieOptionNormalisee('  Extras   bébé ', ['Options'])).toBe('Extras bébé')
  })

  it('vide → « Options »', () => {
    expect(categorieOptionNormalisee('   ', ['Autre'])).toBe(CATEGORIE_OPTION_REPLI)
  })
})

describe('nouvelleOption', () => {
  const connues = ['Suppléments intérieur']
  const b = { label: ' Poils d’animaux ', category: 'supplements interieur', price: '15', duration_minutes: '20' }

  it('construit l’option : id fourni, libellé trimé, catégorie normalisée, nombres', () => {
    expect(nouvelleOption(b, connues, 'id-1')).toEqual({
      id: 'id-1', label: 'Poils d’animaux', category: 'Suppléments intérieur', price: 15, duration_minutes: 20,
    })
  })

  it('durée facultative : absente du résultat quand vide ou nulle', () => {
    expect('duration_minutes' in nouvelleOption({ ...b, duration_minutes: '' }, connues, 'x')!).toBe(false)
    expect('duration_minutes' in nouvelleOption({ ...b, duration_minutes: '0' }, connues, 'x')!).toBe(false)
  })

  it('un supplément gratuit (0 €) est valide', () => {
    expect(nouvelleOption({ ...b, price: '0' }, connues, 'x')?.price).toBe(0)
  })

  it('refuse un libellé vide, un prix vide, négatif ou illisible', () => {
    expect(nouvelleOption({ ...b, label: '  ' }, connues, 'x')).toBeNull()
    expect(nouvelleOption({ ...b, price: '' }, connues, 'x')).toBeNull()
    expect(nouvelleOption({ ...b, price: '-5' }, connues, 'x')).toBeNull()
    expect(nouvelleOption({ ...b, price: 'abc' }, connues, 'x')).toBeNull()
  })

  it('catégorie vide → « Options », comme sur le site', () => {
    expect(nouvelleOption({ ...b, category: '' }, connues, 'x')?.category).toBe('Options')
  })
})

describe('phrasesDuree (avertissement non bloquant)', () => {
  const dispo = (day: number, debut: string, fin: string) => ({ day_of_week: day, start_time: debut, end_time: fin })
  const trois = { duration_minutes: '180', addons: [] as ServiceAddon[] }

  it('vide tant qu’aucune disponibilité n’est configurée : un compte neuf n’est pas bloqué', () => {
    expect(phrasesDuree([], trois)).toEqual([])
  })

  it('vide quand tout rentre', () => {
    expect(phrasesDuree([dispo(1, '08:00', '18:00')], trois)).toEqual([])
  })

  it('dit quel jour est trop court, même sans option', () => {
    const p = phrasesDuree([dispo(1, '09:00', '11:00'), dispo(2, '08:00', '18:00')], trois)
    expect(p).toEqual(['Cette prestation dure 3h : trop long pour votre lundi, même sans option.'])
  })

  it('distingue « seulement avec les options »', () => {
    const p = phrasesDuree(
      [dispo(3, '09:00', '13:00')],
      { duration_minutes: '180', addons: [{ id: 'a', label: 'x', category: 'c', price: 1, duration_minutes: 90 }] },
    )
    expect(p).toEqual(['Options comprises, elle peut durer jusqu’à 4h30 : ça dépasse votre mercredi dès qu’une option est cochée.'])
  })

  it('donne les deux phrases quand les deux cas coexistent', () => {
    const p = phrasesDuree(
      [dispo(1, '09:00', '11:00'), dispo(3, '09:00', '13:00')],
      { duration_minutes: '180', addons: [{ id: 'a', label: 'x', category: 'c', price: 1, duration_minutes: 90 }] },
    )
    expect(p).toHaveLength(2)
    expect(p[0]).toContain('lundi')
    expect(p[1]).toContain('mercredi')
  })

  it('durée non saisie : rien', () => {
    expect(phrasesDuree([dispo(1, '09:00', '10:00')], { duration_minutes: '', addons: [] })).toEqual([])
  })

  it('listeJours : « lundi », « lundi et mardi », « lundi, mardi et jeudi »', () => {
    expect(listeJours(['lundi'])).toBe('lundi')
    expect(listeJours(['lundi', 'mardi'])).toBe('lundi et mardi')
    expect(listeJours(['lundi', 'mardi', 'jeudi'])).toBe('lundi, mardi et jeudi')
  })
})

describe('affichage de la liste', () => {
  it('sousTitrePrestations : singulier, pluriel, zéro', () => {
    expect(sousTitrePrestations(4, 2)).toBe('4 prestations · 2 catégories')
    expect(sousTitrePrestations(1, 1)).toBe('1 prestation · 1 catégorie')
    expect(sousTitrePrestations(0, 0)).toBe('Aucune prestation')
    expect(sousTitrePrestations(3, 0)).toBe('3 prestations')
    expect(sousTitrePrestations(0, 2)).toBe('Aucune prestation · 2 catégories')
  })

  it('prixListe : prix de base, ou « dès » le plus bas des types quand ils diffèrent', () => {
    expect(prixListe(service())).toEqual({ des: false, montant: '80 €' })
    const s = service({ vehicle_price_overrides: { citadine: 60 } })
    expect(prixListe(s)).toEqual({ des: true, montant: '60 €' })
    expect(prixListe(service({ price: 80.5 })).montant).toBe('80,50 €')
  })

  it('prixListe : un type à 0 € (« sur devis ») ne fait pas afficher « dès 0 € »', () => {
    expect(prixListe(service({ vehicle_price_overrides: { citadine: 0, berline: 100 } })).montant).toBe('100 €')
  })

  it('nomDuType : catégorie, puis modèles historiques, puis « Type supprimé »', () => {
    expect(nomDuType('SUV', voiture)).toBe('SUV / 4x4')
    expect(nomDuType('utilitaire', undefined)).toBe('Van / Utilitaire')
    expect(nomDuType('aaaaaaaa-1111-2222-3333-444444444444', voiture)).toBe('Type supprimé')
    expect(nomDuType('aaaaaaaa-1111-2222-3333-444444444444', canape)).toBe('2 places')
  })

  it('resumeTypes : deux premiers types puis « +N »', () => {
    expect(resumeTypes(service({ vehicle_types: ['citadine'] }), voiture)).toBe('Citadine')
    expect(resumeTypes(service({ vehicle_types: ['citadine', 'berline'] }), voiture)).toBe('Citadine, Berline')
    expect(resumeTypes(service({ vehicle_types: ['citadine', 'berline', 'SUV'] }), voiture)).toBe('Citadine, Berline +1')
    expect(resumeTypes(service({ vehicle_types: [] }), voiture)).toBe('')
  })

  it('detailPrestation : durée puis types ; durée seule quand il n’y a aucun type', () => {
    expect(detailPrestation(service(), voiture)).toBe('1h30 · Citadine, Berline')
    expect(detailPrestation(service({ vehicle_types: [], duration_minutes: 45 }), voiture)).toBe('45min')
  })

  it('résumés de sections repliées', () => {
    expect(resumePrixParType(rempli())).toBe('Prix de base pour tous')
    expect(resumePrixParType(rempli({ vehicle_price_overrides: { SUV: 1 } }))).toBe('1 prix différent')
    expect(resumePrixParType(rempli({ vehicle_price_overrides: { SUV: 1, berline: 2 } }))).toBe('2 prix différents')
    expect(resumeOptions({ addons: [] })).toBe('Aucune')
    expect(resumeOptions({ addons: [{ id: 'a', label: 'x', category: 'c', price: 1 }] })).toBe('1 option')
    expect(resumeOptions({ addons: [{ id: 'a', label: 'x', category: 'c', price: 1 }, { id: 'b', label: 'y', category: 'c', price: 1 }] })).toBe('2 options')
    expect(resumeDescription('   ')).toBe('Aucune')
    expect(resumeDescription('Court')).toBe('Court')
    expect(resumeDescription('a'.repeat(60))).toHaveLength(34)
  })
})

describe('modèles de catégorie', () => {
  it('« Voiture » garde ses identifiants fixes : les images et le champ modèle du tunnel en dépendent', () => {
    const voitureModele = PRESETS.find(p => p.name === 'Voiture')!
    const types = typesDepuisModele(voitureModele, () => { throw new Error('aucun UUID ne doit être généré pour Voiture') })
    expect(types.map(t => t.id)).toEqual(['citadine_2p', 'citadine', 'berline', 'SUV', 'monospace', '7places', 'utilitaire'])
    // Aucun n'a la forme d'un UUID : `isVehicleType` (StepService) les reconnaît à ça.
    expect(types.every(t => !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(t.id))).toBe(true)
  })

  it('« Canapé » reçoit des UUID, un par type, tous distincts', () => {
    const modele = PRESETS.find(p => p.name === 'Canapé')!
    const types = typesDepuisModele(modele)
    expect(types.map(t => t.name)).toEqual(['2 places', '3 places', 'Canapé d\'angle', 'Méridienne', 'Fauteuil'])
    expect(types.every(t => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(t.id))).toBe(true)
    expect(new Set(types.map(t => t.id)).size).toBe(types.length)
  })

  it('le générateur d’id est injectable', () => {
    let n = 0
    const types = typesDepuisModele({ name: 'X', types: [{ name: 'a' }, { name: 'b', id: 'fixe' }] }, () => `gen-${++n}`)
    expect(types).toEqual([{ id: 'gen-1', name: 'a' }, { id: 'fixe', name: 'b' }])
  })

  it('l’ordre des types du modèle est celui affiché au client', () => {
    expect(PRESETS.find(p => p.name === 'Voiture')!.types[0].name).toBe('Citadine 2p')
  })
})

describe('prestationsUtilisantTypes', () => {
  const s1 = service({ id: 'a', vehicle_types: ['citadine', 'SUV'] })
  const s2 = service({ id: 'b', vehicle_types: ['berline'] })
  const s3 = service({ id: 'c', category_id: 'cat-canape', vehicle_types: ['SUV'] })

  it('liste les prestations DE CETTE catégorie qui proposent un type retiré', () => {
    expect(prestationsUtilisantTypes([s1, s2, s3], 'cat-voiture', ['SUV']).map(s => s.id)).toEqual(['a'])
  })
  it('rien à retirer, rien à signaler', () => {
    expect(prestationsUtilisantTypes([s1, s2], 'cat-voiture', [])).toEqual([])
  })
})
