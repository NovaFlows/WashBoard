import { describe, it, expect } from 'vitest'
import {
  construireDocument, dateDansNJours, devisExpire, libelleStatut, lignesDocument,
  messageWhatsapp, saisieDepuisContenu, saisieNeuve, tonStatut, totalDocument,
  validerDocument, validerEnvoi,
  VALIDITE_DEVIS_JOURS, type SaisieDocument,
} from '@/lib/documents'
import type { VendeurFacturable } from '@/lib/facture'

const AUJOURDHUI = '2026-09-27'

const vendeur: VendeurFacturable = {
  name: 'AutoNettoyage',
  phone: '06 12 34 56 78',
  facture_statut: 'ei',
  facture_nom_legal: 'Jean Dupont',
  facture_siret: '73282932000074',
  facture_adresse: '8 rue des Lilas, 95560 Maffliers',
  facture_regime_tva: 'franchise',
}

const saisie = (p: Partial<SaisieDocument> = {}): SaisieDocument => ({
  ...saisieNeuve('facture', AUJOURDHUI),
  clientNom: 'Marie Martin',
  clientEmail: 'marie@example.com',
  clientTelephone: '06 12 34 56 78',
  clientAdresse: '3 allée des Roses, 95000 Cergy',
  lieu: '3 allée des Roses, 95000 Cergy',
  lignes: [{ designation: 'Nettoyage canapé 3 places', quantite: 1, prixUnitaireTtc: 120 }],
  ...p,
})

const devis = (p: Partial<SaisieDocument> = {}) =>
  saisie({ genre: 'devis', date: null, valableJusquau: '2026-10-27', ...p })

describe('dates', () => {
  it('avance de n jours sans dépendre du fuseau du navigateur', () => {
    expect(dateDansNJours('2026-09-27', 30)).toBe('2026-10-27')
    expect(dateDansNJours('2026-12-20', 30)).toBe('2027-01-19')
    // Année bissextile : 2028 a un 29 février.
    expect(dateDansNJours('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('un devis expire le lendemain de sa date de validité, pas le jour même', () => {
    expect(devisExpire('2026-09-27', AUJOURDHUI)).toBe(false)
    expect(devisExpire('2026-09-26', AUJOURDHUI)).toBe(true)
    expect(devisExpire(null, AUJOURDHUI)).toBe(false)
  })

  it('un devis neuf est valable un mois', () => {
    expect(saisieNeuve('devis', AUJOURDHUI).valableJusquau)
      .toBe(dateDansNJours(AUJOURDHUI, VALIDITE_DEVIS_JOURS))
  })

  it('une facture neuve est datée du jour, un devis n’a pas de date de prestation', () => {
    expect(saisieNeuve('facture', AUJOURDHUI).date).toBe(AUJOURDHUI)
    expect(saisieNeuve('devis', AUJOURDHUI).date).toBeNull()
  })
})

describe('lignes et total', () => {
  it('ignore les lignes sans désignation (des cases pas remplies)', () => {
    const l = lignesDocument(saisie({
      lignes: [
        { designation: 'Lavage', quantite: 2, prixUnitaireTtc: 40 },
        { designation: '   ', quantite: 1, prixUnitaireTtc: 999 },
      ],
    }))
    expect(l).toEqual([{ designation: 'Lavage', quantite: 2, prixUnitaireTtc: 40, totalTtc: 80 }])
  })

  it('garde une ligne à 0 € : « offert » se facture aussi', () => {
    const l = lignesDocument(saisie({
      lignes: [{ designation: 'Déplacement offert', quantite: 1, prixUnitaireTtc: 0 }],
    }))
    expect(l).toHaveLength(1)
  })

  it('déduit la remise, sans jamais passer sous zéro', () => {
    expect(totalDocument(saisie({ remiseTtc: 20 }))).toBe(100)
    expect(totalDocument(saisie({ remiseTtc: 500 }))).toBe(0)
  })

  it('arrondit au centime plutôt que de traîner les flottants', () => {
    const t = totalDocument(saisie({
      lignes: [{ designation: 'Tapis', quantite: 3, prixUnitaireTtc: 16.1 }],
    }))
    expect(t).toBe(48.3)
  })
})

describe('validerDocument', () => {
  it('accepte une saisie complète', () => {
    expect(validerDocument(saisie(), AUJOURDHUI)).toBeNull()
    expect(validerDocument(devis(), AUJOURDHUI)).toBeNull()
  })

  it('refuse sans nom de client', () => {
    expect(validerDocument(saisie({ clientNom: '  ' }), AUJOURDHUI)).toMatch(/nom du client/)
  })

  it('refuse un professionnel sans entreprise', () => {
    expect(validerDocument(saisie({ professionnel: true }), AUJOURDHUI)).toMatch(/entreprise/)
  })

  it('refuse un document sans aucune ligne', () => {
    expect(validerDocument(saisie({ lignes: [] }), AUJOURDHUI)).toMatch(/au moins une ligne/)
  })

  it('refuse une quantité aberrante — un prix tapé dans la case quantité', () => {
    expect(validerDocument(saisie({
      lignes: [{ designation: 'Lavage', quantite: 1500, prixUnitaireTtc: 1 }],
    }), AUJOURDHUI)).toMatch(/quantité/)
  })

  it('refuse une remise plus grande que le total', () => {
    expect(validerDocument(saisie({ remiseTtc: 200 }), AUJOURDHUI)).toMatch(/remise dépasse/)
  })

  it('refuse un total nul, et le dit différemment selon le document', () => {
    const lignes = [{ designation: 'Offert', quantite: 1, prixUnitaireTtc: 0 }]
    expect(validerDocument(saisie({ lignes }), AUJOURDHUI)).toMatch(/facture à 0/i)
    expect(validerDocument(devis({ lignes }), AUJOURDHUI)).toMatch(/devis à 0/i)
  })

  it('refuse une facture sans date de prestation, jamais un devis', () => {
    // « Date à convenir » sur une facture ne veut rien dire : elle constate un travail fait.
    expect(validerDocument(saisie({ date: null }), AUJOURDHUI)).toMatch(/date de la prestation/)
    expect(validerDocument(devis({ date: null }), AUJOURDHUI)).toBeNull()
  })

  it('refuse un devis sans validité, ou déjà périmé', () => {
    expect(validerDocument(devis({ valableJusquau: null }), AUJOURDHUI)).toMatch(/valable/)
    expect(validerDocument(devis({ valableJusquau: '2026-09-01' }), AUJOURDHUI)).toMatch(/déjà passée/)
  })

  it('n’impose pas de validité à une facture', () => {
    expect(validerDocument(saisie({ valableJusquau: null }), AUJOURDHUI)).toBeNull()
  })
})

describe('validerEnvoi', () => {
  const contenu = construireDocument(saisie(), vendeur)

  it('laisse passer une adresse valide', () => {
    expect(validerEnvoi(contenu)).toBeNull()
  })

  it('refuse un document sans email plutôt que d’envoyer dans le vide', () => {
    expect(validerEnvoi(construireDocument(saisie({ clientEmail: '' }), vendeur)))
      .toMatch(/pas d’adresse email/)
  })

  it('refuse une adresse mal formée', () => {
    expect(validerEnvoi(construireDocument(saisie({ clientEmail: 'marie@' }), vendeur)))
      .toMatch(/n’est pas valide/)
  })
})

describe('construireDocument', () => {
  it('fige les mentions du laveur et le genre du document', () => {
    const c = construireDocument(devis(), vendeur)
    expect(c.genre).toBe('devis')
    expect(c.vendeur.nomLegal).toBe('Jean Dupont EI')
    expect(c.vendeur.siret).toBe('73282932000074')
    expect(c.valableJusquau).toBe('2026-10-27')
  })

  it('une facture ne porte jamais de date de validité', () => {
    expect(construireDocument(saisie({ valableJusquau: '2026-12-31' }), vendeur).valableJusquau)
      .toBeNull()
  })

  it('en franchise, HT et TTC se confondent', () => {
    expect(construireDocument(saisie(), vendeur).totaux).toEqual({ ht: 120, tva: 0, ttc: 120 })
  })

  it('en assujetti, la TVA est extraite du prix TTC saisi', () => {
    const c = construireDocument(saisie(), {
      ...vendeur, facture_regime_tva: 'assujetti', facture_taux_tva: 20,
      facture_numero_tva: 'FR40303265045',
    })
    expect(c.totaux).toEqual({ ht: 100, tva: 20, ttc: 120 })
    expect(c.vendeur.numeroTva).toBe('FR40303265045')
  })

  it('la remise est plafonnée au total des lignes', () => {
    const c = construireDocument(saisie({ remiseTtc: 500 }), vendeur)
    expect(c.remiseTtc).toBe(120)
    expect(c.totaux.ttc).toBe(0)
  })

  it('un client particulier ne porte ni entreprise ni SIREN, même si les cases sont remplies', () => {
    const c = construireDocument(saisie({ professionnel: false, entreprise: 'Kookii', siret: '73282932000074' }), vendeur)
    expect(c.client.entreprise).toBeNull()
    expect(c.client.siren).toBeNull()
  })

  it('extrait le SIREN du SIRET d’un client professionnel', () => {
    const c = construireDocument(saisie({ professionnel: true, entreprise: 'Kookii Clean', siret: '732 829 320 00074' }), vendeur)
    expect(c.client.siren).toBe('732829320')
  })

  it('à défaut d’adresse de facturation, prend le lieu de la prestation', () => {
    const c = construireDocument(saisie({ clientAdresse: '' }), vendeur)
    expect(c.client.adresseFacturation).toBe('3 allée des Roses, 95000 Cergy')
  })
})

describe('saisieDepuisContenu — transformer un devis accepté en facture', () => {
  it('reprend le client, les lignes et la remise, et laisse tomber la validité', () => {
    const contenu = construireDocument(devis({ remiseTtc: 20, note: 'Intervention sur 2 jours.' }), vendeur)
    const reprise = saisieDepuisContenu(contenu, 'facture')

    expect(reprise.genre).toBe('facture')
    expect(reprise.clientNom).toBe('Marie Martin')
    expect(reprise.clientEmail).toBe('marie@example.com')
    expect(reprise.lignes).toEqual([{ designation: 'Nettoyage canapé 3 places', quantite: 1, prixUnitaireTtc: 120 }])
    expect(reprise.remiseTtc).toBe(20)
    expect(reprise.note).toBe('Intervention sur 2 jours.')
    expect(reprise.valableJusquau).toBeNull()
  })

  it('la facture issue d’un devis porte le même total, au centime', () => {
    const d = devis({ lignes: [{ designation: 'Tapis', quantite: 3, prixUnitaireTtc: 16.1 }], remiseTtc: 8.3 })
    const contenuDevis = construireDocument(d, vendeur)
    const contenuFacture = construireDocument(saisieDepuisContenu(contenuDevis, 'facture'), vendeur)
    expect(contenuFacture.totaux.ttc).toBe(contenuDevis.totaux.ttc)
  })

  it('un devis sans date reprise en facture réclame une date — c’est la route qui la pose', () => {
    // Le devis chiffrait un travail à planifier ; la facture, elle, constate un travail fait.
    // `/api/documents/[id]/facturer` met le jour de l'émission à défaut : sans ça, la facture
    // sortirait avec « Date à convenir » (constaté sur la vraie base le 2026-09-27).
    const reprise = saisieDepuisContenu(construireDocument(devis(), vendeur), 'facture')
    expect(reprise.date).toBeNull()
    expect(validerDocument(reprise, AUJOURDHUI)).toMatch(/date de la prestation/)
    expect(validerDocument({ ...reprise, date: AUJOURDHUI }, AUJOURDHUI)).toBeNull()
  })

  it('un devis déjà daté garde sa date en devenant facture', () => {
    const contenu = construireDocument(devis({ date: '2026-10-05' }), vendeur)
    expect(saisieDepuisContenu(contenu, 'facture').date).toBe('2026-10-05')
  })
})

describe('libellés de statut', () => {
  it('dit la même chose différemment pour un devis et pour une facture', () => {
    expect(libelleStatut({ genre: 'devis', statut: 'envoye' })).toBe('En attente de réponse')
    expect(libelleStatut({ genre: 'facture', statut: 'envoye' })).toBe('Envoyée')
    expect(libelleStatut({ genre: 'devis', statut: 'transforme' })).toBe('Facturé')
  })

  it('l’ambre ne signale que ce qui attend une action du laveur', () => {
    // Un devis accepté et pas encore facturé : c'est de l'argent qui dort.
    expect(tonStatut({ genre: 'devis', statut: 'accepte' })).toBe('ambre')
    expect(tonStatut({ genre: 'devis', statut: 'envoye' })).toBe('gris')
    expect(tonStatut({ genre: 'devis', statut: 'refuse' })).toBe('gris')
    expect(tonStatut({ genre: 'facture', statut: 'emis' })).toBe('vert')
  })
})

describe('téléphone du client', () => {
  it('est rangé sous sa forme canonique, quelle que soit l’écriture', () => {
    for (const ecriture of ['06 12 34 56 78', '+33612345678', '06.12.34.56.78', '0033612345678']) {
      expect(construireDocument(saisie({ clientTelephone: ecriture }), vendeur).client.telephone)
        .toBe('0612345678')
    }
  })

  it('absent quand il n’est pas saisi — un devis peut n’avoir qu’un email', () => {
    expect(construireDocument(saisie({ clientTelephone: '' }), vendeur).client.telephone).toBeNull()
    expect(validerDocument(saisie({ clientTelephone: '' }), AUJOURDHUI)).toBeNull()
  })

  it('refuse un numéro impossible : un chiffre de travers enverrait le devis à un inconnu', () => {
    expect(validerDocument(saisie({ clientTelephone: '06 12 34 56' }), AUJOURDHUI))
      .toMatch(/téléphone/)
  })

  it('suit le client quand le devis devient facture', () => {
    const contenu = construireDocument(devis(), vendeur)
    expect(saisieDepuisContenu(contenu, 'facture').clientTelephone).toBe('0612345678')
  })
})

describe('messageWhatsapp', () => {
  const document = (genre: 'devis' | 'facture', numero: string) => ({
    genre, numero,
    contenu: construireDocument(genre === 'devis' ? devis() : saisie(), vendeur),
  })

  it('annonce le devis, son montant et sa validité', () => {
    const texte = messageWhatsapp(document('devis', 'D-00003'), null, 'AutoNettoyage')

    expect(texte).toContain('Bonjour Marie Martin,')
    expect(texte).toContain('devis n° D-00003')
    expect(texte).toContain('120,00 €')
    expect(texte).toContain('valable jusqu’au 27/10/2026'.replace('’', "'"))
    expect(texte.endsWith('AutoNettoyage')).toBe(true)
  })

  it('aucune URL quand le PDF part avec le message : le client l’a sous les yeux', () => {
    const texte = messageWhatsapp(document('devis', 'D-00003'), null, 'AutoNettoyage')
    expect(texte).not.toMatch(/https?:\/\//)
  })

  it('l’URL n’apparaît que pour le repli wa.me, qui ne transporte que du texte', () => {
    // Sans elle, le client recevrait un message sans son devis.
    const texte = messageWhatsapp(document('devis', 'D-00003'), 'https://washboard.fr/x/pdf', 'AutoNettoyage')
    expect(texte).toContain('https://washboard.fr/x/pdf')
  })

  it('une facture ne parle pas de validité : rien n’expire, c’est dû', () => {
    const texte = messageWhatsapp(document('facture', 'F-00015'), null, 'AutoNettoyage')
    expect(texte).toContain('facture n° F-00015')
    expect(texte).not.toMatch(/valable/)
  })
})
