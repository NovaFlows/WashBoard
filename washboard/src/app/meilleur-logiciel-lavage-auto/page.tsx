import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/blog'
import { freeMonthsLabel } from '@/lib/plan'
import { resumeOffres } from '@/lib/resumeOffres'
import type { FaqItem } from '@/components/blog/Prose'
import Coque from '@/components/landing/vitrine/Coque'
import FilAriane from '@/components/landing/vitrine/FilAriane'
import { ComparatifBesoins } from '@/components/ComparatifBesoins'
import { besoinsHead, besoinsRows } from '@/lib/comparatifAuto'

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
// - avis Google (email et SMS), facturation et relances dès Starter, créneaux
//   intelligents en Pro, frais de déplacement, acompte, promotions et carte de
//   fidélité dès l'offre gratuite : src/lib/plan.ts (MIN_PLAN, SMS_QUOTA)
// - prix des formules et mois offert : src/lib/plan.ts (PLAN_CARDS, freeMonthsLabel())
// - "Un RDV confirmé = 4 messages échangés" : reprise telle quelle de la
//   ancienne landing (section "Ce que tu fais encore à la main"), pas une
//   donnée inventée pour cette page.
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

// Grille 2026 à 4 offres : la réponse « Combien coûte » vient de
// resumeOffres(), dérivée de plan.ts — plus de prix ni de nom d'offre recopié.

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
      'Non, il s’en sert. Une fois ton Google Agenda connecté, chaque réservation confirmée sur WashBoard y crée automatiquement un événement : tu gardes ton agenda, WashBoard y ajoute ce qu’un agenda seul ne calcule pas (prix par véhicule, frais de déplacement, créneaux qui limitent les trajets).',
  },
  {
    question: 'Peut-on demander un acompte à la réservation ?',
    answer:
      'Oui, dès l’offre gratuite. Tu choisis le montant et ton client le paie par ton propre lien (PayPal, Stripe, SumUp, Lydia, Wero ou virement) : WashBoard n’encaisse rien, l’argent va directement chez toi. Les conditions de remboursement sont affichées au client avant qu’il réserve. Avec Calendly ou un simple agenda, ce suivi reste à faire à la main.',
  },
  {
    question: 'Comment fidéliser ses clients de lavage auto ?',
    answer:
      'Avec une carte de fidélité intégrée, incluse dès l’offre gratuite : chaque prestation terminée ajoute un tampon, et au nombre que tu fixes, la récompense de ton choix (prestation offerte ou remise) s’applique toute seule à la réservation suivante. Ton client reçoit un email à chaque tampon, sans carte papier à tamponner ni tableau Excel à tenir.',
  },
  {
    question: 'Combien coûte un logiciel dédié comme WashBoard ?',
    answer:
      resumeOffres(),
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
    <Coque>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ── */}
      <header className="pg-hero">
        <div className="w">
          <FilAriane items={[{ label: 'Accueil', href: '/' }, { label: title.split(' | ')[0] }]} />
          <p className="sur-titre"><span className="pt" />Comparatif</p>
          <h1 className="pg-h1">Meilleur logiciel de gestion pour laveur auto mobile</h1>
          <p className="chapo">
            Il y a trois façons de piloter une activité de lavage auto mobile : à la main (WhatsApp,
            Excel, un carnet papier), avec un outil de prise de rendez-vous généraliste (Calendly,
            Google Agenda seul), ou avec un logiciel pensé pour ce métier précis. Les trois fonctionnent
            au début. Elles ne tiennent pas la charge de la même façon.
          </p>
          <p className="chapo">
            Cette page ne compare WashBoard à aucun concurrent nommé du secteur : elle compare des
            catégories d&apos;outils, honnêtement, poste par poste.
          </p>
          <div className="heros-cta">
            <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
            <Link href="/booking" className="pg-lien-doux">ou prendre un appel</Link>
          </div>
          <p className="rassure">Sans engagement · Sans carte bancaire</p>
        </div>
      </header>

      {/* ── Les trois approches ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Le choix</p>
          <h2 className="pg-h2">Trois façons de gérer, aucune n&apos;est absurde</h2>
          <div className="pg-cols">
            <div className="pg-col">
              <span className="nb">01</span>
              <h3>À la main</h3>
              <p>
                WhatsApp pour les réservations, Excel pour les prix et le suivi, un carnet ou une note
                pour l&apos;agenda. Zéro coût, zéro mise en place. Tient tant que le volume reste faible
                et que personne d&apos;autre n&apos;a besoin de lire ces informations.
              </p>
            </div>
            <div className="pg-col">
              <span className="nb">02</span>
              <h3>Un outil généraliste</h3>
              <p>
                Calendly ou un agenda Google partagé gèrent très bien la prise de rendez-vous en ligne
                sans échange de messages. Ils ne savent en revanche rien du métier : ni du véhicule, ni
                du trajet, ni de la facture qui doit suivre.
              </p>
            </div>
            <div className="pg-col">
              <span className="nb">03</span>
              <h3>Un logiciel dédié</h3>
              <p>
                Pensé pour une activité qui se déplace : prix par véhicule, frais de déplacement,
                créneaux qui limitent la route, facture conforme. Le compromis : un abonnement, et une
                mise en place initiale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Le tableau des besoins ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Poste par poste</p>
          <h2 className="pg-h2">Ce qui change vraiment selon l&apos;outil</h2>
          <p className="chapo">
            Pas de note globale ni de verdict à l&apos;emporte-pièce : chaque besoin, comparé pour ce
            qu&apos;il est. Un outil comme Calendly fait très bien la prise de rendez-vous simple —
            l&apos;écart se joue ailleurs.
          </p>
          <ComparatifBesoins head={besoinsHead} rows={besoinsRows} />
        </div>
      </section>

      {/* ── Pourquoi pas juste combiner ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />La question qui revient</p>
          <h2 className="pg-h2">Pourquoi pas juste WhatsApp + Excel + Calendly, combinés ?</h2>
          <div className="pg-texte">
            <p>
              Chaque outil pris séparément fonctionne. Le problème apparaît entre eux : un rendez-vous
              pris sur Calendly n&apos;a pas le prix du véhicule, qui doit être recalculé à la main dans
              Excel, pendant qu&apos;un détail se négocie encore sur WhatsApp. Rien ne se parle, donc
              tout se recopie.
            </p>
            <p>
              Sur la landing, on chiffre déjà ce que coûte la seule étape des réservations sur WhatsApp
              :{' '}
              <strong>un rendez-vous confirmé, c&apos;est 4 messages échangés</strong>{' '}
              — multiplié par plusieurs clients chaque jour, ça absorbe du temps qui ne sert ni à laver
              une voiture ni à en trouver une nouvelle. Ce temps de coordination entre outils qui ne se
              parlent pas est le vrai coût, plus que le prix de chaque outil pris isolément.
            </p>
            <p>
              C&apos;est l&apos;argument du tout-en-un : un seul endroit où le prix du véhicule, le
              trajet, l&apos;agenda et la facture se déduisent les uns des autres, sans ressaisie.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Questions</p>
          <h2 className="pg-h2">Questions fréquentes</h2>
          <div className="faq">
            {faqItems.map(item => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="final">
        <div className="w">
          <h2 className="h2">Essaie, et compare toi-même.</h2>
          <p className="chapo" style={{ marginInline: 'auto' }}>
            Ta page de réservation en ligne en 10 minutes, {freeMonthsLabel()} si tu passes à
            l&apos;année, sans carte bancaire en mensuel.
          </p>
          <div className="heros-cta">
            <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
          </div>
          <p className="rassure">Sans engagement · Sans carte bancaire</p>
        </div>
      </section>
    </Coque>
  )
}
