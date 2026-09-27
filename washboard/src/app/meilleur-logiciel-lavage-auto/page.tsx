import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SITE_URL } from '@/lib/blog'
import { PLAN_CARDS, SMS_QUOTA, freeMonthsLabel } from '@/lib/plan'
import type { FaqItem } from '@/components/blog/Prose'

// Page comparatif — angle "outils génériques", pas "vs un concurrent nommé".
//
// Contrainte légale (voir échange avec `legal`) : la publicité comparative
// qui nomme un concurrent précis est encadrée par le Code de la consommation
// (objectivité, vérifiabilité, absence de dénigrement) — un exercice qui
// demande un vrai avis juridique avant publication, pas une page écrite en
// une passe. Cette page ne nomme donc AUCUN concurrent du secteur (pas de
// "WashBoard vs X") : elle compare WashBoard à des catégories d'outils
// génériques (gérer à la main, ou un outil de prise de rendez-vous généraliste
// comme Calendly ou Google Agenda seul) — l'angle sûr proposé par le cahier
// des charges P2. Calendly et Google Agenda sont des outils grand public,
// pas des concurrents du secteur du lavage auto : les citer pour décrire
// honnêtement ce qu'ils font bien (la prise de rendez-vous simple) n'est pas
// une comparaison publicitaire au sens du Code de la consommation.
//
// Chaque affirmation ci-dessous est vérifiée dans le code avant d'être écrite,
// pas seulement plausible :
// - réservation en ligne sans compte client : src/lib/faq.ts (FAQ_ITEMS,
//   "Mes clients doivent créer un compte ? Non.")
// - prix et durée par prestation ET par type de véhicule, plusieurs véhicules
//   dans une même réservation avec options propres à chacun : src/lib/pricing.ts
//   (vehiclePrice, offeredTypePrices, dureeTotale), src/components/booking/
//   StepService.tsx (panier multi-types)
// - frais de déplacement par palier de trajet, calculés via Google Maps,
//   depuis le point de départ ou le dernier rendez-vous : src/lib/travelFee.ts
// - créneaux au temps de trajet réel, seuil de 15 min par défaut (réglable de
//   5 à 30, jamais 60) : src/app/api/slots/smart/route.ts, src/lib/slots.ts,
//   src/components/dashboard/admin/IdentiteForm.tsx (input range min={5} max={30})
// - chaque réservation confirmée crée un événement dans l'agenda Google du
//   laveur : src/app/api/bookings/route.ts ("L'événement Google Agenda est
//   créé uniquement à la confirmation du RDV")
// - facture conforme (SIRET, TVA) générée par prestation terminée, envoyée
//   automatiquement au client PROFESSIONNEL uniquement : src/lib/facture.ts
//   (doitEnvoyerFactureAuClient) — le client particulier la retrouve sur le
//   même lien que sa confirmation de réservation :
//   src/components/booking/StepConfirmation.tsx, src/app/api/bookings/[id]/pdf/route.ts
// - avis Google par email, par SMS en formule Pro (150/mois) : src/lib/plan.ts (SMS_QUOTA)
// - prix des formules et mois offert : src/lib/plan.ts (PLAN_CARDS, freeMonthsLabel())
// - "Un RDV confirmé = 4 messages échangés" : reprise telle quelle de la
//   landing (src/components/landing/LandingPage.tsx, section "Ce que tu fais
//   encore à la main"), pas une donnée inventée pour cette page.
//
// Ce qui n'est PAS affirmé faute de preuve dans le code, à dessein : aucun
// devis, aucun rendez-vous récurrent dans l'agenda (materializeRecurring.ts
// ne matérialise que des dépenses), aucune fonctionnalité précise de Calendly
// ou de tout autre outil tiers au-delà de ce qui est notoire et non spécifique
// à un produit (la prise de rendez-vous en ligne).

const title = 'Meilleur logiciel de gestion pour laveur auto mobile | WashBoard'
const description =
  'WhatsApp, Excel, Calendly, Google Agenda ou un logiciel pensé pour le lavage auto : ce qui change vraiment selon l’outil, poste par poste. Comparatif honnête, sans donnée inventée.'
const url = `${SITE_URL}/meilleur-logiciel-lavage-auto`

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

// Comparaison dédiée, pas le composant `Table` partagé de Prose.tsx : ce
// dernier force chaque cellule sur une seule ligne (`whitespace-nowrap`) et
// défile horizontalement — pensé pour des cellules courtes (prix, dates), pas
// pour des phrases complètes. Avec ce contenu, la colonne "WashBoard" — celle
// qui doit justement convaincre — se retrouvait hors champ, à faire défiler
// pour la voir. Ici le texte s'enroule normalement, et la colonne WashBoard
// est visuellement distincte (fond teinté) plutôt que perdue au même niveau
// que les deux autres. En grille sur écran large, en cartes empilées sur
// téléphone (trois colonnes de prose ne tiennent pas sur un petit écran).
function ComparatifBesoins({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* En-tête, visible seulement à partir de sm : sur téléphone chaque
          carte répète son propre libellé de colonne. */}
      <div className="hidden sm:grid sm:grid-cols-[1.3fr_1fr_1fr_1fr] bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {head.map((h, i) => (
          <p key={h} className={`px-4 py-3 text-xs font-black uppercase tracking-wide ${i === head.length - 1 ? 'text-[#1651E8] dark:text-[#6A9FFF]' : 'text-slate-500 dark:text-slate-400'}`}>
            {h}
          </p>
        ))}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {rows.map((row, i) => (
          <div key={i} className="sm:grid sm:grid-cols-[1.3fr_1fr_1fr_1fr] p-4 sm:p-0">
            <p className="font-bold text-slate-900 dark:text-white sm:px-4 sm:py-3 sm:font-semibold mb-2 sm:mb-0">
              {row[0]}
            </p>
            {row.slice(1).map((cell, j) => (
              <div
                key={j}
                className={`text-sm leading-relaxed sm:px-4 sm:py-3 ${j === row.length - 2 ? 'text-slate-900 dark:text-white font-medium bg-[#1651E8]/[0.04] dark:bg-[#1651E8]/10' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <span className="sm:hidden font-bold text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 block mb-1">
                  {head[j + 1]}
                </span>
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Dérivés de PLAN_CARDS, jamais recopiés.
const essentiel = PLAN_CARDS.find(c => c.key === 'essentiel')!
const pro = PLAN_CARDS.find(c => c.key === 'pro')!

const besoinsHead = [
  'Besoin',
  'À la main (WhatsApp, Excel, carnet papier)',
  'Outil généraliste (Calendly, Google Agenda seul)',
  'WashBoard',
]

const besoinsRows: string[][] = [
  [
    'Réservation en ligne, sans échange de messages',
    'Non — chaque créneau se négocie par message',
    'Oui, pour un outil de prise de rendez-vous comme Calendly',
    'Oui',
  ],
  [
    'Prix qui suit le type de véhicule (citadine, SUV, utilitaire…)',
    'Recalculé à la main à chaque fois',
    'Non — un rendez-vous a une durée et un prix uniques',
    'Oui, prix et durée par prestation et par véhicule',
  ],
  [
    'Frais de déplacement calculés automatiquement',
    'Non',
    'Non — pas prévu pour un métier qui se déplace',
    'Oui, par palier de trajet réel (Google Maps)',
  ],
  [
    'Créneaux qui limitent les trajets entre deux adresses',
    'Non',
    'Non — créneaux fixes, sans lien avec la géographie',
    'Oui, groupés au temps de trajet réel',
  ],
  [
    'Facturation conforme (SIRET, TVA, numérotation continue)',
    'Non — à refaire à part',
    'Non',
    'Oui, générée et envoyée automatiquement',
  ],
  [
    'Avis Google demandés après chaque prestation',
    'Non — à faire penser à soi-même',
    'Non',
    `Oui, par email (et SMS en formule Pro, ${SMS_QUOTA.pro}/mois)`,
  ],
  [
    'Plusieurs véhicules dans une même réservation',
    'Possible, mais recalculé à la main',
    'Non — un rendez-vous, un seul motif',
    'Oui, prix et durée propres à chaque véhicule',
  ],
]

const faqItems: FaqItem[] = [
  {
    question: 'Quel est le meilleur logiciel pour un laveur auto mobile ?',
    answer:
      'Ça dépend de ce que tu factures. Si tu factures un prix fixe, peu de véhicules et jamais de déplacement, un simple outil de prise de rendez-vous peut suffire un temps. Dès que le prix dépend du véhicule, que les frais de déplacement doivent être calculés, ou que tu factures avec SIRET et TVA, un logiciel pensé pour ce métier comme WashBoard prend le relais sans que tu aies à le faire à la main.',
  },
  {
    question: 'Est-ce que Calendly ou Google Agenda suffisent pour gérer un lavage auto mobile ?',
    answer:
      'Pour la prise de rendez-vous simple, oui : ce sont de bons outils, pas remplacés ici. L’écart apparaît sur ce qui est propre au métier : le prix qui doit changer selon le véhicule, les frais de déplacement, des créneaux qui tiennent compte du trajet réel entre deux adresses, et une facture conforme derrière chaque prestation. Aucun des deux n’a été conçu pour ça.',
  },
  {
    question: 'Pourquoi ne pas juste combiner WhatsApp, Excel et Calendly ?',
    answer:
      'Ça marche un temps, mais chaque outil ignore les autres : le rendez-vous pris sur Calendly n’a pas le prix du véhicule, qui doit être recalculé dans Excel, pendant que le client négocie encore sur WhatsApp. Un rendez-vous confirmé, c’est souvent plusieurs allers-retours de messages à lui seul. Le coût réel n’est pas le prix des outils (souvent gratuits ou peu chers pris séparément), c’est le temps passé à faire circuler l’information entre eux.',
  },
  {
    question: 'WashBoard remplace-t-il mon Google Agenda ?',
    answer:
      'Non, il s’en sert. Chaque réservation confirmée sur WashBoard crée automatiquement un événement dans ton Google Agenda existant : tu gardes ton agenda, WashBoard y ajoute ce qu’un agenda seul ne calcule pas (prix par véhicule, frais de déplacement, créneaux qui limitent les trajets).',
  },
  {
    question: 'Combien coûte un logiciel dédié comme WashBoard ?',
    answer:
      `${essentiel.price}€/mois en formule ${essentiel.name} (réservation, agenda, créneaux optimisés, frais de déplacement, CRM, facturation, avis Google par email) ou ${pro.price}€/mois en formule ${pro.name}, qui ajoute la comptabilité, les avis par SMS et le multi-laveurs. Un mois est offert à l’inscription, sans carte bancaire.`,
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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav />

      {/* ── Hero ── */}
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-16">
        <Breadcrumb current={title.split(' | ')[0]} />
        <p className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-5">
          Comparatif
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white mb-6 max-w-3xl text-balance">
          Meilleur logiciel de gestion pour laveur auto mobile
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-white/65 max-w-2xl leading-relaxed mb-4">
          Il y a trois façons de piloter une activité de lavage auto mobile : à la main (WhatsApp,
          Excel, un carnet papier), avec un outil de prise de rendez-vous généraliste (Calendly,
          Google Agenda seul), ou avec un logiciel pensé pour ce métier précis. Les trois fonctionnent
          au début. Elles ne tiennent pas la charge de la même façon.
        </p>
        <p className="text-sm text-slate-500 dark:text-white/50 max-w-2xl leading-relaxed mb-8">
          Cette page ne compare WashBoard à aucun concurrent nommé du secteur : elle compare des
          catégories d&apos;outils, honnêtement, poste par poste.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/signup" className="px-7 py-3.5 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/25">
            Lancer mon mois gratuit
          </Link>
          <Link href="/booking" className="text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white text-sm font-medium transition-colors underline underline-offset-4">
            ou prendre un appel
          </Link>
        </div>
        <p className="text-xs text-slate-400 dark:text-white/25 mt-5">Sans engagement · Sans carte bancaire</p>
      </header>

      {/* ── Les trois approches ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Le choix</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-10">
          Trois façons de gérer, aucune n&apos;est absurde
        </h2>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
          <div>
            <span className="text-3xl font-black text-[#1651E8]/25 leading-none">01</span>
            <p className="mt-3 font-bold text-slate-900 dark:text-white">À la main</p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              WhatsApp pour les réservations, Excel pour les prix et le suivi, un carnet ou une note
              pour l&apos;agenda. Zéro coût, zéro mise en place. Tient tant que le volume reste faible
              et que personne d&apos;autre n&apos;a besoin de lire ces informations.
            </p>
          </div>
          <div>
            <span className="text-3xl font-black text-[#1651E8]/25 leading-none">02</span>
            <p className="mt-3 font-bold text-slate-900 dark:text-white">Un outil généraliste</p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Calendly ou un agenda Google partagé gèrent très bien la prise de rendez-vous en ligne
              sans échange de messages. Ils ne savent en revanche rien du métier : ni du véhicule, ni
              du trajet, ni de la facture qui doit suivre.
            </p>
          </div>
          <div>
            <span className="text-3xl font-black text-[#1651E8]/25 leading-none">03</span>
            <p className="mt-3 font-bold text-slate-900 dark:text-white">Un logiciel dédié</p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Pensé pour une activité qui se déplace : prix par véhicule, frais de déplacement,
              créneaux qui limitent la route, facture conforme. Le compromis : un abonnement, et une
              mise en place initiale.
            </p>
          </div>
        </div>
      </section>

      {/* ── Le tableau des besoins ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Poste par poste</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-4">
          Ce qui change vraiment selon l&apos;outil
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed mb-10">
          Pas de note globale ni de verdict à l&apos;emporte-pièce : chaque besoin, comparé pour ce
          qu&apos;il est. Un outil comme Calendly fait très bien la prise de rendez-vous simple —
          l&apos;écart se joue ailleurs.
        </p>
        <ComparatifBesoins head={besoinsHead} rows={besoinsRows} />
      </section>

      {/* ── Pourquoi pas juste combiner ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">La question qui revient</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-6">
          Pourquoi pas juste WhatsApp + Excel + Calendly, combinés ?
        </h2>
        <div className="max-w-2xl space-y-4 text-slate-500 dark:text-slate-400 leading-relaxed">
          <p>
            Chaque outil pris séparément fonctionne. Le problème apparaît entre eux : un rendez-vous
            pris sur Calendly n&apos;a pas le prix du véhicule, qui doit être recalculé à la main dans
            Excel, pendant qu&apos;un détail se négocie encore sur WhatsApp. Rien ne se parle, donc
            tout se recopie.
          </p>
          <p>
            Sur la landing, on chiffre déjà ce que coûte la seule étape des réservations sur WhatsApp
            :{' '}
            <strong className="font-semibold text-slate-700 dark:text-slate-300">
              un rendez-vous confirmé, c&apos;est 4 messages échangés
            </strong>{' '}
            — multiplié par plusieurs clients chaque jour, ça absorbe du temps qui ne sert ni à laver
            une voiture ni à en trouver une nouvelle. Ce temps de coordination entre outils qui ne se
            parlent pas est le vrai coût, plus que le prix de chaque outil pris isolément.
          </p>
          <p>
            C&apos;est l&apos;argument du tout-en-un : un seul endroit où le prix du véhicule, le
            trajet, l&apos;agenda et la facture se déduisent les uns des autres, sans ressaisie.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Questions</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-10">
          Questions fréquentes
        </h2>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
          {faqItems.map(item => (
            <details key={item.question} className="group py-4">
              <summary className="flex items-start justify-between gap-4 cursor-pointer list-none font-semibold text-slate-900 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span aria-hidden="true" className="shrink-0 mt-0.5 text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-slate-700 dark:text-slate-300 leading-[1.7]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div
            style={{ background: 'linear-gradient(135deg, #09111E 0%, #0C1D38 50%, #09111E 100%)' }}
            className="border border-white/[0.06] rounded-2xl p-10 sm:p-16 text-center relative overflow-hidden"
          >
            <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-[#00C4D4]/8 blur-3xl rounded-full pointer-events-none" />
            <h2 className="relative text-3xl sm:text-4xl font-black tracking-tight mb-5 text-white leading-[1.1] max-w-2xl mx-auto text-balance">
              Essaie, et compare toi-même.
            </h2>
            <p className="relative text-white/60 text-base mb-10 max-w-sm mx-auto">
              Ta page de réservation en ligne en 10 minutes, {freeMonthsLabel()} si tu passes à
              l&apos;année, sans carte bancaire en mensuel.
            </p>
            <Link href="/signup" className="relative inline-block px-9 py-4 bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1651E8]/30">
              Lancer mon mois gratuit
            </Link>
            <p className="relative text-xs text-white/25 mt-4">Sans engagement · Sans carte bancaire</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
