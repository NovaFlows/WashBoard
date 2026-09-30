import { describe, expect, it } from 'vitest'
import {
  ajouterPalier, joursAvantPurge, nettoyerExpediteur, nomConfirme, resumeFraisDeplacement,
  resumeAdresseDepart, resumeEquipe, resumeFacturation, resumeNomEntreprise, resumeTelephone,
  validerEmail, validerFacturation, validerMotDePasse, validerNomEntreprise, validerTelephone,
} from './profil'

const COMPLET = {
  facture_statut: 'ei' as const,
  facture_nom_legal: 'Jean Dupont',
  facture_siret: '73282932000074',
  facture_adresse: '8 rue des Lilas, 95560 Maffliers',
  facture_regime_tva: 'franchise' as const,
}

describe('résumés des lignes', () => {
  it('dit « À renseigner » en ambre quand c’est vide', () => {
    expect(resumeNomEntreprise('  ')).toEqual({ texte: 'À renseigner', ton: 'ambre' })
    expect(resumeTelephone(null)).toEqual({ texte: 'À renseigner', ton: 'ambre' })
    expect(resumeAdresseDepart(undefined).ton).toBe('ambre')
  })

  it('affiche la valeur, le téléphone mis en forme', () => {
    expect(resumeNomEntreprise('Kooki Clean')).toEqual({ texte: 'Kooki Clean' })
    expect(resumeTelephone('0612345678').texte).toBe('06 12 34 56 78')
    expect(resumeAdresseDepart('8 rue des Lilas')).toEqual({ texte: '8 rue des Lilas' })
  })

  it('compte ce qui manque à la facturation', () => {
    expect(resumeFacturation(COMPLET)).toEqual({ texte: 'Complètes' })
    expect(resumeFacturation({ ...COMPLET, facture_siret: null })).toEqual({ texte: '1 information manquante', ton: 'ambre' })
    expect(resumeFacturation({ ...COMPLET, facture_siret: null, facture_adresse: null }))
      .toEqual({ texte: '2 informations manquantes', ton: 'ambre' })
  })

  it('dit « Pro » à qui n’a pas la gestion d’équipe', () => {
    expect(resumeEquipe(3, false)).toEqual({ texte: 'Pro' })
    expect(resumeEquipe(3, true)).toEqual({ texte: '3 laveurs' })
    expect(resumeEquipe(null, true)).toEqual({ texte: '1 laveur' })
  })
})

describe('vérifications de saisie', () => {
  it('refuse un nom d’entreprise vide', () => {
    expect(validerNomEntreprise('Kooki')).toBeNull()
    expect(validerNomEntreprise('   ')).toContain('vide')
  })

  it('accepte un téléphone vide, refuse un numéro impossible', () => {
    expect(validerTelephone('')).toBeNull()
    expect(validerTelephone('06 12 34 56 78')).toBeNull()
    expect(validerTelephone('+33612345678')).toBeNull()
    expect(validerTelephone('12345')).toContain('invalide')
  })

  it('vérifie l’adresse e-mail', () => {
    expect(validerEmail(' jean@exemple.fr ')).toBeNull()
    expect(validerEmail('jean@exemple')).toContain('invalide')
    expect(validerEmail('')).toContain('invalide')
  })

  it('exige 6 caractères et deux saisies identiques pour le mot de passe', () => {
    expect(validerMotDePasse('secret1', 'secret1')).toBeNull()
    expect(validerMotDePasse('court', 'court')).toContain('6 caractères')
    expect(validerMotDePasse('secret1', 'secret2')).toContain('identiques')
  })

  it('refuse un SIRET, une TVA ou un numéro de facture impossibles', () => {
    const base = { siret: '', regime: 'franchise' as const, numeroTva: '', prochainNumero: '7', numeroActuel: 7 }
    expect(validerFacturation(base)).toBeNull()
    expect(validerFacturation({ ...base, siret: '123' })).toContain('SIRET')
    expect(validerFacturation({ ...base, regime: 'assujetti', numeroTva: 'FR123' })).toContain('TVA')
    expect(validerFacturation({ ...base, prochainNumero: '6' })).toContain('arrière')
    expect(validerFacturation({ ...base, prochainNumero: '7,5' })).toContain('entier')
    // Avancer la numérotation reste possible (reprise d'un ancien logiciel).
    expect(validerFacturation({ ...base, prochainNumero: '120' })).toBeNull()
  })
})

describe('frais de déplacement', () => {
  it('résume les paliers', () => {
    expect(resumeFraisDeplacement([]).texte).toBe('Aucun : le déplacement est offert')
    expect(resumeFraisDeplacement(null).texte).toBe('Aucun : le déplacement est offert')
    expect(resumeFraisDeplacement([{ max_minutes: 10, fee: 5 }]).texte).toBe('1 palier, jusqu’à 5 €')
    expect(resumeFraisDeplacement([{ max_minutes: 10, fee: 5 }, { max_minutes: 20, fee: 12.5 }]).texte)
      .toBe('2 paliers, jusqu’à 12,50 €')
  })

  it('ajoute un palier trié, et remplace une durée déjà saisie', () => {
    const a = ajouterPalier([{ max_minutes: 30, fee: 10 }], '15', '4')
    expect(a.erreur).toBeNull()
    expect(a.tiers).toEqual([{ max_minutes: 15, fee: 4 }, { max_minutes: 30, fee: 10 }])
    const b = ajouterPalier(a.tiers, '30', '11,5')
    expect(b.tiers).toEqual([{ max_minutes: 15, fee: 4 }, { max_minutes: 30, fee: 11.5 }])
  })

  it('refuse une durée ou des frais invalides sans rien ajouter', () => {
    const base = [{ max_minutes: 10, fee: 5 }]
    for (const [m, f] of [['', '5'], ['0', '5'], ['abc', '5'], ['10', ''], ['10', '-1']]) {
      const r = ajouterPalier(base, m, f)
      expect(r.erreur).not.toBeNull()
      expect(r.tiers).toBe(base)
    }
    expect(ajouterPalier(base, '20', '0').erreur).toBeNull()
  })
})

describe('expéditeur SMS et compte', () => {
  it('nettoie le nom d’expéditeur', () => {
    expect(nettoyerExpediteur('Kooki Clean !')).toBe('KookiClean')
    expect(nettoyerExpediteur('Éclat-Auto 2026 Longnom')).toBe('clatAuto202')
    expect(nettoyerExpediteur('')).toBe('')
  })

  it('compte les jours avant la purge', () => {
    const t0 = Date.parse('2026-09-30T10:00:00Z')
    expect(joursAvantPurge(null, t0)).toBe(30)
    expect(joursAvantPurge('2026-09-30T09:00:00Z', t0)).toBe(30)
    expect(joursAvantPurge('2026-09-20T10:00:00Z', t0)).toBe(20)
    expect(joursAvantPurge('2026-06-01T10:00:00Z', t0)).toBe(0)
  })

  it('confirme le nom de l’entreprise sans tenir compte de la casse ni des espaces', () => {
    expect(nomConfirme('  kooki clean ', 'Kooki Clean')).toBe(true)
    expect(nomConfirme('Kooki', 'Kooki Clean')).toBe(false)
    expect(nomConfirme('', '')).toBe(false)
  })
})
