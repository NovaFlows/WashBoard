import { describe, it, expect, afterEach } from 'vitest'
import { detectDevice, extractReferrerHost, resolveReferrerHost, getOrCreateSessionId, resolveCampagne, resolveCreation } from './funnelTracking'

describe('detectDevice', () => {
  it('classe en mobile sous 640px', () => {
    expect(detectDevice(375)).toBe('mobile')
    expect(detectDevice(639)).toBe('mobile')
  })

  it('classe en tablet entre 640 et 1023px', () => {
    expect(detectDevice(640)).toBe('tablet')
    expect(detectDevice(1023)).toBe('tablet')
  })

  it('classe en desktop à partir de 1024px', () => {
    expect(detectDevice(1024)).toBe('desktop')
    expect(detectDevice(1920)).toBe('desktop')
  })
})

describe('extractReferrerHost', () => {
  it('retourne undefined si le referrer est vide', () => {
    expect(extractReferrerHost('', 'www.washboard.fr')).toBeUndefined()
  })

  it('retourne undefined si le referrer est le même site (navigation interne)', () => {
    expect(extractReferrerHost('https://www.washboard.fr/dashboard', 'www.washboard.fr')).toBeUndefined()
  })

  it('extrait le host pour un referrer externe', () => {
    expect(extractReferrerHost('https://www.google.com/search?q=laveur', 'www.washboard.fr')).toBe('www.google.com')
    expect(extractReferrerHost('https://www.instagram.com/', 'www.washboard.fr')).toBe('www.instagram.com')
  })

  it('ne fuite jamais le chemin ou les paramètres de la query', () => {
    const host = extractReferrerHost('https://www.google.com/search?q=email@example.com', 'www.washboard.fr')
    expect(host).toBe('www.google.com')
  })

  it('retourne undefined pour un referrer malformé plutôt que de lever une exception', () => {
    expect(extractReferrerHost('pas-une-url', 'www.washboard.fr')).toBeUndefined()
  })
})

describe('resolveReferrerHost', () => {
  it('priorise ?utm_source sur le referrer du navigateur', () => {
    // Cas réel visé : navigateur intégré Instagram/TikTok qui ne transmet
    // aucun referrer — sans le paramètre, ça retomberait sur "direct".
    expect(resolveReferrerHost('', 'www.washboard.fr', '?utm_source=instagram')).toBe('instagram.com')
    expect(resolveReferrerHost('', 'www.washboard.fr', '?utm_source=tiktok')).toBe('tiktok.com')
    expect(resolveReferrerHost('', 'www.washboard.fr', '?utm_source=facebook')).toBe('facebook.com')
    expect(resolveReferrerHost('', 'www.washboard.fr', '?utm_source=google')).toBe('google.com')
  })

  it('ignore un utm_source inconnu et retombe sur le referrer', () => {
    expect(resolveReferrerHost('https://www.google.com/', 'www.washboard.fr', '?utm_source=newsletter'))
      .toBe('www.google.com')
  })

  it('est insensible à la casse du paramètre', () => {
    expect(resolveReferrerHost('', 'www.washboard.fr', '?utm_source=Instagram')).toBe('instagram.com')
  })

  it('sans utm_source, retombe sur extractReferrerHost', () => {
    expect(resolveReferrerHost('https://www.instagram.com/', 'www.washboard.fr', '')).toBe('www.instagram.com')
    expect(resolveReferrerHost('', 'www.washboard.fr', '')).toBeUndefined()
  })
})

describe('getOrCreateSessionId — stockage indisponible', () => {
  // Les navigateurs intégrés de TikTok et Instagram, d'où vient une bonne part
  // du trafic des laveurs, peuvent interdire sessionStorage. L'accès lève
  // alors une exception au lieu de renvoyer null.
  const vrai = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    // `window` est en lecture seule dans cet environnement : on restaure le
    // descripteur d'origine plutôt que d'assigner la propriété.
    if (vrai) Object.defineProperty(globalThis, 'window', vrai)
  })

  it('ne laisse pas l’exception casser le parcours de réservation', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get sessionStorage(): Storage { throw new Error('Access denied') },
      },
    })
    expect(() => getOrCreateSessionId()).not.toThrow()
    expect(getOrCreateSessionId()).toBe('')
  })
})

describe('resolveCampagne / resolveCreation', () => {
  // Ces deux valeurs décident à quel budget et à quelle vidéo une réservation
  // est rattachée. Si l'une se perd entre la première et la dernière étape du
  // formulaire, le laveur conclut que sa pub ne marche pas.
  const vrai = Object.getOwnPropertyDescriptor(globalThis, 'window')

  function fausseFenetre(): void {
    const memoire = new Map<string, string>()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (k: string) => memoire.get(k) ?? null,
          setItem: (k: string, v: string) => { memoire.set(k, v) },
        },
      },
    })
  }

  afterEach(() => {
    if (vrai) Object.defineProperty(globalThis, 'window', vrai)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  it('lit les deux paramètres du lien d’une vidéo', () => {
    fausseFenetre()
    const url = '?utm_source=facebook&utm_campaign=pub-rentree&utm_content=avant-apres'
    expect(resolveCampagne(url)).toBe('pub-rentree')
    expect(resolveCreation(url)).toBe('avant-apres')
  })

  it('retient la création pour la suite du formulaire', () => {
    // Les étapes suivantes n'ont plus les paramètres dans l'URL : sans cette
    // mémoire, la vidéo perdrait toutes ses réservations dès l'étape 2.
    fausseFenetre()
    resolveCreation('?utm_content=avant-apres')
    expect(resolveCreation('')).toBe('avant-apres')
  })

  it('ne confond pas la campagne et la création', () => {
    // Deux mémoires distinctes : une seule clé de stockage pour les deux ferait
    // écrire la vidéo par-dessus la campagne, et le budget disparaîtrait.
    fausseFenetre()
    resolveCampagne('?utm_campaign=pub-rentree')
    resolveCreation('?utm_content=avant-apres')
    expect(resolveCampagne('')).toBe('pub-rentree')
    expect(resolveCreation('')).toBe('avant-apres')
  })

  it('nettoie ce qui arrive d’une URL publique', () => {
    fausseFenetre()
    expect(resolveCreation('?utm_content=Avant%2FAprès!')).toBe('avantaprs')
  })

  it('rend undefined sans paramètre plutôt qu’une chaîne vide', () => {
    fausseFenetre()
    expect(resolveCreation('')).toBeUndefined()
    expect(resolveCreation('?utm_content=')).toBeUndefined()
  })

  it('se contente de l’URL quand le stockage est refusé', () => {
    // Navigateurs intégrés de TikTok et Instagram : l'accès lève au lieu de
    // rendre null. Mieux vaut une attribution qui ne survit pas à l'étape
    // suivante qu'un formulaire qui plante.
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { get sessionStorage(): Storage { throw new Error('Access denied') } },
    })
    expect(resolveCreation('?utm_content=avant-apres')).toBe('avant-apres')
    expect(() => resolveCreation('')).not.toThrow()
    expect(resolveCreation('')).toBeUndefined()
  })
})
