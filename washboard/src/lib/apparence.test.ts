import { describe, it, expect } from 'vitest'
import {
  contrasteBlanc, contrasteInsuffisant, estHorsNuancier, libelleFond, estPhotoPerso, miniaturePhoto,
  messageTropLong, messageNormalise, MESSAGE_LONGUEUR_CONSEILLEE, normaliserSiteWeb,
  ERREUR_SITE_SCHEMA, ERREUR_SITE_INVALIDE, ERREUR_SITE_PRIVE, ERREUR_SITE_LONGUE, ERREUR_SITE_IDENTIFIANTS,
  estImageAcceptee, TYPES_IMAGE_ACCEPTES,
  phraseProgression, LIBELLE_FOND_ORIGINAL, LIBELLE_FOND_PHOTO, SEUIL_CONTRASTE,
} from './apparence'
import { BG_THEME_PRESETS, PALETTE } from './themes'

describe('contrasteBlanc (WCAG)', () => {
  it('blanc sur blanc = 1, blanc sur noir = 21 (bornes de la formule)', () => {
    expect(contrasteBlanc('#ffffff')).toBeCloseTo(1, 5)
    expect(contrasteBlanc('#000000')).toBeCloseTo(21, 5)
  })

  it('valeurs de référence : #777777 (4,48:1) et le bleu par défaut du site (5,17:1)', () => {
    expect(contrasteBlanc('#777777')).toBeCloseTo(4.48, 1)
    expect(contrasteBlanc('#2563eb')).toBeCloseTo(5.17, 1)
  })

  it('le bleu ciel #0ea5e9 est sous le seuil (2,8:1)', () => {
    expect(contrasteBlanc('#0ea5e9')).toBeCloseTo(2.77, 1)
    expect(contrasteInsuffisant('#0ea5e9')).toBe(true)
  })

  it('accepte #rgb, les majuscules et les espaces autour', () => {
    expect(contrasteBlanc('#fff')).toBeCloseTo(1, 5)
    expect(contrasteBlanc(' #0EA5E9 ')).toBeCloseTo(contrasteBlanc('#0ea5e9')!, 8)
  })

  it('une valeur illisible rend null, et n’avertit jamais (le serveur ne valide pas brand_color)', () => {
    for (const v of ['', 'red', 'rgb(1,2,3)', '#12', '#12345', '#gggggg', 'javascript:1']) {
      expect(contrasteBlanc(v)).toBeNull()
      expect(contrasteInsuffisant(v)).toBe(false)
    }
  })

  it('le seuil est 4,5 : juste au-dessus passe, juste en dessous avertit', () => {
    expect(SEUIL_CONTRASTE).toBe(4.5)
    expect(contrasteInsuffisant('#777777')).toBe(true) // 4,48
    expect(contrasteInsuffisant('#767676')).toBe(false) // 4,54
  })

  it('8 des 24 couleurs du nuancier sont sous le seuil, et ce sont les plus claires', () => {
    const sous = PALETTE.filter(contrasteInsuffisant)
    expect(sous).toHaveLength(8)
    expect(sous).toEqual(expect.arrayContaining(['#0ea5e9', '#16a34a', '#059669', '#d97706']))
    // aucune couleur sombre n'avertit à tort
    for (const sombre of ['#1e3a8a', '#0f172a', '#1e293b', '#374151']) expect(sous).not.toContain(sombre)
  })
})

describe('estHorsNuancier', () => {
  it('une couleur du nuancier n’est pas « hors nuancier », quelle que soit la casse', () => {
    expect(estHorsNuancier('#2563eb')).toBe(false)
    expect(estHorsNuancier('#2563EB')).toBe(false)
  })
  it('une couleur enregistrée par l’ancien écran ou à la main l’est', () => {
    expect(estHorsNuancier('#123456')).toBe(true)
    expect(estHorsNuancier('red')).toBe(true)
  })
  it('rien d’enregistré : pas de choix supplémentaire', () => {
    expect(estHorsNuancier(null)).toBe(false)
    expect(estHorsNuancier('')).toBe(false)
    expect(estHorsNuancier(undefined)).toBe(false)
  })
})

describe('libelleFond / estPhotoPerso', () => {
  it('aucun fond, ou un identifiant inconnu qui n’est pas une adresse : Original', () => {
    expect(libelleFond(null)).toBe(LIBELLE_FOND_ORIGINAL)
    expect(libelleFond(undefined)).toBe(LIBELLE_FOND_ORIGINAL)
    expect(libelleFond('')).toBe(LIBELLE_FOND_ORIGINAL)
    expect(libelleFond('theme-inexistant')).toBe(LIBELLE_FOND_ORIGINAL)
  })
  it('un préréglage porte son nom', () => {
    for (const p of BG_THEME_PRESETS) expect(libelleFond(p.id)).toBe(p.name)
  })
  it('une adresse http(s) est la photo du laveur', () => {
    expect(libelleFond('https://x.supabase.co/storage/v1/object/public/backgrounds/u.webp')).toBe(LIBELLE_FOND_PHOTO)
    expect(estPhotoPerso('https://x.co/f.webp')).toBe(true)
  })
  it('ni un préréglage, ni rien, ni un identifiant inconnu n’est une photo', () => {
    expect(estPhotoPerso('photo1')).toBe(false)
    expect(estPhotoPerso(null)).toBe(false)
    expect(estPhotoPerso('autre')).toBe(false)
  })
})

describe('miniaturePhoto', () => {
  it('remplace la largeur et la qualité au lieu de les doubler', () => {
    const photo = BG_THEME_PRESETS.find(t => t.photo)!.photo!
    const m = new URL(miniaturePhoto(photo))
    expect(m.searchParams.getAll('w')).toEqual(['480'])
    expect(m.searchParams.getAll('q')).toEqual(['60'])
    expect(m.searchParams.get('fit')).toBe('crop')
    expect(m.pathname).toBe(new URL(photo).pathname)
  })
  it('une adresse illisible est rendue telle quelle', () => {
    expect(miniaturePhoto('pas une url')).toBe('pas une url')
  })
})

describe('message d’accueil', () => {
  it('le repère est 120 caractères, et seul le DÉPASSEMENT est signalé', () => {
    expect(MESSAGE_LONGUEUR_CONSEILLEE).toBe(120)
    expect(messageTropLong('a'.repeat(120))).toBe(false)
    expect(messageTropLong('a'.repeat(121))).toBe(true)
  })
  it('les espaces autour ne comptent pas (le serveur les retire)', () => {
    expect(messageTropLong(`  ${'a'.repeat(120)}  `)).toBe(false)
  })
  it('messageNormalise : rogné, et vide → null comme côté serveur', () => {
    expect(messageNormalise('  Bonjour  ')).toBe('Bonjour')
    expect(messageNormalise('   ')).toBeNull()
    expect(messageNormalise('')).toBeNull()
  })
})

describe('normaliserSiteWeb', () => {
  const ok = (valeur: string | null) => ({ ok: true, valeur })
  const ko = (message: string) => ({ ok: false, message })

  it('vide ou espaces = null (le laveur retire son site)', () => {
    expect(normaliserSiteWeb('')).toEqual(ok(null))
    expect(normaliserSiteWeb('   ')).toEqual(ok(null))
  })

  it('ajoute https:// quand aucun schéma n’est saisi (« monsite.fr » était ignoré sans un mot)', () => {
    expect(normaliserSiteWeb('monsite.fr')).toEqual(ok('https://monsite.fr'))
    expect(normaliserSiteWeb('  www.monsite.fr/avis ')).toEqual(ok('https://www.monsite.fr/avis'))
    expect(normaliserSiteWeb('monsite.fr:8080/x')).toEqual(ok('https://monsite.fr:8080/x'))
    expect(normaliserSiteWeb('//monsite.fr')).toEqual(ok('https://monsite.fr'))
  })

  it('garde un schéma http(s) explicite ; l’adresse enregistrée est celle normalisée (schéma et hôte en minuscules)', () => {
    expect(normaliserSiteWeb('https://monsite.fr')).toEqual(ok('https://monsite.fr'))
    expect(normaliserSiteWeb('http://monsite.fr')).toEqual(ok('http://monsite.fr'))
    expect(normaliserSiteWeb('HTTPS://Monsite.fr')).toEqual(ok('https://monsite.fr'))
  })

  it('refuse tout autre schéma, avec une phrase', () => {
    for (const v of [
      'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<b>x</b>', 'mailto:a@b.fr',
      'ftp://monsite.fr', 'file:///etc/passwd', 'tel:+33612345678', 'vbscript:x', 'ftp://', 'ws://[',
    ]) {
      expect(normaliserSiteWeb(v), v).toEqual(ko(ERREUR_SITE_SCHEMA))
    }
  })

  it('refuse ce qui n’est pas une adresse', () => {
    for (const v of ['bonjour', 'mon site.fr', 'https://', 'http://', 'localhost:3000', 'tel:0612345678']) {
      expect(normaliserSiteWeb(v), v).toEqual(ko(ERREUR_SITE_INVALIDE))
    }
  })

  it('refuse un réseau privé, que le serveur ignorerait de toute façon', () => {
    for (const v of ['http://192.168.1.10', '10.0.0.5', 'https://127.0.0.1/x', 'http://169.254.169.254', 'http://intranet.local']) {
      expect(normaliserSiteWeb(v), v).toEqual(ko(ERREUR_SITE_PRIVE))
    }
  })

  it('refuse une adresse démesurée', () => {
    expect(normaliserSiteWeb(`monsite.fr/${'a'.repeat(2100)}`)).toEqual(ko(ERREUR_SITE_LONGUE))
  })

  it('tout ce qui est accepté commence par http(s) : jamais un schéma exécutable dans une valeur enregistrée', () => {
    for (const v of ['monsite.fr', 'https://a.fr', '//a.fr', 'a.fr:80', 'x.y.z/?q=javascript:1']) {
      const r = normaliserSiteWeb(v)
      expect(r.ok).toBe(true)
      expect(r.ok && r.valeur).toMatch(/^https?:\/\//i)
    }
  })
})

describe('phraseProgression', () => {
  it('détourage : la phrase change après quelques secondes', () => {
    expect(phraseProgression('detourage', false)).toBe('On retire le fond…')
    expect(phraseProgression('detourage', true)).toContain('Ça peut prendre du temps la première fois, gardez l’écran ouvert')
  })
  it('envoi : « Mise en ligne… »', () => {
    expect(phraseProgression('envoi', false)).toBe('Mise en ligne…')
    expect(phraseProgression('envoi', true)).toBe('Mise en ligne…')
  })
  it('repos, fini et échec : rien (l’échec a sa propre phrase)', () => {
    expect(phraseProgression('fait', false)).toBeNull()
    expect(phraseProgression('repos', false)).toBeNull()
    expect(phraseProgression('echec', true)).toBeNull()
  })
})

// Corrections issues de la relecture de sécurité (cyber, 2026-09-24) : ce qu'on enregistre
// est l'adresse normalisée par `URL`, jamais la saisie brute ; les identifiants sont refusés.
describe('normaliserSiteWeb — adresse enregistrée propre', () => {
  it('refuse les identifiants dans l’adresse (ils finiraient en clair en base)', () => {
    expect(normaliserSiteWeb('https://user:pass@example.com')).toEqual({ ok: false, message: ERREUR_SITE_IDENTIFIANTS })
    expect(normaliserSiteWeb('user@example.com/x')).toEqual({ ok: false, message: ERREUR_SITE_IDENTIFIANTS })
  })

  it('enregistre l’adresse normalisée : espace encodé, schéma en minuscules, barre oblique retournée', () => {
    const espace = normaliserSiteWeb('https://a.fr/a b')
    expect(espace).toEqual({ ok: true, valeur: 'https://a.fr/a%20b' })
    const majuscules = normaliserSiteWeb('HTTPS://Example.COM')
    expect(majuscules).toEqual({ ok: true, valeur: 'https://example.com' })
    const antislash = String.fromCharCode(92)
    const contre = normaliserSiteWeb('https:' + antislash + antislash + 'example.com')
    expect(contre.ok && contre.valeur).not.toContain(antislash)
  })

  it('un guillemet ou un chevron saisi ressort encodé, jamais brut', () => {
    const r = normaliserSiteWeb('https://a.fr/"><script>')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valeur).not.toMatch(/["<>]/)
    }
  })

  it('un retour à la ligne collé dans le champ ne survit pas', () => {
    const r = normaliserSiteWeb('https://example.com' + String.fromCharCode(10) + 'foo')
    if (r.ok) expect(r.valeur).not.toContain(String.fromCharCode(10))
  })

  it('garde la forme courte pour un site sans chemin, et la barre pour un chemin réel', () => {
    expect(normaliserSiteWeb('monsite.fr')).toEqual({ ok: true, valeur: 'https://monsite.fr' })
    expect(normaliserSiteWeb('monsite.fr/avis?p=1')).toEqual({ ok: true, valeur: 'https://monsite.fr/avis?p=1' })
  })
})

describe('estImageAcceptee — liste blanche jpeg / png / webp', () => {
  it('accepte les trois formats, quelle que soit la casse', () => {
    for (const t of TYPES_IMAGE_ACCEPTES) expect(estImageAcceptee(t)).toBe(true)
    expect(estImageAcceptee('IMAGE/JPEG')).toBe(true)
  })

  it('refuse le SVG (peut contenir un script), le HEIC, le PDF, le texte et l’absence de type', () => {
    for (const t of ['image/svg+xml', 'image/heic', 'image/gif', 'image/avif', 'application/pdf', 'text/plain', 'text/html', '']) {
      expect(estImageAcceptee(t)).toBe(false)
    }
  })
})
