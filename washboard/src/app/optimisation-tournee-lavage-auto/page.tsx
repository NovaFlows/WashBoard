import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/blog'
import { PLAN_CARDS, SMS_QUOTA, requiredPlan } from '@/lib/plan'
import { tarifOffre } from '@/lib/resumeOffres'
import type { FaqItem } from '@/components/blog/Prose'
import Coque from '@/components/landing/vitrine/Coque'
import FilAriane from '@/components/landing/vitrine/FilAriane'

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

// Grille 2026 à 4 offres : les deux sujets de cette page ne sont PAS dans la
// même offre. Les créneaux groupés (MIN_PLAN.creneaux_intelligents) sont
// réservés au Pro ; les frais de déplacement (MIN_PLAN.frais_deplacement)
// sont ouverts dès l'offre gratuite. Offres lues via requiredPlan() : si
// l'une bouge dans plan.ts, la phrase suit.
const offreCreneaux = PLAN_CARDS.find(c => c.key === requiredPlan('creneaux_intelligents'))!
const offreFrais = PLAN_CARDS.find(c => c.key === requiredPlan('frais_deplacement'))!
const offreFacturation = PLAN_CARDS.find(c => c.key === requiredPlan('facturation'))!

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
      `Les frais de déplacement automatiques sont inclus dès la formule ${offreFrais.name} (${tarifOffre(offreFrais)}), comme la vérification des horaires injoignables. Les créneaux groupés demandent la formule ${offreCreneaux.name}, à ${tarifOffre(offreCreneaux)}, qui ajoute aussi les réservations illimitées et ${SMS_QUOTA[offreCreneaux.key]} SMS d’avis par mois. La facturation et les avis Google sont inclus dès la formule ${offreFacturation.name}. Un mois est offert à l’inscription, sans carte bancaire.`,
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

      <header className="pg-hero">
        <div className="w">
          <FilAriane items={[{ label: 'Accueil', href: '/' }, { label: 'Optimiser sa tournée' }]} />
          <p className="sur-titre"><span className="pt" />Optimisation de tournée</p>
          <h1 className="pg-h1">Le trajet mange une prestation par jour. Voici comment WashBoard le limite.</h1>
          <p className="chapo">
            Un lavage auto mobile ne se perd pas dans la prestation elle-même, mais dans le trajet entre
            deux. WashBoard compare le temps de trajet réel entre tes rendez-vous à chaque nouvelle
            réservation, plutôt que de te laisser découvrir un aller-retour d&apos;une heure une fois
            l&apos;agenda rempli.
          </p>
          <div className="heros-cta">
            <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
            <Link href="/logiciel-lavage-auto" className="pg-lien-doux">Voir le logiciel complet</Link>
          </div>
          <p className="rassure">Sans engagement · Sans carte bancaire</p>
        </div>
      </header>

      {/* ── Le problème ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Le problème</p>
          <h2 className="pg-h2">Un trajet mal placé coûte plus cher qu&apos;un client perdu</h2>
          <div className="pg-texte">
            <p>
              Accepter des rendez-vous dans l&apos;ordre où ils arrivent, sans regarder la carte, revient
              à traverser sa zone plusieurs fois par jour pour des trajets qu&apos;un simple regroupement
              aurait évité. Un aller-retour d&apos;une heure, c&apos;est une prestation de moins sur la
              journée — voir notre article sur{' '}
              <Link href="/blog/organiser-ses-tournees-lavage-auto">l&apos;organisation des tournées</Link>.
            </p>
            <p>
              Le réflexe manuel (regarder son agenda, estimer un trajet de tête) marche à faible volume.
              Il devient une charge à part entière dès que les réservations arrivent seules, seize heures
              sur vingt-quatre, sans que le laveur soit devant son téléphone pour les arbitrer.
            </p>
          </div>
        </div>
      </section>

      {/* ── Le mécanisme ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Comment ça marche</p>
          <h2 className="pg-h2">Trois mécanismes, un seul calcul de trajet réel</h2>
          <div className="pg-etapes">
            <div className="pg-etape">
              <h3>1. Un horaire injoignable n&apos;est jamais proposé</h3>
              <p>
                À chaque nouvelle demande, WashBoard calcule le temps de trajet réel (Google Maps) entre
                l&apos;adresse du client et tes rendez-vous déjà posés ce jour-là. Un horaire que ce
                trajet rendrait intenable ne s&apos;affiche tout simplement pas — cette vérification est
                systématique, qu&apos;un laveur ait activé les créneaux groupés ou non.
              </p>
            </div>
            <div className="pg-etape">
              <h3>2. Les créneaux proches d&apos;un rendez-vous existant sont mis en avant</h3>
              <p>
                Si tu actives les créneaux groupés (formule {offreCreneaux.name}), un horaire à moins de 15 minutes de trajet d&apos;un
                rendez-vous déjà prévu ressort dans la liste des créneaux proposés — seuil réglable de 5
                à 30 minutes. Tu peux y associer une remise pour encourager le client à le choisir, sans
                y être obligé.
              </p>
              <div className="pg-exemple">
                <b>Exemple</b>
                <p>
                  Un rendez-vous est posé à 10h à Bordeaux Sud. Un client de la même zone réserve pour
                  l&apos;après-midi : le créneau de 11h30, à 8 minutes de trajet du premier, ressort en
                  tête — avec la remise que tu as réglée, s&apos;il y en a une.
                </p>
              </div>
            </div>
            <div className="pg-etape">
              <h3>3. Le frais de déplacement suit le trajet réel, pas une estimation</h3>
              <p>
                Tu définis des paliers de prix selon la durée de trajet. WashBoard calcule la distance
                réelle depuis ton adresse de départ, ou depuis ton rendez-vous précédent si tu enchaînes
                plusieurs adresses dans la journée, et applique automatiquement le bon palier — sans que
                tu aies à l&apos;estimer toi-même.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ce que ça ne fait pas ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Pour être honnête</p>
          <h2 className="pg-h2">Ce n&apos;est pas un GPS qui réordonne ta tournée</h2>
          <div className="pg-texte">
            <p>
              WashBoard compare chaque nouvelle demande à ce qui est déjà posé, il ne recalcule pas
              l&apos;ordre optimal d&apos;une tournée entière comme le ferait un logiciel de tournées de
              livraison. Pour un laveur qui prend ses rendez-vous au fil de l&apos;eau plutôt qu&apos;en
              planifiant une journée entière à l&apos;avance, c&apos;est exactement ce qui compte : éviter
              le trajet inutile au moment où le rendez-vous se prend, pas après.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Questions fréquentes</p>
          <h2 className="pg-h2">Ce qu&apos;on nous demande le plus</h2>
          <div className="pg-etapes">
            {faqItems.map((item) => (
              <div key={item.question} className="pg-etape">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="final">
        <div className="w">
          <h2 className="h2">Moins de trajets à vide, dès la première semaine</h2>
          <p className="chapo" style={{ marginInline: 'auto' }}>
            Ta page de réservation en ligne en 10 minutes, et ton premier mois offert.
          </p>
          <div className="heros-cta">
            <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
          </div>
        </div>
      </section>
    </Coque>
  )
}
