import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Décision `legal` du 2026-10-04 : une réservation déjà FACTURÉE reste toujours
// visible, même reclassée au-delà du quota après une rétrogradation d'offre
// (le plafond, plus bas, s'applique rétroactivement sur 12 périodes passées).
// Voir `estVerrouillee()` dans reservationsVerrouillees.ts.
//
// Ce test se construit son propre compte JETABLE (créé puis supprimé via le
// service-role), plutôt que de dépendre de `TEST_WASHER_*` : il peut donc
// tourner sans configuration préalable, et sans jamais toucher un compte réel.
// Même méthode que les vérifications manuelles de ce chantier (compte créé,
// vérifié, supprimé — jamais sur `kookii-clean` ni `autonettoyage`).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

test.describe('Réservation déjà facturée au-delà du quota (décision legal 2026-10-04)', () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, 'Configuration Supabase (service-role) absente')

  const admin = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null!
  const email    = `e2e-facture-quota-${Date.now()}@washboard-test.fr`
  const password = `E2E-${randomUUID()}`
  let authUserId: string
  let washerId: string
  let serviceId: string
  const bookingIds: string[] = []

  // Plan Découverte (quota = 5, voir BOOKING_QUOTA dans lib/plan.ts). La
  // période est ancrée au 25 : 2026-09-25 → 2026-10-25 couvre la date de ce
  // chantier et reste après PLAFOND_RESERVATIONS_APPLIQUE_DES (2026-09-24).
  const CREATION_LAVEUR = '2026-09-25T08:00:00.000Z'
  const BASE_CREATED = new Date('2026-09-26T08:00:00.000Z').getTime()
  const JOUR_MS = 24 * 60 * 60_000

  test.beforeAll(async () => {
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (userErr || !userData.user) throw new Error(`Création utilisateur échouée : ${userErr?.message}`)
    authUserId = userData.user.id

    washerId = randomUUID()
    const { error: washerErr } = await admin.from('washers').insert({
      id: washerId,
      user_id: authUserId,
      name: '[E2E] Facture Quota',
      slug: `e2e-facture-quota-${Date.now()}`,
      phone: '0600000000',
      subscription_status: 'active',
      booking_page_mode: 'default',
      plan: 'decouverte',
      grandfathered: false,
      created_at: CREATION_LAVEUR,
      onboarding_complete_at: CREATION_LAVEUR,
      cgv_acceptees_le: new Date().toISOString(),
      cgv_acceptees_ip: '127.0.0.1',
    })
    if (washerErr) throw new Error(`Création laveur échouée : ${washerErr.message}`)

    serviceId = randomUUID()
    const { error: serviceErr } = await admin.from('services').insert({
      id: serviceId, washer_id: washerId, name: '[E2E] Lavage', price: 40, duration_minutes: 30,
    })
    if (serviceErr) throw new Error(`Création service échouée : ${serviceErr.message}`)

    // 5 réservations DANS le quota (index 0 à 4), une 6e au-delà déjà
    // FACTURÉE (index 5), une 7e au-delà JAMAIS facturée — témoin (index 6).
    for (let i = 0; i < 7; i++) {
      const id = randomUUID()
      bookingIds.push(id)
      const createdAt   = new Date(BASE_CREATED + i * JOUR_MS).toISOString()
      const scheduledAt = new Date(BASE_CREATED + (i + 40) * JOUR_MS).toISOString()
      const endsAt       = new Date(new Date(scheduledAt).getTime() + 30 * 60_000).toISOString()
      const auDela = i >= 5
      const { error } = await admin.from('bookings').insert({
        id, washer_id: washerId, service_id: serviceId,
        client_name: auDela ? `[E2E] Client au-delà ${i}` : `[E2E] Client quota ${i}`,
        client_email: `e2e-facture-quota-${i}-${Date.now()}@washboard-test.fr`,
        client_phone: '0600000000',
        address: '1 rue du Test, 75001 Paris',
        vehicle_count: 1,
        scheduled_at: scheduledAt,
        ends_at: endsAt,
        status: i === 5 ? 'done' : 'pending',
        created_at: createdAt,
        saisie_par_laveur: false,
        is_smart_slot: false,
        smart_discount: 0,
        is_professional: false,
        booked_price: 40,
        facture_numero: i === 5 ? 'F-E2E-0001' : null,
      })
      if (error) throw new Error(`Création réservation ${i} échouée : ${error.message}`)
    }
  })

  test.afterAll(async () => {
    if (!admin) return
    if (bookingIds.length) await admin.from('bookings').delete().in('id', bookingIds)
    if (serviceId) await admin.from('services').delete().eq('id', serviceId)
    if (washerId) await admin.from('washers').delete().eq('id', washerId)
    if (authUserId) await admin.auth.admin.deleteUser(authUserId)
  })

  test('reste en clair malgré le verrouillage ; une réservation équivalente sans facture reste masquée', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })

    const jour = (index: number) => new Date(BASE_CREATED + (index + 40) * JOUR_MS)
      .toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

    const facturee = await page.request.get(`/api/bookings/jour?date=${jour(5)}`)
    expect(facturee.status()).toBe(200)
    const { data: donneesFacturee } = await facturee.json()
    const resaFacturee = donneesFacturee.find((b: { id: string }) => b.id === bookingIds[5])
    expect(resaFacturee, 'réservation facturée introuvable dans la réponse').toBeTruthy()
    expect(resaFacturee.verrouillee).toBe(false)
    expect(resaFacturee.client_name).toBe('[E2E] Client au-delà 5')

    const temoin = await page.request.get(`/api/bookings/jour?date=${jour(6)}`)
    expect(temoin.status()).toBe(200)
    const { data: donneesTemoin } = await temoin.json()
    const resaTemoin = donneesTemoin.find((b: { id: string }) => b.id === bookingIds[6])
    expect(resaTemoin, 'réservation témoin introuvable dans la réponse').toBeTruthy()
    expect(resaTemoin.verrouillee).toBe(true)
    expect(resaTemoin.client_name).toBeNull()
  })
})
