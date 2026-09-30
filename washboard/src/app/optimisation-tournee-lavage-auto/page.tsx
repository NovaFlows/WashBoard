import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SITE_URL } from '@/lib/blog'
import { PLAN_CARDS } from '@/lib/plan'
import type { FaqItem } from '@/components/blog/Prose'

// Page pilier — angle « optimisation de tournée », distinct de
// /logiciel-lavage-auto (qui vend le produit dans son ensemble). Ici
// l'intention de recherche est un problème précis (les trajets à vide entre
// deux lavages), pas « quel logiciel pour laveur auto » — donc pas de
// cannibalisation avec la page métier existante. Standalone comme
// /meilleur-logiciel-lavage-auto (Nav/Breadcrumb/Footer propres), pas
// rattachée à METIER_PAGES qui n'admet qu'une page par thème (déjà prise par
// /logiciel-lavage-auto pour le thème "auto").
//
// Chaque affirmation ci-dessous est vérifiée dans le code avant d'être
// écrite :
// - les contraintes de trajet (impossible de proposer un horaire qu'un
//   trajet rendrait injoignable) sont TOUJOURS calculées, indépendamment des
//   créneaux groupés : src/app/api/slots/smart/route.ts (bookingConstraints)
// - créneaux groupés (smart slots) : mis en avant seulement si le laveur les
//   active, seuil par défaut 15 min, réglable de 5 à 30 (jamais 60) :
//   src/app/api/slots/smart/route.ts (smartWindows, radiusSeconds),
//   src/components/dashboard/admin/IdentiteForm.tsx (input range min={5} max={30})
// - remise optionnelle sur un créneau groupé, définie par le laveur (montant
//   fixe ou pourcentage) : src/app/api/slots/smart/route.ts (discountType,
//   discountValue)
// - frais de déplacement par palier de trajet réel (Google Maps Distance
//   Matrix), depuis l'adresse de départ ou depuis le dernier rendez-vous du
//   jour selon le mode choisi : src/lib/travelFee.ts (pickTravelFee,
//   resolveOrigin, travel_fee_mode 'base' | 'previous')
// - article de blog dédié déjà existant, maillé depuis /logiciel-lavage-auto :
//   src/app/blog/organiser-ses-tournees-lavage-auto/page.tsx
// - prix des formules : src/lib/plan.ts (PLAN_CARDS), jamais recopiés
//
// Ce qui n'est PAS affirmé faute de preuve dans le code : un itinéraire
// optimisé sur plusieurs rendez-vous à la fois (WashBoard compare chaque
// nouvelle demande aux rendez-vous déjà posés, il ne réordonne pas une
// tournée existante) — voir la FAQ, qui le dit explicitement plutôt que de
// laisser le titre de la page le laisser croire.

const title = 'Optimiser sa tournée de lavage auto mobile | WashBoard'
const description =
  'Réduire les trajets à vide entre deux lavages auto à domicile : créneaux groupés au temps de trajet réel, frais de déplacement calculés automatiquement via Google Maps. La méthode WashBoard, sans rien inventer.'
const url = `${SITE_URL}/optimisation-tournee-lavage-auto`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: {
    type: 'website',
    url,
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
          <Image src="/LogoWashBoard.png" alt="WashBoard" width={32} height={32} className="w-8 h-8 rounded-lg shrink-0 object-contain" />
          <span className="font-extrabold tracking-tight text-slate-900 dark:text-white">WashBoard</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <Link href="/blog" className="hidden sm:inline text-sm text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-2">
            Blog
          </Link>
          <Link href="/signup" className="px-3.5 sm:px-4 py-2 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
            Essai gratuit
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-6 text-xs text-slate-400 dark:text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Accueil</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="text-slate-500 dark:text-slate-400 truncate max-w-[70vw] sm:max-w-none" aria-current="page">
          {current}
        </li>
      </ol>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <p>© 2026 WashBoard · Logiciel pour pros du lavage automobile</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Accueil</Link>
          <Link href="/blog" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Blog</Link>
          <Link href="/mentions-legales" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Mentions légales</Link>
          <Link href="/cgv" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">CGV</Link>
          <Link href="/confidentialite" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Confidentialité</Link>
        </div>
      </div>
    </footer>
  )
}

// Grille 2026 à 4 offres : créneaux intelligents et frais de déplacement
// (le sujet de cette page) sont des fonctions Pro, pas Starter — corrigé
// lors de la fusion du 2026-09-28, qui a fait disparaître Essentiel.
const pro = PLAN_CARDS.find(c => c.key === 'pro')!

const faqItems: FaqItem[] = [
  {
    question: 'Comment WashBoard optimise-t-il une tournée de lavage auto ?',
    answer:
      'WashBoard ne réordonne pas une tournée déjà posée : à chaque nouvelle demande de réservation, il compare le temps de trajet réel (Google Maps) entre l’adresse du client et tes rendez-vous déjà prévus ce jour-là, et met en avant les horaires les plus proches — avec une remise optionnelle si tu en as réglé une. Le calcul se fait à chaque réservation, pas une fois pour toutes le matin.',
  },
  {
    question: 'Le seuil des créneaux groupés est-il réglable ?',
    answer:
      'Oui. Par défaut, un créneau est mis en avant s’il tombe à moins de 15 minutes de trajet d’un rendez-vous existant. Ce seuil se règle dans tes paramètres, de 5 à 30 minutes.',
  },
  {
    question: 'Un client peut-il réserver un horaire que le trajet rendrait injoignable ?',
    answer:
      'Non. Cette vérification est indépendante des créneaux groupés et toujours active : même sans remise configurée, WashBoard ne propose jamais un horaire que le temps de trajet réel rendrait intenable compte tenu de tes rendez-vous du jour.',
  },
  {
    question: 'Comment sont calculés les frais de déplacement ?',
    answer:
      'Tu définis des paliers de prix selon le temps de trajet. À chaque réservation, WashBoard calcule la distance réelle via Google Maps — depuis ton adresse de départ, ou depuis ton rendez-vous précédent si tu as choisi d’enchaîner les adresses — et applique automatiquement le bon palier.',
  },
  {
    question: 'Combien ça coûte ?',
    answer:
      `Les créneaux groupés et les frais de déplacement automatiques sont inclus dans la formule ${pro.name} à ${pro.price}€/mois, avec la réservation en ligne, l’agenda, la facturation et les avis Google (email et SMS). Un mois est offert à l’inscription, sans carte bancaire.`,
  },
]

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqItems.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: title.split(' | ')[0], item: url },
        ],
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <Nav />
        <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12">
          <Breadcrumb current="Optimiser sa tournée" />
          <p className="text-xs font-black text-[#00C4D4] uppercase tracking-[0.22em] mb-4">Optimisation de tournée</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-6">
            Le trajet mange une prestation par jour. Voici comment WashBoard le limite.
          </h1>
          <p className="text-lg text-slate-500 dark:text-white/60 leading-relaxed mb-8">
            Un lavage auto mobile ne se perd pas dans la prestation elle-même, mais dans le trajet entre
            deux. WashBoard compare le temps de trajet réel entre tes rendez-vous à chaque nouvelle
            réservation, plutôt que de te laisser découvrir un aller-retour d&apos;une heure une fois
            l&apos;agenda rempli.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/signup" className="px-7 py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/25">
              Lancer mon mois gratuit
            </Link>
            <Link href="/logiciel-lavage-auto" className="text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white text-sm font-medium transition-colors underline underline-offset-4">
              Voir le logiciel complet
            </Link>
          </div>
          <p className="text-xs text-slate-400 dark:text-white/25 mt-5">Sans engagement · Sans carte bancaire</p>
        </header>

        {/* ── Le problème ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Le problème</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-6">
            Un trajet mal placé coûte plus cher qu&apos;un client perdu
          </h2>
          <div className="space-y-4 text-slate-500 dark:text-slate-400 leading-relaxed">
            <p>
              Accepter des rendez-vous dans l&apos;ordre où ils arrivent, sans regarder la carte, revient
              à traverser sa zone plusieurs fois par jour pour des trajets qu&apos;un simple regroupement
              aurait évité. Un aller-retour d&apos;une heure, c&apos;est une prestation de moins sur la
              journée — voir notre article sur{' '}
              <Link href="/blog/organiser-ses-tournees-lavage-auto" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
                l&apos;organisation des tournées
              </Link>.
            </p>
            <p>
              Le réflexe manuel (regarder son agenda, estimer un trajet de tête) marche à faible volume.
              Il devient une charge à part entière dès que les réservations arrivent seules, seize heures
              sur vingt-quatre, sans que le laveur soit devant son téléphone pour les arbitrer.
            </p>
          </div>
        </section>

        {/* ── Le mécanisme ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Comment ça marche</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-10">
            Deux mécanismes, un seul calcul de trajet réel
          </h2>
          <div className="space-y-10">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                1. Un horaire injoignable n&apos;est jamais proposé
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                À chaque nouvelle demande, WashBoard calcule le temps de trajet réel (Google Maps) entre
                l&apos;adresse du client et tes rendez-vous déjà posés ce jour-là. Un horaire que ce
                trajet rendrait intenable ne s&apos;affiche tout simplement pas — cette vérification est
                systématique, qu&apos;un laveur ait activé les créneaux groupés ou non.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                2. Les créneaux proches d&apos;un rendez-vous existant sont mis en avant
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Si tu actives les créneaux groupés, un horaire à moins de 15 minutes de trajet d&apos;un
                rendez-vous déjà prévu ressort dans la liste des créneaux proposés — seuil réglable de 5
                à 30 minutes. Tu peux y associer une remise pour encourager le client à le choisir, sans
                y être obligé.
              </p>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5 sm:p-6">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Exemple</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Un rendez-vous est posé à 10h à Bordeaux Sud. Un client de la même zone réserve pour
                  l&apos;après-midi : le créneau de 11h30, à 8 minutes de trajet du premier, ressort en
                  tête — avec la remise que tu as réglée, s&apos;il y en a une.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                3. Le frais de déplacement suit le trajet réel, pas une estimation
              </h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Tu définis des paliers de prix selon la durée de trajet. WashBoard calcule la distance
                réelle depuis ton adresse de départ, ou depuis ton rendez-vous précédent si tu enchaînes
                plusieurs adresses dans la journée, et applique automatiquement le bon palier — sans que
                tu aies à l&apos;estimer toi-même.
              </p>
            </div>
          </div>
        </section>

        {/* ── Ce que ça ne fait pas ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Pour être honnête</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
            Ce n&apos;est pas un GPS qui réordonne ta tournée
          </h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            WashBoard compare chaque nouvelle demande à ce qui est déjà posé, il ne recalcule pas
            l&apos;ordre optimal d&apos;une tournée entière comme le ferait un logiciel de tournées de
            livraison. Pour un laveur qui prend ses rendez-vous au fil de l&apos;eau plutôt qu&apos;en
            planifiant une journée entière à l&apos;avance, c&apos;est exactement ce qui compte : éviter
            le trajet inutile au moment où le rendez-vous se prend, pas après.
          </p>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Questions fréquentes</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-10">
            Ce qu&apos;on nous demande le plus
          </h2>
          <div className="space-y-8">
            {faqItems.map((item) => (
              <div key={item.question}>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{item.question}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50 text-center">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
            Moins de trajets à vide, dès la première semaine
          </h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-xl mx-auto">
            Ta page de réservation en ligne en 10 minutes, et ton premier mois offert.
          </p>
          <Link href="/signup" className="inline-block px-7 py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/25">
            Lancer mon mois gratuit
          </Link>
        </section>

        <Footer />
      </div>
    </>
  )
}
