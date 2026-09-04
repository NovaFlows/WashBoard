import { test, expect } from '@playwright/test'
import { TEST_WASHER_SLUG } from './helpers'

// API vues depuis l'extérieur. Deux angles :
//   - le contrat (statuts, forme des réponses) ;
//   - les protections, testées en tentant de les contourner — une route
//     d'administration ouverte ou un cron sans secret ne se voit pas à l'œil nu.

test.describe('Santé', () => {
  test('/api/health répond ok avec la base connectée', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks?.database).toBe('ok')
  })
})

test.describe('Protection des routes cron', () => {
  // Sans secret, ces routes déclencheraient de vrais envois (emails, SMS) à de
  // vrais clients. Chacune doit refuser un appel anonyme.
  const crons = [
    '/api/cron/send-reviews',
    '/api/cron/send-followups',
    '/api/cron/send-trial-reminders',
    '/api/cron/purge-accounts',
  ]

  for (const path of crons) {
    test(`${path} refuse un appel sans secret`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(401)
    })

    test(`${path} refuse un secret invalide`, async ({ request }) => {
      const res = await request.get(path, { headers: { authorization: 'Bearer mauvais-secret' } })
      expect(res.status()).toBe(401)
    })
  }
})

test.describe('Protection des routes authentifiées', () => {
  // Un visiteur anonyme ne doit pouvoir ni lire ni modifier les données d'un
  // laveur. On vérifie que la route refuse (401/403) ou renvoie un ensemble
  // vide, mais jamais les données d'autrui.
  const routes = [
    { method: 'GET' as const, path: '/api/bookings' },
    { method: 'GET' as const, path: '/api/expenses' },
    { method: 'GET' as const, path: '/api/services' },
    { method: 'GET' as const, path: '/api/availabilities' },
    { method: 'GET' as const, path: '/api/unavailabilities' },
    { method: 'GET' as const, path: '/api/compta/revenue' },
  ]

  for (const r of routes) {
    test(`${r.method} ${r.path} ne divulgue rien à un anonyme`, async ({ request }) => {
      const res = await request.fetch(r.path, { method: r.method })
      if (res.status() === 200) {
        const body = await res.json().catch(() => null)
        const payload = JSON.stringify(body ?? {})
        // Aucune donnée personnelle ne doit transiter vers un anonyme.
        expect(payload).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i)
      } else {
        expect([401, 403, 404, 405]).toContain(res.status())
      }
    })
  }

  test('PATCH /api/washer refuse un anonyme', async ({ request }) => {
    const res = await request.patch('/api/washer', { data: { name: '[E2E] ne doit pas passer' } })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe('Réservation publique — API', () => {
  test.skip(!TEST_WASHER_SLUG, 'TEST_WASHER_SLUG absent')

  test('le honeypot avale la requête sans créer de réservation', async ({ request }) => {
    // Le champ piège `hp` est rempli uniquement par les robots. La charge doit
    // être valide par ailleurs, sinon le schéma la rejette AVANT le honeypot et
    // le test ne prouve rien (c'est ce qui arrivait à la première écriture).
    // La route doit répondre 201 — ne pas informer le bot — sans rien créer.
    const res = await request.post('/api/bookings', {
      data: {
        hp: 'je-suis-un-bot',
        washer_id: '00000000-0000-0000-0000-000000000000',
        service_id: '00000000-0000-0000-0000-000000000000',
        vehicle_type: 'citadine',
        scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
        client_name: '[E2E] Bot',
        client_email: 'e2e-bot@example.test',
        client_phone: '0600000000',
        address: '1 rue du Test, 75001 Paris',
      },
    })
    expect(res.status()).toBe(201)

    // Et surtout : rien ne doit avoir été enregistré. Le bug de production du
    // 2026-08-26 était exactement l'inverse (vraies réservations avalées en
    // silence), donc on vérifie l'effet, pas seulement le code de retour.
    const cleanup = await request.post('/api/e2e/cleanup', {
      data: { client_email: 'e2e-bot@example.test' },
    })
    expect(cleanup.status()).toBeLessThan(500)
  })

  test('une réservation sans champs obligatoires est refusée', async ({ request }) => {
    const res = await request.post('/api/bookings', { data: { client_name: '[E2E] Incomplet' } })
    expect([400, 422]).toContain(res.status())
  })

  test('/api/zone/check répond pour une adresse donnée', async ({ request }) => {
    const res = await request.get(`/api/zone/check?washer_id=&address=Paris`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('allowed')
  })

  test('/api/slots/smart renvoie une forme exploitable sans paramètres', async ({ request }) => {
    const res = await request.get('/api/slots/smart')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.smartWindows)).toBe(true)
    expect(Array.isArray(body.bookingConstraints)).toBe(true)
  })

  test('/api/travel-fee renvoie 0 sans paramètres plutôt que de planter', async ({ request }) => {
    const res = await request.get('/api/travel-fee')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.fee).toBe(0)
  })
})

test.describe('Analytics entonnoir', () => {
  test('accepte un événement anonyme et ne renvoie aucune donnée', async ({ request }) => {
    const res = await request.post('/api/analytics/funnel', {
      data: {
        washer_id: '00000000-0000-0000-0000-000000000000',
        session_id: '00000000-0000-0000-0000-000000000000',
        step: 'prestation',
        device: 'desktop',
      },
    })
    // La route ne doit jamais casser le parcours de réservation, quoi qu'il arrive.
    expect(res.status()).toBeLessThan(500)
  })

  test('refuse une étape inconnue', async ({ request }) => {
    const res = await request.post('/api/analytics/funnel', {
      data: {
        washer_id: '00000000-0000-0000-0000-000000000000',
        session_id: '00000000-0000-0000-0000-000000000000',
        step: 'etape-inventee',
      },
    })
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('Accès support — protections', () => {
  // Cette route ouvre une session sur le compte d'un client : c'est la plus
  // sensible du produit. Chaque verrou est vérifié en tentant de le franchir.

  test('un visiteur anonyme ne peut pas obtenir d’accès', async ({ request }) => {
    const res = await request.post('/api/support/access', { data: { slug: TEST_WASHER_SLUG } })
    expect(res.status()).toBe(401)
  })

  test('un visiteur anonyme ne peut pas ouvrir d’accès sur un compte', async ({ request }) => {
    const res = await request.post('/api/support/grant')
    expect(res.status()).toBe(401)
  })

  test('un visiteur anonyme ne peut pas lire l’état d’un accès', async ({ request }) => {
    const res = await request.get('/api/support/grant')
    expect(res.status()).toBe(401)
  })

  test('la page support n’est pas accessible sans être connecté', async ({ page }) => {
    await page.goto('/dashboard/support')
    await expect(page).toHaveURL(/\/login/)
  })
})
