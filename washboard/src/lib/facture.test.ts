import { describe, it, expect } from 'vitest'
import {
  paysDuTelephoneLaveur, paysDuProfil, reglesPays, identifiantValidePour,
  siretValide, numeroTvaValide, infosFacturationManquantes, phraseManques,
  ideSuisseValide, normaliserNumeroTva, normaliserSiret, libelleCourtIdentifiant, identifiantAffiche, tauxTvaNormal,
  lignesFacture, totauxFacture, construireFacture, nomLegalAffiche,
  doitEnvoyerFactureAuClient, paysFacturation, tauxTvaPour, mentionFranchiseTva,
  type ReservationFacturable, type VendeurFacturable,
} from './facture'

const reservation = (surcharge: Partial<ReservationFacturable> = {}): ReservationFacturable => ({
  client_name: 'Client Démo',
  client_email: 'client@example.com',
  address: '1 rue de la Démo, 75000 Paris',
  scheduled_at: '2026-09-20T09:00:00.000Z',
  is_professional: false,
  company_name: null,
  siret: null,
  billing_address: null,
  booked_price: 115,
  is_smart_slot: false,
  smart_discount: 0,
  vehicle_count: 2,
  travel_fee: 15,
  vehicles_detail: [
    { type: 'citadine', count: 1, unit_price: 40 },
    { type: 'SUV', count: 1, unit_price: 45, label: 'SUV / 4x4' },
  ],
  selected_addons: [{ label: 'Poils d’animaux', price: 15 }],
  services: { name: 'Lavage complet' },
  ...surcharge,
})

const vendeur = (surcharge: Partial<VendeurFacturable> = {}): VendeurFacturable => ({
  name: 'Démo Lavage',
  phone: null,
  facture_nom_legal: 'Jean Démo EI',
  facture_siret: '123 456 789 00007',
  facture_adresse: '2 avenue de la Démo, 69000 Lyon',
  facture_regime_tva: 'franchise',
  facture_taux_tva: 20,
  facture_numero_tva: null,
  ...surcharge,
})

describe('doitEnvoyerFactureAuClient', () => {
  const pro = { is_professional: true, client_email: 'compta@garage.fr' }
  const neuve = { nouvelle: true }

  it('envoie au client professionnel dont la facture vient d’être émise', () => {
    expect(doitEnvoyerFactureAuClient(pro, neuve)).toBe(true)
  })

  it('n’envoie rien à un particulier : il l’a sur le lien de sa confirmation', () => {
    expect(doitEnvoyerFactureAuClient({ ...pro, is_professional: false }, neuve)).toBe(false)
    expect(doitEnvoyerFactureAuClient({ client_email: 'julie@exemple.fr' }, neuve)).toBe(false)
  })

  it('ne renvoie pas une facture déjà émise', () => {
    expect(doitEnvoyerFactureAuClient(pro, { nouvelle: false })).toBe(false)
  })

  it('sans email, rien à envoyer', () => {
    expect(doitEnvoyerFactureAuClient({ is_professional: true, client_email: '  ' }, neuve)).toBe(false)
    expect(doitEnvoyerFactureAuClient({ is_professional: true, client_email: null }, neuve)).toBe(false)
  })
})

describe('siretValide', () => {
  it('accepte un SIRET dont la clé est juste, espaces compris', () => {
    expect(siretValide('12345678900007')).toBe(true)
    expect(siretValide('123 456 789 00007')).toBe(true)
  })

  it('refuse une faute de frappe sur un chiffre', () => {
    expect(siretValide('12345678900008')).toBe(false)
  })

  it('refuse une longueur ou des caractères invalides', () => {
    expect(siretValide('123456789')).toBe(false)
    expect(siretValide('1234567890000A')).toBe(false)
  })

  it('applique la règle particulière de La Poste', () => {
    expect(siretValide('35600000049837')).toBe(true)
  })
})

describe('numeroTvaValide', () => {
  it('accepte un numéro français, espaces et minuscules compris', () => {
    expect(numeroTvaValide('fr 32 123456789')).toBe(true)
  })

  it('refuse un numéro sans le SIREN complet', () => {
    expect(numeroTvaValide('FR32123')).toBe(false)
  })
})

describe('infosFacturationManquantes', () => {
  it('rien ne manque pour un micro-entrepreneur complet', () => {
    expect(infosFacturationManquantes(vendeur())).toEqual([])
  })

  it('liste ce qui manque, SIRET faux compris', () => {
    expect(infosFacturationManquantes(vendeur({ facture_nom_legal: ' ', facture_siret: '123', facture_adresse: null })))
      .toEqual(['votre nom légal', 'votre SIRET', 'votre adresse professionnelle'])
  })

  it('exige le numéro de TVA de celui qui la facture', () => {
    expect(infosFacturationManquantes(vendeur({ facture_regime_tva: 'assujetti' })))
      .toEqual(['votre numéro de TVA'])
  })

  it('formule une phrase lisible', () => {
    expect(phraseManques(['votre SIRET', 'votre adresse professionnelle']))
      .toBe('Pour émettre vos factures, il manque votre SIRET et votre adresse professionnelle.')
    expect(phraseManques([])).toBeNull()
  })
})

describe('lignesFacture', () => {
  it('une ligne par véhicule, par option et pour le déplacement', () => {
    expect(lignesFacture(reservation())).toEqual([
      { designation: 'Lavage complet — Citadine', quantite: 1, prixUnitaireTtc: 40, totalTtc: 40 },
      { designation: 'Lavage complet — SUV / 4x4', quantite: 1, prixUnitaireTtc: 45, totalTtc: 45 },
      { designation: 'Option : Poils d’animaux', quantite: 1, prixUnitaireTtc: 15, totalTtc: 15 },
      { designation: 'Frais de déplacement', quantite: 1, prixUnitaireTtc: 15, totalTtc: 15 },
    ])
  })

  it('une prestation ajoutée est facturée comme une prestation, pas comme une option', () => {
    const lignes = lignesFacture(reservation({
      selected_addons: [{ id: 'prestation:p2', label: 'Jantes', price: 15 }],
    }))
    expect(lignes.map(l => l.designation)).toContain('Jantes')
    expect(lignes.map(l => l.designation)).not.toContain('Option : Jantes')
  })

  it('sans détail par véhicule, déduit le prix unitaire du total', () => {
    const lignes = lignesFacture(reservation({ vehicles_detail: null, selected_addons: [], travel_fee: 0, booked_price: 90 }))
    expect(lignes).toEqual([{ designation: 'Lavage complet', quantite: 2, prixUnitaireTtc: 45, totalTtc: 90 }])
  })

  it('si le détail ne retombe pas sur le total enregistré, facture le total en une ligne', () => {
    const lignes = lignesFacture(reservation({ booked_price: 100 }))
    expect(lignes).toEqual([{ designation: 'Lavage complet', quantite: 1, prixUnitaireTtc: 100, totalTtc: 100 }])
  })
})

describe('totauxFacture', () => {
  it('en franchise, pas de TVA : HT = TTC', () => {
    expect(totauxFacture(115, 'franchise', 0)).toEqual({ ht: 115, tva: 0, ttc: 115 })
  })

  it('assujetti à 20 % : le TTC payé est conservé, HT et TVA en découlent', () => {
    expect(totauxFacture(120, 'assujetti', 20)).toEqual({ ht: 100, tva: 20, ttc: 120 })
    const t = totauxFacture(49.9, 'assujetti', 20)
    expect(t.ttc).toBe(49.9)
    expect(t.ht + t.tva).toBeCloseTo(49.9, 10)
  })
})

describe('construireFacture', () => {
  it('fige le vendeur, le client et les totaux, remise « créneau optimisé » déduite', () => {
    const f = construireFacture(reservation({ is_smart_slot: true, smart_discount: 10 }), vendeur())
    expect(f.vendeur).toMatchObject({ nomLegal: 'Jean Démo EI', siret: '12345678900007', regimeTva: 'franchise', tauxTva: 0 })
    expect(f.remiseTtc).toBe(10)
    expect(f.totaux).toEqual({ ht: 105, tva: 0, ttc: 105 })
    expect(f.client.adresseFacturation).toBe('1 rue de la Démo, 75000 Paris')
  })

  it('remise du laveur : lignes au prix de départ, ligne « Remise accordée », total remisé', () => {
    // Prix de départ 115 € (lignes détaillées), remise de 20 € : booked_price enregistré à 95 €.
    const f = construireFacture(reservation({ booked_price: 95, remise_laveur: 20 }), vendeur())
    expect(f.lignes.map(l => l.totalTtc)).toEqual([40, 45, 15, 15])
    expect(f.remiseTtc).toBe(20)
    expect(f.libelleRemise).toBe('Remise accordée')
    expect(f.totaux.ttc).toBe(95)
  })

  it('remise du laveur et créneau optimisé : une seule ligne, libellé des deux', () => {
    const f = construireFacture(reservation({ booked_price: 95, remise_laveur: 20, is_smart_slot: true, smart_discount: 10 }), vendeur())
    expect(f.remiseTtc).toBe(30)
    expect(f.libelleRemise).toBe('Remises (créneau optimisé et geste commercial)')
    expect(f.totaux.ttc).toBe(85)
  })

  it('sans remise, pas de libellé : les factures existantes ne changent pas', () => {
    expect(construireFacture(reservation(), vendeur())).not.toHaveProperty('libelleRemise')
  })

  it('au centre auto : pas l’adresse du centre comme adresse du client, lieu « Centre auto »', () => {
    const f = construireFacture(reservation({ lieu: 'centre', address: '8 avenue Foch, 69006 Lyon' }), vendeur())
    expect(f.client.adresseFacturation).toBe('')
    expect(f.prestation.lieu).toBe('Centre auto · 8 avenue Foch, 69006 Lyon')
  })

  it('au centre auto, un client professionnel garde son adresse de facturation', () => {
    const f = construireFacture(reservation({
      lieu: 'centre', address: '8 avenue Foch, 69006 Lyon',
      is_professional: true, company_name: 'Flotte Démo SAS', billing_address: '3 place de la Démo, 33000 Bordeaux',
    }), vendeur())
    expect(f.client.adresseFacturation).toBe('3 place de la Démo, 33000 Bordeaux')
  })

  it('à domicile : lieu de la prestation inchangé', () => {
    const f = construireFacture(reservation({ lieu: 'domicile' }), vendeur())
    expect(f.prestation.lieu).toBe('1 rue de la Démo, 75000 Paris')
    expect(f.client.adresseFacturation).toBe('1 rue de la Démo, 75000 Paris')
  })

  it('client professionnel : raison sociale, SIREN tiré du SIRET, adresse de facturation', () => {
    const f = construireFacture(reservation({
      is_professional: true, company_name: 'Flotte Démo SAS', siret: '123 456 789 00007',
      billing_address: '3 place de la Démo, 33000 Bordeaux',
    }), vendeur())
    expect(f.client).toMatchObject({
      professionnel: true, entreprise: 'Flotte Démo SAS', siren: '123456789',
      adresseFacturation: '3 place de la Démo, 33000 Bordeaux',
    })
  })

  it('laveur qui facture la TVA : taux et numéro portés sur la facture', () => {
    const f = construireFacture(reservation(), vendeur({ facture_regime_tva: 'assujetti', facture_numero_tva: 'fr32 123456789' }))
    expect(f.vendeur).toMatchObject({ regimeTva: 'assujetti', tauxTva: 20, numeroTva: 'FR32123456789' })
    expect(f.totaux.ttc).toBe(115)
    expect(f.totaux.ht).toBe(95.83)
  })

  it('une remise ne peut pas dépasser le montant facturé', () => {
    const f = construireFacture(reservation({ is_smart_slot: true, smart_discount: 500 }), vendeur())
    expect(f.totaux.ttc).toBe(0)
  })

  it('porte le logo et la couleur du laveur', () => {
    const f = construireFacture(reservation(), vendeur({ logo_url: 'https://exemple.supabase.co/logo.webp', brand_color: '#1651E8' }))
    expect(f.vendeur).toMatchObject({ logoUrl: 'https://exemple.supabase.co/logo.webp', couleur: '#1651E8' })
  })
})

describe('entrepreneur individuel ou société', () => {
  it('ajoute « EI » au nom d’un entrepreneur individuel qui ne l’a pas écrit', () => {
    expect(nomLegalAffiche('Jean Démo', 'ei')).toBe('Jean Démo EI')
    expect(nomLegalAffiche('Jean Démo EI', 'ei')).toBe('Jean Démo EI')
    expect(nomLegalAffiche('Jean Démo, entrepreneur individuel', 'ei')).toBe('Jean Démo, entrepreneur individuel')
    expect(construireFacture(reservation(), vendeur({ facture_nom_legal: 'Jean Démo' })).vendeur.nomLegal).toBe('Jean Démo EI')
  })

  it('ne touche pas au nom d’une société', () => {
    expect(nomLegalAffiche('Démo Lavage', 'societe')).toBe('Démo Lavage')
  })

  it('une société doit indiquer sa forme juridique, son capital et son RCS', () => {
    expect(infosFacturationManquantes(vendeur({ facture_statut: 'societe' }))).toEqual([
      'votre forme juridique', 'votre capital social', 'votre immatriculation (RCS)',
    ])
  })

  it('ces mentions de société sont figées sur la facture', () => {
    const f = construireFacture(reservation(), vendeur({
      facture_statut: 'societe', facture_nom_legal: 'Démo Lavage',
      facture_forme_juridique: 'SASU', facture_capital: '1 000 €', facture_immatriculation: 'RCS Pontoise 123 456 789',
    }))
    expect(f.vendeur).toMatchObject({
      statut: 'societe', nomLegal: 'Démo Lavage', formeJuridique: 'SASU',
      capital: '1 000 €', immatriculation: 'RCS Pontoise 123 456 789',
    })
  })
})

describe('Belgique (ouverture du 2026-11-11)', () => {
  it('valide un numéro BCE et un numéro de TVA belge (clé modulo 97)', () => {
    // 0123.456.749 : 97 − (01234567 mod 97) = 49
    expect(siretValide('0123.456.749')).toBe(true)
    expect(siretValide('0123456748')).toBe(false)
    expect(numeroTvaValide('BE 0123.456.749')).toBe(true)
    expect(numeroTvaValide('BE0123456748')).toBe(false)
  })
  it('déduit le pays et propose les bons taux et la bonne mention', () => {
    expect(paysFacturation({ facture_numero_tva: 'BE0123456749' })).toBe('BE')
    expect(paysFacturation({ facture_siret: '0123456749' })).toBe('BE')
    expect(paysFacturation({ phone: '+32470123456' })).toBe('BE')
    expect(paysFacturation({ facture_siret: '12345678901234', phone: '0612345678' })).toBe('FR')
    expect(tauxTvaPour('BE')).toEqual([21, 12, 6])
    expect(tauxTvaPour('FR')).toEqual([20, 10, 5.5])
    expect(mentionFranchiseTva('BE')).toContain('56bis')
    expect(mentionFranchiseTva('FR')).toContain('293 B')
  })
})

describe('Suisse (ouverture du 2026-11-13)', () => {
  it('valide un numéro IDE (clé modulo 11) et un numéro de TVA suisse', () => {
    // CHE-109.322.551 : 5·1 + 4·0 + 3·9 + 2·3 + 7·2 + 6·2 + 5·5 + 4·5 = 109 → 11 − (109 mod 11) = 1
    expect(ideSuisseValide('CHE-109.322.551')).toBe(true)
    expect(siretValide('CHE-109.322.551')).toBe(true)
    expect(siretValide('che109322551')).toBe(true)
    expect(siretValide('CHE-109.322.552')).toBe(false) // mauvaise clé
    expect(siretValide('CHE-123.456.788')).toBe(true)
    expect(siretValide('CHE-12345678')).toBe(false) // trop court
    expect(numeroTvaValide('CHE-109.322.551 TVA')).toBe(true)
    expect(numeroTvaValide('CHE-109.322.551 MWST')).toBe(true)
    expect(numeroTvaValide('CHE109322551')).toBe(true)
    expect(numeroTvaValide('CHE-109.322.552 TVA')).toBe(false)
  })
  it('écrit le numéro de TVA suisse sous sa forme légale', () => {
    expect(normaliserNumeroTva('che109322551')).toBe('CHE-109.322.551 TVA')
    expect(normaliserNumeroTva('CHE-109.322.551 mwst')).toBe('CHE-109.322.551 MWST')
    expect(normaliserNumeroTva('FR 40 123456789')).toBe('FR40123456789') // inchangé hors Suisse
    expect(normaliserSiret('CHE-109.322.551')).toBe('CHE109322551')
  })
  it('déduit le pays et propose les bons taux et la bonne mention', () => {
    expect(paysFacturation({ facture_numero_tva: 'CHE-109.322.551 TVA' })).toBe('CH')
    expect(paysFacturation({ facture_siret: 'CHE109322551' })).toBe('CH')
    expect(paysFacturation({ phone: '+41791234567' })).toBe('CH')
    expect(tauxTvaPour('CH')).toEqual([8.1, 2.6, 3.8])
    expect(tauxTvaNormal('CH')).toBe(8.1)
    expect(tauxTvaNormal('FR')).toBe(20)
    expect(mentionFranchiseTva('CH')).toContain('100 000 CHF')
    expect(mentionFranchiseTva('CH')).toContain('LTVA')
  })
  it('libellés et affichage de l’identifiant', () => {
    expect(libelleCourtIdentifiant('CHE109322551')).toBe('N° IDE')
    expect(libelleCourtIdentifiant('0123456749')).toBe('N° BCE')
    expect(libelleCourtIdentifiant('12345678901234')).toBe('SIRET')
    expect(identifiantAffiche('CHE109322551')).toBe('CHE-109.322.551')
    expect(identifiantAffiche('12345678901234')).toBe('12345678901234')
  })
  it('un laveur suisse sans IDE valide se voit demander son numéro IDE', () => {
    const manques = infosFacturationManquantes({ facture_nom_legal: 'Lavage Léman', facture_siret: 'CHE-109.322.552', facture_adresse: 'Rue du Lac 1, 1204 Genève', facture_numero_tva: 'CHE-109.322.552 TVA' })
    expect(manques).toContain('votre numéro IDE (CHE)')
  })
  it('un laveur suisse assujetti facture à 8,1 % par défaut', () => {
    const f = construireFacture(reservation(), {
      name: 'Lavage Léman', phone: '+41791234567', facture_statut: 'ei', facture_nom_legal: 'Jean Dupont',
      facture_siret: 'CHE-109.322.551', facture_adresse: 'Rue du Lac 1, 1204 Genève',
      facture_regime_tva: 'assujetti', facture_numero_tva: 'CHE-109.322.551 TVA',
    })
    expect(f.vendeur.tauxTva).toBe(8.1)
    expect(f.vendeur.numeroTva).toBe('CHE-109.322.551 TVA')
    expect(f.vendeur.siret).toBe('CHE109322551')
  })
})

describe('règles du profil selon le pays du téléphone', () => {
  it('un téléphone belge ou suisse donne le pays, un français ne tranche pas', () => {
    expect(paysDuTelephoneLaveur('+32470123456')).toBe('BE')
    expect(paysDuTelephoneLaveur('+41 79 123 45 67')).toBe('CH')
    expect(paysDuTelephoneLaveur('0612345678')).toBeNull()
    expect(paysDuTelephoneLaveur(null)).toBeNull()
  })

  it('chaque pays a son titre d’identifiant, ses formes juridiques et son immatriculation', () => {
    expect(reglesPays('FR').identifiantTitre).toBe('SIRET')
    expect(reglesPays('BE').identifiantTitre).toMatch(/BCE/)
    expect(reglesPays('CH').identifiantTitre).toMatch(/IDE/)
    expect(reglesPays('BE').formes).toContain('SRL')
    expect(reglesPays('CH').formes).toContain('Sàrl')
    expect(reglesPays('FR').formes).toContain('SASU')
    expect(reglesPays('BE').immatriculationExemple).toMatch(/^RPM/)
    expect(reglesPays('CH').immatriculationExemple).toMatch(/^RC /)
  })

  it('un identifiant d’un autre pays est refusé', () => {
    const be = '0123456749' // BCE valide (clé 49)
    const ch = 'CHE-109.322.551'
    expect(identifiantValidePour('BE', be)).toBe(true)
    expect(identifiantValidePour('BE', ch)).toBe(false)
    expect(identifiantValidePour('BE', '12345678900012')).toBe(false)
    expect(identifiantValidePour('CH', ch)).toBe(true)
    expect(identifiantValidePour('CH', be)).toBe(false)
    expect(identifiantValidePour('FR', be)).toBe(false)
    expect(identifiantValidePour('FR', ch)).toBe(false)
  })

  it('un identifiant vide n’est pas contrôlé (champ facultatif)', () => {
    expect(identifiantValidePour('CH', '')).toBe(true)
    expect(identifiantValidePour('BE', '  ')).toBe(true)
  })
})

describe('paysDuProfil', () => {
  it('le téléphone belge ou suisse l’emporte sur ce qui est saisi', () => {
    expect(paysDuProfil({ phone: '+41791234567', facture_siret: '12345678900012' })).toBe('CH')
    expect(paysDuProfil({ phone: '+32470123456', facture_numero_tva: 'FR40123456789' })).toBe('BE')
  })

  it('un téléphone français laisse l’identifiant décider', () => {
    expect(paysDuProfil({ phone: '0612345678' })).toBe('FR')
    expect(paysDuProfil({ phone: '0612345678', facture_siret: '0123456749' })).toBe('BE')
  })
})

describe('Luxembourg', () => {
  it('numéro de TVA : LU + 8 chiffres, clé = six premiers chiffres modulo 89', () => {
    expect(numeroTvaValide('LU20260743')).toBe(true) // numéro réel (clé 43)
    expect(numeroTvaValide('LU 2026 0743')).toBe(true)
    expect(numeroTvaValide('LU20260744')).toBe(false)
    expect(numeroTvaValide('LU1234567')).toBe(false)
  })

  it('identifiant : RCS (B + chiffres) ou matricule de 11 ou 13 chiffres', () => {
    for (const bon of ['B123456', 'b12', '19992412345', '1987012345678', '1999 2412 345']) expect(identifiantValidePour('LU', bon), bon).toBe(true)
    for (const mauvais of ['123456', 'B1234567', '1234567890', '73282932000074', 'CHE-109.322.551']) expect(identifiantValidePour('LU', mauvais), mauvais).toBe(false)
    expect(siretValide('B123456')).toBe(true) // reconnu comme identifiant, sans être un SIRET
  })

  it('le pays se lit sur le téléphone, la TVA ou l’identifiant', () => {
    expect(paysDuTelephoneLaveur('+352621123456')).toBe('LU')
    expect(paysDuProfil({ phone: '+352621123456' })).toBe('LU')
    expect(paysFacturation({ facture_numero_tva: 'LU20260743' })).toBe('LU')
    expect(paysFacturation({ facture_siret: 'B123456' })).toBe('LU')
  })

  it('taux (17 % par défaut), règles du profil et mention de franchise', () => {
    expect(tauxTvaNormal('LU')).toBe(17)
    expect(tauxTvaPour('LU')).toEqual([17, 14, 8, 3])
    expect(reglesPays('LU').formes).toContain('SARL')
    expect(reglesPays('LU').immatriculationExemple).toMatch(/^RCS Luxembourg/)
    expect(mentionFranchiseTva('LU')).toMatch(/art\. 57/)
  })
})

describe('Québec', () => {
  it('NEQ : 10 chiffres commençant par 11, 22, 33 ou 88', () => {
    for (const bon of ['1123456789', '2234567890', '3345678901', '8856789012', '1123 456 789']) expect(identifiantValidePour('QC', bon), bon).toBe(true)
    for (const mauvais of ['4423456789', '112345678', '73282932000074', 'CHE-109.322.551', 'B123456']) expect(identifiantValidePour('QC', mauvais), mauvais).toBe(false)
    expect(siretValide('1123456789')).toBe(true)
  })

  it('un BCE belge valide reste belge même s’il commence par 1', () => {
    expect(identifiantValidePour('BE', '0123456749')).toBe(true)
    expect(identifiantValidePour('QC', '0123456749')).toBe(false)
    expect(paysFacturation({ facture_siret: '0123456749' })).toBe('BE')
  })

  it('numéro de TPS (…RT0001) ou de TVQ (…TQ0001)', () => {
    expect(numeroTvaValide('123456789 RT 0001')).toBe(true)
    expect(numeroTvaValide('1234567890TQ0001')).toBe(true)
    expect(numeroTvaValide('123456789RT01')).toBe(false)
    expect(paysFacturation({ facture_numero_tva: '123456789RT0001' })).toBe('QC')
  })

  it('le pays se lit sur le téléphone, avec un indicatif québécois seulement', () => {
    expect(paysDuTelephoneLaveur('+15142345678')).toBe('QC')
    expect(paysDuTelephoneLaveur('+14162345678')).toBeNull()
    expect(paysDuProfil({ phone: '+15142345678' })).toBe('QC')
  })

  it('taux cumulé 14,975 % par défaut, règles du profil et mention de petit fournisseur', () => {
    expect(tauxTvaNormal('QC')).toBe(14.975)
    expect(reglesPays('QC').formes).toContain('Inc.')
    expect(reglesPays('QC').identifiantTitre).toMatch(/NEQ/)
    expect(mentionFranchiseTva('QC')).toMatch(/30 000/)
  })

  it('libellé court d’un identifiant d’après sa forme', () => {
    expect(libelleCourtIdentifiant('1123456789')).toBe('NEQ')
    expect(libelleCourtIdentifiant('0123456749')).toBe('N° BCE')
    expect(libelleCourtIdentifiant('B123456')).toBe('N° RCS')
    expect(libelleCourtIdentifiant('73282932000074')).toBe('SIRET')
  })
})
