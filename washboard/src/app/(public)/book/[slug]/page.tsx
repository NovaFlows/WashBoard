import LegacyBookingPage from '@/components/booking/LegacyBookingPage'
import { bookingPageMode } from '@/lib/bookingPageMode'
import { cache, Suspense } from 'react'
import BookingHero from '@/components/booking/BookingHero'
import RetourApercu from '@/components/booking/RetourApercu'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BookingForm from '@/components/booking/BookingForm'
import ReviewsCarousel from '@/components/booking/ReviewsCarousel'
import { urlVersionnee } from '@/lib/themes'
import { scrapeWebsiteReviews } from '@/lib/googleReviews'
import { graceEnded, hasFeature, quotaPrestations, quotaReservations, suitRetourGratuit } from '@/lib/plan'
import { prestationsAffichees } from '@/lib/prestation'
import { infosFacturationManquantes } from '@/lib/facture'
import { compterReservationsDeLaPeriode } from '@/lib/reservationsVerrouillees'
import { pixelIdValide, pixelIdDev } from '@/lib/consentement'
import ConsentementCookies, { LienGererCookies } from '@/components/booking/ConsentementCookies'

type Props = {
  params: Promise<{ slug: string }>
}

// Les colonnes de la fiche, énumérées plutôt que `select('*')` : charger
// l'objet entier ferait transiter des secrets (jeton Google, identifiants
// Stripe) par une page publique, en comptant sur le fait qu'on ne les
// transmettrait pas plus loin.
// Les cinq dernières (`facture_*`) faisaient l'objet d'une requête séparée,
// pour que la page tienne debout si ces colonnes n'existaient pas encore en
// base. Elles existent toutes en production depuis la sortie des factures, et
// cette prudence coûtait une troisième lecture de la même ligne à chaque
// visite. Seul un booléen en sort vers le navigateur.
//
// Une seule chaîne littérale, et non un tableau assemblé : supabase-js déduit
// le type du résultat de ce littéral. Un `join()` lui rend un `string` et fait
// perdre le typage de toutes les colonnes.
const COLONNES_LAVEUR = 'id, booking_page_mode, name, slug, phone, logo_url, welcome_message, brand_color, background_theme, profile_updated_at, website_url, base_address, team_size, created_at, travel_fee_mode, travel_fee_tiers, zone_config, smart_slot_enabled, smart_slot_radius_minutes, smart_slot_discount_type, smart_slot_discount_value, reservation_jour_meme, account_status, subscription_status, trial_ends_at, subscription_ends_at, grandfathered, plan, is_preview, meta_pixel_id, facture_nom_legal, facture_siret, facture_adresse, facture_regime_tva, facture_numero_tva'

/** Une seule lecture de la fiche par requête HTTP.
 *
 *  `generateMetadata` et la page s'exécutent dans le même rendu et lisaient
 *  chacune la ligne du laveur, plus une troisième fois pour la facturation :
 *  trois allers-retours pour la même ligne, à chaque visite. `cache()` de React
 *  mémorise le résultat pour la durée de la requête — les appelants suivants
 *  reçoivent le même objet sans retoucher la base. */
const lireLaveur = cache(async (slug: string) =>
  createAdminClient()
    .from('washers')
    .select(COLONNES_LAVEUR)
    .eq('slug', slug)
    .maybeSingle())

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // Lecture côté serveur : la table `washers` n'est plus lisible par la clé
  // publique, qui donnait accès aux jetons Google et identifiants Stripe de
  // TOUS les laveurs à n'importe quel visiteur.
  const { data: washer } = await lireLaveur(slug)

  // Page privée d'un laveur : elle ne doit pas se retrouver dans un moteur de
  // recherche, même quand elle n'existe pas. `follow` reste vrai, les liens
  // sortants n'ont pas à être pénalisés.
  const robots = { index: false, follow: true }

  if (!washer) return { title: 'Réservation', robots }

  // Sans ces trois champs, la page héritait de ceux de la page d'accueil
  // (`layout.tsx` définit un `openGraph` complet et `canonical: "/"`). Un
  // professionnel qui collait son lien dans WhatsApp ou en bio Instagram
  // voyait donc s'afficher le titre marketing générique de la page d'accueil :
  // notre argumentaire B2B, envoyé à SES clients, à la place de son nom.
  // Relevé lors de la revue du 2026-09-06.
  const description = washer.welcome_message?.trim()
    || `Réservez votre lavage avec ${washer.name} en quelques clics.`

  return {
    title: `${washer.name} — Réservation`,
    description,
    robots,
    // Neutralise le canonical global qui pointait toutes les pages de
    // réservation vers la page d'accueil.
    alternates: { canonical: `/book/${slug}` },
    openGraph: {
      type: 'website',
      title: `${washer.name} — Réservation en ligne`,
      description,
      url: `/book/${slug}`,
      siteName: washer.name,
      locale: 'fr_FR',
      // Le logo vaut mieux que rien : sans image, l'aperçu se réduit à deux
      // lignes de texte et passe inaperçu dans un fil de discussion.
      images: washer.logo_url ? [{ url: washer.logo_url }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${washer.name} — Réservation en ligne`,
      description,
      images: washer.logo_url ? [washer.logo_url] : undefined,
    },
  }
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params
  const admin = createAdminClient()

  // Déjà lue par `generateMetadata` dans la même requête : `cache()` rend ici
  // le même objet, sans second aller-retour. Colonnes vérifiées contre les
  // besoins de tarifs-4-offres lors de la fusion du 2026-09-28 (created_at
  // manquait pour suitRetourGratuit — ajouté à COLONNES_LAVEUR).
  const { data: washer } = await lireLaveur(slug)

  if (!washer) notFound()
  if (washer.account_status && washer.account_status !== 'active') notFound()

  // Abonnement expiré depuis plus de 30 jours : page de réservation suspendue
  // grandfathered n'exempte pas du paiement — s'ils ne paient pas, on bloque aussi
  // Les comptes qui suivent la règle 2026 ne sont JAMAIS suspendus : leur essai
  // terminé les fait retomber sur Découverte, pas dehors. Sans cette exception,
  // la page affichait « momentanément suspendue » alors que la route de
  // réservation, elle, acceptait la demande — deux vérités contradictoires sur
  // le même compte, et un client perdu pour rien.
  const isBlocked = washer.subscription_status !== 'active'
    && !suitRetourGratuit(washer)
    && graceEnded(washer.subscription_ends_at, washer.trial_ends_at)

  if (isBlocked) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Page temporairement indisponible</h1>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '24px' }}>
            La page de réservation de <strong>{washer.name}</strong> est momentanément suspendue.
            Contactez directement votre prestataire pour prendre rendez-vous.
          </p>
          {washer.phone && (
            <a href={`tel:${washer.phone}`} style={{ display: 'inline-block', background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: '700', fontSize: '14px', padding: '12px 24px', borderRadius: '10px' }}>
              Appeler {washer.name}
            </a>
          )}
        </div>
      </div>
    )
  }

  // Les informations de facturation viennent de la même lecture que le reste
  // de la fiche (voir COLONNES_LAVEUR). Seul un booléen en sort vers le
  // navigateur : ni le SIRET ni l'adresse n'ont à figurer sur une page publique.
  const facturationPrete = infosFacturationManquantes(washer).length === 0

  // Les trois lectures ci-dessous ne dépendent que de `washer.id`, déjà connu :
  // aucune n'a besoin du résultat d'une autre. Elles partaient auparavant en
  // série (trois allers-retours Supabase l'un après l'autre) ; parties en
  // parallèle, leur latence ne s'additionne plus. Mesuré dans l'audit du
  // 2026-09-21 : ça ne représentait qu'une petite partie du TTFB de 2,3 s de
  // cette page, la majorité venait de l'appel externe vers le site du laveur
  // (voir plus bas).
  const [{ data: services }, { data: categories }, { data: availabilities }] = await Promise.all([
    admin
      .from('services')
      .select('*')
      .eq('washer_id', washer.id)
      // Sans tri, PostgREST rend les lignes dans l'ordre du stockage : il change
      // apres une modification et n'a aucune raison de suivre celui du laveur.
      // Le tableau de bord trie deja par created_at — le laveur rangeait donc ses
      // prestations dans un ordre que ses clients ne voyaient pas.
      .order('created_at'),
    admin
      .from('service_categories')
      .select('*')
      .eq('washer_id', washer.id)
      .order('display_order'),
    // Les rendez-vous à venir et les congés ne sont PLUS lus ici : le formulaire
    // les demande à `GET /api/booking-availability` dès que le visiteur touche
    // la page. Ils ne servent qu'à l'étape des créneaux, que la grande majorité
    // des visiteurs n'atteint jamais — et la liste des rendez-vous grandit sans
    // fin. Le motif de sécurité d'origine n'a pas bougé : la RLS interdit ces
    // tables au visiteur, la lecture passe par le service-role, et seules des
    // données NON personnelles (horaire + durée) atteignent le navigateur.
    admin
      .from('availabilities')
      .select('*')
      .eq('washer_id', washer.id),
  ])

  // ── Identité visuelle : réservée aux offres payantes ────────────────────
  //
  // Sur l'offre Découverte, la page reste aux couleurs de WashBoard et porte
  // notre nom. C'est ce qu'annonce la grille tarifaire, et le contrôle est ici
  // plutôt que dans les réglages seuls : un compte qui aurait personnalisé sa
  // page AVANT de rétrograder garde ses valeurs en base, et elles doivent
  // cesser de s'afficher sans qu'on ait à les effacer.
  // Plafond du mois atteint ? Sert à deux choses sur cette page : retirer le
  // bouton WhatsApp (voir plus bas), et rien d'autre — la réservation, elle,
  // reste acceptée. Un comptage en échec rend `null` : dans le doute on laisse
  // le bouton, comme partout ailleurs le doute profite au laveur.
  const plafondMensuel = quotaReservations(washer)
  const utiliseesCeMois = plafondMensuel === null ? null : await compterReservationsDeLaPeriode(admin, washer)
  const plafondAtteint = plafondMensuel !== null && utiliseesCeMois !== null && utiliseesCeMois >= plafondMensuel

  // Le Pixel du laveur, s'il en a déclaré un. `null` sinon — et dans ce cas
  // aucun bandeau ne s'affiche, aucun script tiers n'est injecté, aucun cookie
  // n'est déposé. Une page sans Pixel reste exactement ce qu'elle était.
  //
  // Lu et validé ici plutôt que passé tel quel : la valeur vient de la base,
  // où une contrainte la garde déjà, mais elle traverse ensuite jusqu'à un
  // `<script>` — c'est le genre de chemin où l'on vérifie deux fois.
  // La simulation locale l'emporte, et elle n'existe qu'en développement
  // (voir pixelIdDev) : elle permet de voir le bandeau sans avoir à écrire en
  // base, et ne peut pas fuir en production.
  const pixelId = pixelIdDev()
    ?? (pixelIdValide(washer.meta_pixel_id) ? String(washer.meta_pixel_id).trim() : null)

  if (bookingPageMode(washer.booking_page_mode) === 'custom') {
    return <LegacyBookingPage washer={washer} services={services ?? []} categories={categories ?? []}
      availabilities={availabilities ?? []} plafondAtteint={plafondAtteint} facturationPrete={facturationPrete} pixelId={pixelId} />
  }

  const personnalisee = hasFeature(washer, 'page_personnalisee')
  const logoUrl       = personnalisee ? washer.logo_url : null
  const accent        = '#2563eb'

  // Lien WhatsApp, calculé UNE fois pour les deux endroits qui s'en servent :
  // le bloc de contact en bas de page (inchangé) et le lien « Une question
  // avant de réserver ? » affiché PENDANT le parcours de réservation (voir
  // BookingForm). `null` dans les deux mêmes cas qu'avant la refonte 2026-10 :
  // pas de téléphone, ou plafond mensuel atteint (voir plus bas pourquoi le
  // bouton disparaît alors — masquage des coordonnées du client).
  const waHref = washer.phone && !plafondAtteint
    ? `https://wa.me/${washer.phone.replace(/\D/g, '').replace(/^0/, '33')}`
    : null

  return (
    <>
    {logoUrl && <link rel="icon" href={logoUrl} type="image/png" />}
    <RetourApercu />
    <div className="min-h-screen bg-[#f6f5f3] dark:bg-zinc-950">
      <BookingHero name={washer.name} message={null} accent={accent}
        logoUrl={logoUrl ? urlVersionnee(logoUrl, washer.profile_updated_at) : null}
        personalized={personnalisee} whatsappHref={waHref}
        reviews={washer.website_url ? <Suspense fallback={null}><ReviewSummary websiteUrl={washer.website_url} /></Suspense> : null} />
      <main id="main-content" className="relative max-w-lg mx-auto -mt-6 rounded-t-[28px] bg-[#f6f5f3] dark:bg-zinc-950 px-3.5 pt-3.5 pb-[calc(180px+env(safe-area-inset-bottom,0px))]">
        <BookingForm
          // Champs énumérés un par un, jamais l'objet entier : tout ce qui
          // franchit la frontière serveur→client est sérialisé dans le HTML
          // public, utilisé ou non. Passer `washer` publiait le
          // `stripe_customer_id` et le `google_refresh_token` du laveur dans le
          // code source de sa page de réservation.
          washer={{
            id: washer.id,
            name: washer.name,
            base_address: washer.base_address ?? null,
            team_size: washer.team_size ?? null,
            travel_fee_mode: washer.travel_fee_mode ?? 'base',
            travel_fee_tiers: washer.travel_fee_tiers ?? null,
            reservation_jour_meme: washer.reservation_jour_meme ?? false,
            is_preview: washer.is_preview ?? false,
            facturation_prete: facturationPrete,
            // Réserver en tant qu'entreprise demande le suivi qui va avec —
            // fiche société, facture, relance. L'offre gratuite ne l'a pas.
            clients_pro: hasFeature(washer, 'crm'),
          }}
          // Une prestation sans type s'affichait, se sélectionnait, puis
          // laissait le client devant un bouton Continuer grisé sans rien à
          // choisir. Le tableau de bord la signale au laveur en rouge.
          services={prestationsAffichees(services ?? [], quotaPrestations(washer))}
          categories={categories ?? []}
          availabilities={availabilities ?? []}
          // Plus de existingBookings/unavailabilities ici : BookingForm les
          // charge lui-même via /api/booking-availability (voir plus haut).
          // La page par défaut utilise le bleu standard ; les couleurs et
          // fonds enregistrés restent disponibles dans la page classique.
          accent={accent}
          whatsappHref={waHref}
        />

        {washer.website_url && (
          // L'appel externe vers le site du laveur (voir `scrapeWebsiteReviews`)
          // peut prendre jusqu'à 5 s sur un cache froid, contre un site tiers
          // qu'on ne maîtrise pas. Le rendu de l'essentiel (services, prix,
          // disponibilités) n'a pas à l'attendre : ce bloc est streamé à part,
          // sans skeleton (`fallback={null}`) puisqu'il n'occupe qu'un espace
          // secondaire, sous le formulaire de réservation.
          <Suspense fallback={null}>
            <ReviewsSection websiteUrl={washer.website_url} themed={false} />
          </Suspense>
        )}

        {!personnalisee && (
          // La marque de l'offre gratuite. Discrète mais cliquable : c'est le
          // seul canal d'acquisition que le produit s'offre à lui-même.
          <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">
            Réservation propulsée par{' '}
            <a
              href="https://www.washboard.fr"
              target="_blank"
              rel="noopener"
              className="font-semibold text-slate-500 dark:text-slate-400 underline underline-offset-2"
            >
              WashBoard
            </a>
          </p>
        )}
        {/* « Gérer mes cookies » : n'apparaît que si le laveur a un Pixel,
            donc que s'il y a quelque chose à gérer. */}
        {pixelId && (
          <p className="mt-6 text-center">
            <LienGererCookies pixelId={pixelId} />
          </p>
        )}
      </main>

      {/* Le bandeau, et le chargement du Pixel qu'il commande. Sans Pixel
          déclaré, ce composant ne rend rien et n'injecte rien. */}
      <ConsentementCookies pixelId={pixelId} slug={washer.slug} />
    </div>
    </>
  )
}

/** Composant serveur asynchrone séparé pour permettre le streaming (`Suspense`
 *  dans `BookingPage`) : React peut envoyer le reste de la page pendant que
 *  cet appel externe est encore en vol. */
async function ReviewsSection({ websiteUrl, themed }: { websiteUrl: string; themed: boolean }) {
  const reviewData = await scrapeWebsiteReviews(websiteUrl)
  const hasReviews = reviewData.reviews.length > 0 || !!reviewData.aggregate
  if (!hasReviews) return null

  return (
    <div id="booking-reviews" className="mt-6">
      <ReviewsCarousel reviews={reviewData.reviews} aggregate={reviewData.aggregate} themed={themed} />
    </div>
  )
}

// Seules les notes effectivement récupérées sont affichées. Aucun avis fictif.
async function ReviewSummary({ websiteUrl }: { websiteUrl: string }) {
  const { aggregate } = await scrapeWebsiteReviews(websiteUrl)
  if (!aggregate || aggregate.count <= 0) return null
  return <a href="#booking-reviews" className="underline underline-offset-2">★ {aggregate.value.toLocaleString('fr-FR')} · {aggregate.count} avis</a>
}
