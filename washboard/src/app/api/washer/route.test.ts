import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests de la route de modification du profil laveur.
//
// Deuxième surface la plus sensible après la réservation : c'est elle qui
// décidait, sur la seule foi de ce que le navigateur envoyait, si un compte
// avait droit aux fonctionnalités Pro. L'audit du 2026-09-05 a relevé qu'un
// compte Essentiel activait les relances automatiques et le multi-laveurs par
// un simple appel — et consommait des SMS facturés à WashBoard.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: unknown
  washer: Reponse
  slugPris: Reponse
  updateError: unknown
}

const updates: Record<string, unknown>[] = []

function nouveauBuilder(table: string) {
  let estUpdate = false
  let charge: Record<string, unknown> | null = null
  const b: Record<string, unknown> = {}
  const self = () => b

  Object.assign(b, {
    select: self,
    eq: self,
    neq: self,
    update: (valeurs: Record<string, unknown>) => { estUpdate = true; charge = valeurs; return b },
    single: () => Promise.resolve(plan.washer),
    // `.neq(...).maybeSingle()` sert au contrôle d'unicité du lien public.
    maybeSingle: () => Promise.resolve(plan.slugPris),
    then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => {
      if (estUpdate) {
        if (charge) updates.push(charge)
        return Promise.resolve({ error: plan.updateError }).then(ok, ko)
      }
      return Promise.resolve(plan.washer ?? { data: null, error: null }).then(ok, ko)
    },
    _table: table,
  })
  return b
}

const fauxClient = {
  from: (table: string) => nouveauBuilder(table),
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))
// Le contrôle d'unicité du lien lit les fiches des AUTRES laveurs : il passe
// donc par le client admin, la session ne voit que sa propre fiche.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxClient }))
vi.mock('@/lib/googleMaps', () => ({ getMapsApiKey: () => null }))

const { PATCH } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/washer', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0]
}

async function patch(body: Record<string, unknown>) {
  const res = await PATCH(requete(body))
  return { res, body: await res.json() }
}

const DECOUVERTE = { data: { plan: 'decouverte', grandfathered: false, id: 'w1' }, error: null }
const STARTER    = { data: { plan: 'starter',    grandfathered: false, id: 'w1' }, error: null }
const PRO        = { data: { plan: 'pro',        grandfathered: false, id: 'w1' }, error: null }
const BUSINESS   = { data: { plan: 'business',   grandfathered: false, id: 'w1' }, error: null }
const HISTORIQUE = { data: { plan: 'decouverte', grandfathered: true,  id: 'w1' }, error: null }

beforeEach(() => {
  updates.length = 0
  plan = {
    utilisateur: { id: 'user-1' },
    washer: DECOUVERTE,
    slugPris: { data: null, error: null },
    updateError: null,
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.restoreAllMocks() })

describe('PATCH /api/washer — authentification', () => {
  it('refuse un appel sans session', async () => {
    plan.utilisateur = null
    const { res } = await patch({ name: 'Test' })
    expect(res.status).toBe(401)
    expect(updates).toHaveLength(0)
  })

  it('refuse quand le profil est illisible plutôt que d offrir le Pro', async () => {
    // Sans certitude sur le plan, débloquer reviendrait à offrir les options
    // payantes dès qu'une lecture échoue.
    plan.washer = { data: null, error: { message: 'RLS' } }
    const { res } = await patch({ followup_enabled: true })
    expect(res.status).toBe(404)
    expect(updates).toHaveLength(0)
  })
})

describe('PATCH /api/washer — ce que chaque offre ouvre (H6)', () => {
  // Le contrôle porte sur le plan LU EN BASE, jamais sur ce que le navigateur
  // envoie : c'est la faille relevée par l'audit du 2026-09-05.

  describe('offre Découverte — rien au-delà de l’agenda', () => {
    it('refuse le multi-laveurs', async () => {
      const { res, body } = await patch({ team_size: 4 })
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/Business/)
      expect(updates).toHaveLength(0)
    })

    it('refuse la personnalisation de la page (logo)', async () => {
      const { res, body } = await patch({ logo_url: 'https://exemple.fr/logo.png' })
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/Starter/)
      expect(updates).toHaveLength(0)
    })

    it('refuse la couleur de marque et le thème de fond', async () => {
      expect((await patch({ brand_color: '#ff0000' })).res.status).toBe(403)
      expect((await patch({ background_theme: 'nuit' })).res.status).toBe(403)
      expect(updates).toHaveLength(0)
    })

    it('refuse les créneaux intelligents', async () => {
      const { res, body } = await patch({ smart_slot_enabled: true })
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/Pro/)
      expect(updates).toHaveLength(0)
    })

    it('ACCEPTE les paliers de frais de déplacement', async () => {
      // Ouverts dès le gratuit : un laveur mobile qui roule quinze kilomètres
      // sans pouvoir les facturer travaille à perte. Lui vendre le droit de ne
      // pas perdre d'argent serait une drôle de façon de commencer.
      const { res } = await patch({ travel_fee_tiers: [{ max_minutes: 30, fee: 10 }] })
      expect(res.status).toBe(200)
      expect(updates).toHaveLength(1)
    })

    it('refuse les avis Google, quel que soit le canal', async () => {
      expect((await patch({ review_enabled: true })).res.status).toBe(403)
      expect((await patch({ review_channel: 'sms' })).res.status).toBe(403)
      expect(updates).toHaveLength(0)
    })

    it('refuse les relances automatiques', async () => {
      const { res } = await patch({ followup_enabled: true })
      expect(res.status).toBe(403)
      expect(updates).toHaveLength(0)
    })

    it('refuse les mentions légales de facturation', async () => {
      const { res, body } = await patch({ facture_siret: '73282932000074' })
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/Pro/)
      expect(updates).toHaveLength(0)
    })

    it('laisse modifier ce qui n’appartient à aucune offre', async () => {
      // Nom, téléphone et message d'accueil restent ouverts à tout le monde :
      // sans eux, l'offre gratuite ne serait pas utilisable du tout.
      const { res } = await patch({ name: 'Kooki Clean', welcome_message: 'Bonjour !' })
      expect(res.status).toBe(200)
      expect(updates[0].name).toBe('Kooki Clean')
    })

    it('laisse RETIRER un réglage payant hérité d’une ancienne offre', async () => {
      // Un laveur qui rétrograde doit pouvoir éteindre ce qu'il n'a plus, et
      // effacer son logo. Bloquer le retrait le laisserait coincé.
      expect((await patch({ followup_enabled: false })).res.status).toBe(200)
      expect((await patch({ logo_url: '' })).res.status).toBe(200)
      expect((await patch({ brand_color: null })).res.status).toBe(200)
      expect((await patch({ travel_fee_tiers: [] })).res.status).toBe(200)
      expect((await patch({ team_size: 1 })).res.status).toBe(200)
    })
  })

  describe('offre Starter — la page et le CRM, rien de plus', () => {
    beforeEach(() => { plan.washer = STARTER })

    it('autorise la personnalisation de la page', async () => {
      expect((await patch({ logo_url: 'https://exemple.fr/logo.png' })).res.status).toBe(200)
      expect((await patch({ brand_color: '#ff0000' })).res.status).toBe(200)
      expect((await patch({ background_theme: 'nuit' })).res.status).toBe(200)
    })

    it('refuse encore tout ce qui appartient au Pro', async () => {
      // Les frais de déplacement n'y sont plus : ils sont ouverts dès le
      // gratuit, donc le Starter les a forcément aussi.
      expect((await patch({ smart_slot_enabled: true })).res.status).toBe(403)
      expect((await patch({ review_enabled: true })).res.status).toBe(403)
      expect((await patch({ followup_enabled: true })).res.status).toBe(403)
      expect((await patch({ facture_siret: '73282932000074' })).res.status).toBe(403)
      expect(updates).toHaveLength(0)
    })

    it('refuse le multi-laveurs, réservé au Business', async () => {
      const { res, body } = await patch({ team_size: 3 })
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/Business/)
    })
  })

  describe('offre Pro — tout sauf l’équipe', () => {
    beforeEach(() => { plan.washer = PRO })

    it('autorise les avis, les relances, les créneaux et les trajets', async () => {
      expect((await patch({ review_enabled: true })).res.status).toBe(200)
      expect((await patch({ review_channel: 'sms' })).res.status).toBe(200)
      expect((await patch({ followup_enabled: true })).res.status).toBe(200)
      expect((await patch({ smart_slot_enabled: true })).res.status).toBe(200)
      expect((await patch({ travel_fee_tiers: [{ max_minutes: 30, fee: 10 }] })).res.status).toBe(200)
    })

    it('autorise les mentions légales de facturation', async () => {
      expect((await patch({ facture_siret: '73282932000074' })).res.status).toBe(200)
    })

    it('refuse toujours le multi-laveurs', async () => {
      const { res, body } = await patch({ team_size: 2 })
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/Business/)
      expect(updates).toHaveLength(0)
    })
  })

  describe('offre Business — l’équipe en plus', () => {
    beforeEach(() => { plan.washer = BUSINESS })

    it('autorise plusieurs laveurs', async () => {
      const { res } = await patch({ team_size: 4 })
      expect(res.status).toBe(200)
      expect(updates[0].team_size).toBe(4)
    })

    it('autorise tout le reste', async () => {
      expect((await patch({ smart_slot_enabled: true })).res.status).toBe(200)
      expect((await patch({ facture_siret: '73282932000074' })).res.status).toBe(200)
      expect((await patch({ logo_url: 'https://exemple.fr/logo.png' })).res.status).toBe(200)
    })
  })

  describe('client historique — tout ouvert, quel que soit le plan en base', () => {
    beforeEach(() => { plan.washer = HISTORIQUE })

    it('n’oppose aucun refus, même avec un plan « decouverte » en base', async () => {
      expect((await patch({ team_size: 4 })).res.status).toBe(200)
      expect((await patch({ followup_enabled: true })).res.status).toBe(200)
      expect((await patch({ review_channel: 'sms' })).res.status).toBe(200)
      expect((await patch({ smart_slot_enabled: true })).res.status).toBe(200)
      expect((await patch({ facture_siret: '73282932000074' })).res.status).toBe(200)
      expect((await patch({ logo_url: 'https://exemple.fr/logo.png' })).res.status).toBe(200)
    })
  })

  describe('ancien plan « essentiel » encore en base', () => {
    beforeEach(() => {
      plan.washer = { data: { plan: 'essentiel', grandfathered: false, id: 'w1' }, error: null }
    })

    it('est traité comme le nouveau Pro — aucun acquis perdu au déploiement', async () => {
      expect((await patch({ review_channel: 'sms' })).res.status).toBe(200)
      expect((await patch({ followup_enabled: true })).res.status).toBe(200)
      expect((await patch({ smart_slot_enabled: true })).res.status).toBe(200)
    })
  })
})

describe('PATCH /api/washer — unicité du lien public', () => {
  it('refuse un lien déjà pris par un autre laveur', async () => {
    plan.slugPris = { data: { id: 'un-autre', user_id: 'user-2' }, error: null }
    const { res, body } = await patch({ slug: 'kooki-clean' })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/déjà utilisé/)
    expect(updates).toHaveLength(0)
  })

  it('laisse un laveur reprendre son propre lien', async () => {
    // Renvoyer 409 sur son propre lien bloquerait toute modification
    // ultérieure de la fiche depuis le même formulaire.
    plan.slugPris = { data: { id: 'w1', user_id: 'user-1' }, error: null }
    const { res } = await patch({ slug: 'kooki-clean' })
    expect(res.status).toBe(200)
    expect(updates[0].slug).toBe('kooki-clean')
  })

  it('refuse un lien détenu par une fiche sans propriétaire', async () => {
    // Les toutes premières fiches ont été créées à la main, sans `user_id`.
    // Un `.neq()` SQL ne les aurait jamais vues : NULL ne se compare à rien.
    plan.slugPris = { data: { id: 'fiche-orpheline', user_id: null }, error: null }
    const { res } = await patch({ slug: 'kookiclean' })
    expect(res.status).toBe(409)
    expect(updates).toHaveLength(0)
  })

  it('refuse plutôt que de réserver un lien à l\'aveugle si la lecture échoue', async () => {
    // Une lecture en échec renverrait « personne », donc « lien libre ».
    plan.slugPris = { data: null, error: { message: 'RLS' } }
    const { res } = await patch({ slug: 'kooki-clean' })
    expect(res.status).toBe(503)
    expect(updates).toHaveLength(0)
  })

  it('traduit un conflit d\'unicité de la base en message clair', async () => {
    // Deux laveurs qui réclament le même lien au même instant passent tous les
    // deux le contrôle : c'est la contrainte de base qui tranche.
    plan.updateError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const { res, body } = await patch({ slug: 'kooki-clean' })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/déjà utilisé/)
  })
})

describe('PATCH /api/washer — format du lien public', () => {
  it('refuse un lien au format invalide', async () => {
    // Les majuscules, elles, sont acceptées puis abaissées (voir plus bas).
    for (const slug of ['ab', '-tiret-devant', 'tiret-derriere-', 'avec espace', 'accentué', 'a'.repeat(41)]) {
      const { res } = await patch({ slug })
      expect(res.status, slug).toBe(400)
    }
    expect(updates).toHaveLength(0)
  })

  it('accepte un lien valide et le normalise en minuscules', async () => {
    const { res } = await patch({ slug: '  Kooki-Clean  ' })
    expect(res.status).toBe(200)
    expect(updates[0].slug).toBe('kooki-clean')
  })
})

describe('PATCH /api/washer — téléphone', () => {
  it('normalise le numéro, pour que l unicité voie deux écritures identiques', async () => {
    // « +33612345678 » et « 06 12 34 56 78 » désignent le même numéro : sans
    // normalisation, la contrainte d'unicité laissait créer un second compte.
    await patch({ phone: '+33612345678' })
    expect(updates[0].phone).toBe('0612345678')
  })

  it('refuse un numéro invalide', async () => {
    const { res } = await patch({ phone: '12' })
    expect(res.status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('accepte un numéro vidé', async () => {
    const { res } = await patch({ phone: '' })
    expect(res.status).toBe(200)
    expect(updates[0].phone).toBeNull()
  })
})

describe('PATCH /api/washer — bornage des valeurs numériques', () => {
  it('borne la taille d équipe d un compte Business', async () => {
    plan.washer = BUSINESS
    await patch({ team_size: 9999 })
    expect(updates[0].team_size).toBe(50)
  })

  it('borne le délai de demande d avis à une semaine', async () => {
    await patch({ review_delay_hours: 100000 })
    expect(updates[0].review_delay_hours).toBe(168)
  })

  it('écarte les paliers de frais de déplacement incohérents', async () => {
    plan.washer = PRO
    await patch({ travel_fee_tiers: [
      { max_minutes: 15, fee: 5 },
      { max_minutes: 0,  fee: 5 },   // durée nulle
      { max_minutes: 30, fee: -10 }, // frais négatif
    ] })
    expect(updates[0].travel_fee_tiers).toEqual([{ max_minutes: 15, fee: 5 }])
  })
})

describe('PATCH /api/washer — réservation le jour même', () => {
  it('accepte l’activation dès l’offre Découverte', async () => {
    // Contrairement aux créneaux intelligents ou aux relances, ce réglage
    // n'appartient à aucune offre — il reste ouvert à tout le monde.
    const { res } = await patch({ reservation_jour_meme: true })
    expect(res.status).toBe(200)
    expect(updates[0].reservation_jour_meme).toBe(true)
  })

  it('normalise en booléen', async () => {
    await patch({ reservation_jour_meme: 1 })
    expect(updates[0].reservation_jour_meme).toBe(true)
  })

  it('accepte la désactivation', async () => {
    await patch({ reservation_jour_meme: false })
    expect(updates[0].reservation_jour_meme).toBe(false)
  })
})

describe('PATCH /api/washer — champs non modifiables', () => {
  it('ignore une tentative de s attribuer le plan Pro', async () => {
    // Le plan vient de Stripe, jamais du navigateur. La route ne recopie que
    // les champs qu'elle connaît : tout le reste tombe.
    const { res } = await patch({ plan: 'pro', grandfathered: true, name: 'Test' })
    expect(res.status).toBe(200)
    expect(updates[0]).not.toHaveProperty('plan')
    expect(updates[0]).not.toHaveProperty('grandfathered')
  })

  it('ignore une tentative de changer de propriétaire', async () => {
    await patch({ user_id: 'quelqu-un-d-autre', id: 'un-autre-laveur', name: 'Test' })
    expect(updates[0]).not.toHaveProperty('user_id')
    expect(updates[0]).not.toHaveProperty('id')
  })
})

describe('PATCH /api/washer — expéditeur SMS', () => {
  // Cas réel du 2026-09-27 : « AutoNettoyage » (13 car.) était accepté, puis
  // tronqué à l'envoi en « AutoNettoya ». L'opérateur remplaçait ce nom coupé
  // par un autre, et le laveur ne comprenait pas pourquoi ses SMS ne portaient
  // pas le nom affiché dans ses réglages.
  it('refuse un nom trop long au lieu de le tronquer', async () => {
    const { res, body } = await patch({ sms_sender: 'AutoNettoyage' })
    expect(res.status).toBe(400)
    expect(body.error).toContain('13 caractères')
    expect(updates).toHaveLength(0)
  })

  it('refuse un espace, un tiret ou un accent', async () => {
    for (const nom of ['Kooki Clean', 'Auto-Net', 'Propreté']) {
      updates.length = 0
      const { res } = await patch({ sms_sender: nom })
      expect(res.status, nom).toBe(400)
      expect(updates).toHaveLength(0)
    }
  })

  it('accepte un nom conforme, et le vide', async () => {
    const { res } = await patch({ sms_sender: 'KookiClean' })
    expect(res.status).toBe(200)
    expect(updates[0].sms_sender).toBe('KookiClean')

    updates.length = 0
    await patch({ sms_sender: '  ' })
    expect(updates[0].sms_sender).toBeNull()
  })
})

describe('PATCH /api/washer — horodatage de la modification du laveur', () => {
  it('pose profile_updated_at quand le laveur change quelque chose', async () => {
    const avant = Date.now()
    const { res } = await patch({ name: 'Test' })
    expect(res.status).toBe(200)
    const pose = new Date(String(updates[0].profile_updated_at)).getTime()
    expect(pose).toBeGreaterThanOrEqual(avant)
    expect(pose).toBeLessThanOrEqual(Date.now())
  })

  it('ne pose rien quand aucun champ connu n est envoyé', async () => {
    // Un formulaire renvoyé sans modification ne doit pas faire croire à un
    // laveur actif : c'est exactement le faux signal qu'on cherche à éviter.
    await patch({ champ_inconnu: 'peu importe' })
    expect(updates[0]).not.toHaveProperty('profile_updated_at')
  })

  it('ignore une date envoyée par le client', async () => {
    // Sinon n'importe qui pourrait antidater sa fiche et se rendre invisible
    // dans le suivi des inscrits qui décrochent.
    await patch({ name: 'Test', profile_updated_at: '2020-01-01T00:00:00.000Z' })
    expect(updates[0].profile_updated_at).not.toBe('2020-01-01T00:00:00.000Z')
  })
})

describe('PATCH /api/washer — validation de base', () => {
  it('refuse un nom d entreprise vide', async () => {
    const { res } = await patch({ name: '   ' })
    expect(res.status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('remonte une erreur d écriture', async () => {
    plan.updateError = { message: 'base indisponible' }
    const { res } = await patch({ name: 'Test' })
    expect(res.status).toBe(500)
  })
})
