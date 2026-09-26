import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { getMapsApiKey } from '@/lib/googleMaps'
import { logger } from '@/lib/logger'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ZoneConfig } from '@/types'
import { normalizePhone } from '@/lib/phone'
import { hasFeature, requiredPlanLabel, type Feature } from '@/lib/plan'
import { TAUX_TVA, normaliserSiret, siretValide, normaliserNumeroTva, numeroTvaValide } from '@/lib/facture'
import { widgetsValides } from '@/lib/dashboardWidgets'

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const {
    name, phone, slug, logo_url, welcome_message, brand_color, team_size,
    smart_slot_enabled, smart_slot_radius_minutes, smart_slot_discount_type, smart_slot_discount_value,
    travel_fee_tiers, base_address, travel_fee_mode, background_theme, website_url, google_place_id,
    review_enabled, review_delay_hours, google_review_url, review_channel, sms_sender,
    followup_enabled, followup_delay_days, followup_message,
    zone_config, dashboard_widgets,
    facture_nom_legal, facture_siret, facture_adresse, facture_regime_tva, facture_taux_tva, facture_numero_tva,
    facture_statut, facture_forme_juridique, facture_capital, facture_immatriculation,
    facture_prochain_numero,
  } = await request.json()

  // ── Validations ──────────────────────────────────────────────────────────
  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: "Le nom de l'entreprise est requis" }, { status: 400 })
  }
  // Le téléphone est normalisé ici comme à l'inscription : sans ça, un laveur
  // pourrait ressaisir son numéro sous une autre forme (« +33612345678 » au
  // lieu de « 0612345678 ») et créer un second compte avec le même numéro —
  // la contrainte d'unicité ne verrait pas les deux écritures comme identiques.
  let telephoneNormalise: string | null = null
  if (phone !== undefined && String(phone).trim()) {
    telephoneNormalise = normalizePhone(phone)
    if (!telephoneNormalise) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide (format attendu : 06 12 34 56 78)' },
        { status: 400 },
      )
    }
  }

  // Plan réel du laveur, lu en base — jamais déduit de ce que le navigateur
  // envoie. Sans ce contrôle, un compte Essentiel activait les relances
  // automatiques et le multi-laveurs par un simple appel à cette route, et
  // consommait des SMS facturés à WashBoard sans jamais passer au plan Pro.
  // Signalé par un audit externe le 2026-09-05.
  const { data: profil, error: profilError } = await supabase
    .from('washers').select('plan, grandfathered, facture_prochain_numero').eq('user_id', user.id).single()

  if (profilError || !profil) {
    // Sans certitude sur le plan, on ne débloque rien : laisser passer
    // reviendrait à offrir le Pro dès qu'une lecture échoue.
    logger.error('washer.plan_read_failed', { userId: user.id }, profilError)
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  const refusePro = (fonctionnalite: Feature) =>
    NextResponse.json(
      { error: `Cette option est réservée au plan ${requiredPlanLabel(fonctionnalite)}.` },
      { status: 403 },
    )

  // Plusieurs laveurs simultanés : réservé au Pro.
  if (team_size !== undefined && Number(team_size) > 1 && !hasFeature(profil, 'multi_laveurs')) {
    return refusePro('multi_laveurs')
  }
  // Relances automatiques : réservées au Pro. Seule l'ACTIVATION est bloquée —
  // un laveur qui rétrograde doit pouvoir les désactiver.
  if (followup_enabled === true && !hasFeature(profil, 'followup')) {
    return refusePro('followup')
  }
  // Demande d'avis par SMS : même règle.
  if (review_channel === 'sms' && !hasFeature(profil, 'avis_sms')) {
    return refusePro('avis_sms')
  }

  const updates: Record<string, unknown> = {}

  // Widgets affichés sur l'accueil. Les clés inconnues sont silencieusement
  // écartées (voir widgetsValides) plutôt que de faire échouer tout
  // l'enregistrement pour une checkbox mal nommée.
  if (dashboard_widgets !== undefined) {
    updates.dashboard_widgets = dashboard_widgets === null ? null : widgetsValides(dashboard_widgets)
  }

  // Slug personnalisé : format strict + unicité
  if (slug !== undefined) {
    const s = String(slug).trim().toLowerCase()
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(s)) {
      return NextResponse.json({ error: 'Lien invalide : 3 à 40 caractères, lettres minuscules, chiffres et tirets uniquement (sans tiret au début/fin).' }, { status: 400 })
    }
    // Unicité du lien.
    //
    // La lecture passe par le client admin, et non par la session du laveur.
    // Depuis la fermeture de la lecture publique de `washers` (audit du
    // 2026-09-05), un laveur connecté ne voit plus que sa propre fiche : la
    // question « quelqu'un d'autre a-t-il déjà ce lien ? » ne pouvait donc
    // plus rien trouver, et ce contrôle ne servait plus à rien.
    //
    // Les données, elles, n'ont jamais été en danger : la colonne est
    // `slug text UNIQUE` en base, deux laveurs ne peuvent pas se retrouver
    // avec le même lien. Mais celui qui tombait sur un lien déjà pris
    // recevait une erreur 500 opaque au lieu d'une phrase claire.
    //
    // On compare le propriétaire en JavaScript plutôt qu'avec un `.neq()` :
    // une fiche sans `user_id` (les toutes premières, créées à la main) ne
    // serait jamais renvoyée par un `<>` SQL, NULL ne se comparant à rien.
    const { data: proprietaire, error: erreurUnicite } = await createAdminClient()
      .from('washers').select('id, user_id').eq('slug', s).maybeSingle()

    if (erreurUnicite) {
      // Une lecture en échec renverrait « personne », donc « lien libre ». La
      // contrainte de base rattraperait le doublon, mais avec un message que
      // personne ne comprend : on préfère demander de réessayer.
      logger.error('washer.slug.unicite_illisible', { userId: user.id }, erreurUnicite)
      return NextResponse.json(
        { error: 'Impossible de vérifier la disponibilité de ce lien. Réessayez dans un instant.' },
        { status: 503 },
      )
    }
    if (proprietaire && proprietaire.user_id !== user.id) {
      return NextResponse.json({ error: 'Ce lien est déjà utilisé. Choisissez-en un autre.' }, { status: 409 })
    }
    updates.slug = s
  }

  if (name !== undefined) updates.name = String(name).trim()
  if (phone !== undefined) updates.phone = telephoneNormalise
  if (logo_url !== undefined) updates.logo_url = logo_url?.trim() || null
  if (welcome_message !== undefined) updates.welcome_message = welcome_message?.trim() || null
  if (brand_color !== undefined) updates.brand_color = brand_color || null
  if (team_size !== undefined) updates.team_size = Math.min(50, Math.max(1, Math.floor(Number(team_size)) || 1))
  if (smart_slot_enabled !== undefined) updates.smart_slot_enabled = Boolean(smart_slot_enabled)
  if (smart_slot_radius_minutes !== undefined) updates.smart_slot_radius_minutes = Math.min(60, Math.max(5, Number(smart_slot_radius_minutes)))
  if (smart_slot_discount_type !== undefined) updates.smart_slot_discount_type = smart_slot_discount_type
  if (smart_slot_discount_value !== undefined) updates.smart_slot_discount_value = Math.max(0, Number(smart_slot_discount_value))
  if (travel_fee_tiers !== undefined) {
    // Ne conserver que les paliers cohérents (durée > 0, frais >= 0)
    updates.travel_fee_tiers = Array.isArray(travel_fee_tiers)
      ? travel_fee_tiers.filter((t: { max_minutes: number; fee: number }) =>
          Number(t?.max_minutes) > 0 && Number.isFinite(Number(t?.fee)) && Number(t?.fee) >= 0)
      : []
  }
  if (base_address !== undefined) updates.base_address = base_address?.trim() || null
  if (travel_fee_mode !== undefined) updates.travel_fee_mode = travel_fee_mode
  if (background_theme !== undefined) updates.background_theme = background_theme || null
  if (website_url !== undefined) updates.website_url = website_url?.trim() || null
  if (google_place_id !== undefined) updates.google_place_id = google_place_id?.trim() || null
  if (review_enabled !== undefined) updates.review_enabled = Boolean(review_enabled)
  if (review_delay_hours !== undefined) updates.review_delay_hours = Math.min(168, Math.max(0, Math.floor(Number(review_delay_hours)) || 0))
  if (google_review_url !== undefined) updates.google_review_url = google_review_url?.trim() || null
  if (review_channel !== undefined && ['email', 'sms'].includes(review_channel)) updates.review_channel = review_channel
  if (sms_sender !== undefined) updates.sms_sender = sms_sender?.trim().slice(0, 20) || null
  if (followup_enabled !== undefined) updates.followup_enabled = Boolean(followup_enabled)
  if (followup_delay_days !== undefined) updates.followup_delay_days = Math.min(730, Math.max(1, Math.floor(Number(followup_delay_days)) || 90))
  if (followup_message !== undefined) updates.followup_message = followup_message?.trim().slice(0, 500) || null

  // ── Informations de facturation (portées sur les factures aux clients) ──
  // Numéro de la prochaine facture : permet à un laveur qui facturait déjà
  // ailleurs de CONTINUER sa suite (la loi veut une numérotation continue).
  // Jamais en arrière : un numéro déjà utilisé produirait un doublon, que la
  // base refuserait au moment d'émettre — la facture ne sortirait pas.
  if (facture_prochain_numero !== undefined) {
    const suivant = Number(facture_prochain_numero)
    const actuel = Number(profil.facture_prochain_numero ?? 1)
    if (!Number.isInteger(suivant) || suivant < 1 || suivant > 999_999) {
      return NextResponse.json({ error: 'Numéro de facture invalide (entre 1 et 999 999).' }, { status: 400 })
    }
    if (suivant < actuel) {
      return NextResponse.json(
        { error: `Le numéro ne peut pas revenir en arrière : la prochaine facture est déjà la n° ${actuel}.` },
        { status: 400 },
      )
    }
    updates.facture_prochain_numero = suivant
  }
  if (facture_statut !== undefined) {
    if (!['ei', 'societe'].includes(facture_statut)) {
      return NextResponse.json({ error: 'Statut juridique invalide.' }, { status: 400 })
    }
    updates.facture_statut = facture_statut
  }
  if (facture_forme_juridique !== undefined) updates.facture_forme_juridique = String(facture_forme_juridique ?? '').trim().slice(0, 60) || null
  if (facture_capital !== undefined) updates.facture_capital = String(facture_capital ?? '').trim().slice(0, 40) || null
  if (facture_immatriculation !== undefined) updates.facture_immatriculation = String(facture_immatriculation ?? '').trim().slice(0, 80) || null
  if (facture_nom_legal !== undefined) updates.facture_nom_legal = String(facture_nom_legal ?? '').trim().slice(0, 120) || null
  if (facture_adresse !== undefined) updates.facture_adresse = String(facture_adresse ?? '').trim().slice(0, 300) || null
  if (facture_siret !== undefined) {
    const siret = normaliserSiret(String(facture_siret ?? ''))
    if (siret && !siretValide(siret)) {
      return NextResponse.json(
        { error: 'SIRET invalide : vérifiez les 14 chiffres, tels qu\'indiqués sur votre avis de situation Insee.' },
        { status: 400 },
      )
    }
    updates.facture_siret = siret || null
  }
  if (facture_regime_tva !== undefined) {
    if (!['franchise', 'assujetti'].includes(facture_regime_tva)) {
      return NextResponse.json({ error: 'Régime de TVA invalide.' }, { status: 400 })
    }
    updates.facture_regime_tva = facture_regime_tva
  }
  if (facture_taux_tva !== undefined) {
    const taux = Number(facture_taux_tva)
    if (!(TAUX_TVA as readonly number[]).includes(taux)) {
      return NextResponse.json({ error: 'Taux de TVA invalide.' }, { status: 400 })
    }
    updates.facture_taux_tva = taux
  }
  if (facture_numero_tva !== undefined) {
    const numero = normaliserNumeroTva(String(facture_numero_tva ?? ''))
    if (numero && !numeroTvaValide(numero)) {
      return NextResponse.json(
        { error: 'Numéro de TVA invalide : FR suivi de 11 caractères, par exemple FR40123456789.' },
        { status: 400 },
      )
    }
    updates.facture_numero_tva = numero || null
  }

  if (zone_config !== undefined) {
    let config = zone_config as ZoneConfig
    // Pour le mode vol d'oiseau, géocoder l'adresse de base une seule fois à la sauvegarde
    if (config?.enabled && config.type === 'crow' && config.center_address) {
      const apiKey = getMapsApiKey()
      if (apiKey) {
        try {
          const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(config.center_address)}&key=${apiKey}`
          const data = await (await fetch(url)).json()
          const loc  = data.results?.[0]?.geometry?.location
          if (loc) config = { ...config, center_lat: loc.lat, center_lng: loc.lng }
        } catch (e) {
          // Facultatif : sans coordonnees la zone retombe sur le geocodage a la
          // volee. On trace quand meme, une panne Google se voyait autrement nulle part.
          logger.error('washer.zone.geocode_failed', {}, e)
        }
      }
    }
    updates.zone_config = config
  }

  // Horodate l'action DU LAVEUR. `updated_at` ne peut pas jouer ce rôle : la
  // base le réécrit à chaque UPDATE de la ligne, donc aussi quand le cron pose
  // `trial_reminder_sent_at` ou quand le webhook Stripe change l'abonnement.
  // Résultat, une fiche « modifiée hier » pouvait ne rien devoir au laveur —
  // c'est ce qui a rendu la colonne inexploitable pour le suivi client.
  // Posé seulement s'il y a quelque chose à écrire : un formulaire renvoyé sans
  // le moindre champ valide n'est pas une modification.
  if (Object.keys(updates).length > 0) {
    updates.profile_updated_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('washers')
    .update(updates)
    .eq('user_id', user.id)

  if (error) {
    // Deux laveurs qui réclament le même lien au même instant passent tous les
    // deux le contrôle ci-dessus ; c'est la contrainte d'unicité de la base qui
    // tranche. Le perdant mérite la même phrase claire que les autres, pas une
    // erreur interne.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ce lien est déjà utilisé. Choisissez-en un autre.' }, { status: 409 })
    }
    return errorResponse('washer.patch.db', error)
  }
  return NextResponse.json({ success: true })
}
