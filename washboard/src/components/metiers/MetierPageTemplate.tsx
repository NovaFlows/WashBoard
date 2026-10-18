import Link from 'next/link'
import { ARTICLES, THEME_LABEL, type Theme } from '@/lib/blog'
import { PLAN_CARDS, freeMonthsLabel } from '@/lib/plan'
import { tarifOffre } from '@/lib/resumeOffres'
import { Faq, type FaqItem } from '@/components/blog/Prose'
import Coque from '@/components/landing/vitrine/Coque'
import FilAriane from '@/components/landing/vitrine/FilAriane'

// Gabarit commun aux pages métier ("logiciel pour <métier>"). Une page par
// métier publié : voir `@/lib/metiers`. Ce fichier porte la structure et le
// style — le contenu (problèmes, fonctionnalités, FAQ) est écrit à la main
// pour chaque métier, dans son `page.tsx`, jamais généré.
//
// Volontairement en dehors de `/blog` : ce n'est pas un article daté, mais une
// page produit qui mélange explication du métier et fonctionnalités. Elle
// partage la coque de la landing (navigation, pied de page) via `Coque`.

export type MetierProblem = { titre: string; desc: React.ReactNode }
export type MetierFeature = { titre: string; desc: React.ReactNode }
/** Une carte de la section "Les métiers couverts" — hub de maillage vers les
 *  pages métier publiées. `href` reste absent tant qu'aucune page n'existe
 *  pour ce métier : la carte s'affiche alors sans lien, plutôt que vers une
 *  page qui n'existe pas. */
export type MetierCovered = { titre: string; desc: React.ReactNode; href?: string }

export type MetierPageTemplateProps = {
  /** Thème `blog.ts` du métier : pilote le maillage automatique vers les
   *  articles ("Pour aller plus loin").
   *
   *  Optionnel : absent sur la page catégorie ("logiciel-services-a-domicile"),
   *  qui ne représente aucun métier précis et ne doit donc favoriser aucun
   *  thème dans son maillage — voir plus bas. */
  theme?: Theme
  /** Court libellé au-dessus du H1 (repris de la section "Pour qui ?" de la landing). */
  eyebrow: string
  h1: string
  intro: string
  problemesTitre: string
  problemes: MetierProblem[]
  fonctionnalitesTitre: string
  fonctionnalitesIntro?: string
  fonctionnalites: MetierFeature[]
  /** Section "Les métiers couverts", entre "Comment WashBoard répond" et "Ce
   *  que ça coûte" — uniquement sur la page catégorie, hub de maillage vers
   *  les pages métier. Absente (undefined) sur une page métier classique. */
  metiers?: MetierCovered[]
  /** Encart "Voir le comparatif", juste après "Ce que ça coûte" — seulement
   *  si ce métier a une page comparatif publiée (P2 du cahier des charges).
   *  Absent (undefined) : rien ne s'affiche, comme aujourd'hui sur les
   *  métiers qui n'en ont pas encore. Un lien vers un comparatif enterré au
   *  milieu d'un paragraphe de fonctionnalité ne suffit pas à le rendre
   *  trouvable : ceci lui donne une vraie place, visible sans avoir à lire
   *  toute la page. */
  comparatif?: { href: string; titre: string; texte: string }
  faq: FaqItem[]
  ctaTitre: string
  ctaTexte: string
}

export default function MetierPageTemplate({
  theme,
  eyebrow,
  h1,
  intro,
  problemesTitre,
  problemes,
  fonctionnalitesTitre,
  fonctionnalitesIntro,
  fonctionnalites,
  metiers,
  comparatif,
  faq,
  ctaTitre,
  ctaTexte,
}: MetierPageTemplateProps) {
  // Avec un thème (page métier) : les articles de ce thème, les plus
  // récemment mis à jour d'abord, comme sur /blog — ajouter un article à
  // ARTICLES avec ce thème suffit à l'afficher ici, sans toucher cette page.
  //
  // Sans thème (page catégorie, aucun métier précis) : les 6 articles les
  // plus récemment mis à jour tous thèmes confondus, pour ne favoriser aucun
  // métier dans ce maillage-là.
  const articles = theme
    ? ARTICLES.filter(a => a.theme === theme).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : [...ARTICLES].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)

  const prix = [...PLAN_CARDS].sort((a, b) => a.price - b.price)

  return (
    <Coque>
      {/* ── Hero ── */}
      <header className="pg-hero">
        <div className="w">
          <FilAriane items={[{ label: 'Accueil', href: '/' }, { label: h1 }]} />
          <p className="sur-titre"><span className="pt" />{eyebrow}</p>
          <h1 className="pg-h1">{h1}</h1>
          <p className="chapo">{intro}</p>
          <div className="heros-cta">
            <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
            <Link href="/booking" className="pg-lien-doux">ou prendre un appel</Link>
          </div>
          <p className="rassure">Sans engagement · Sans carte bancaire</p>
        </div>
      </header>

      {/* ── Le problème du métier ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Le problème</p>
          <h2 className="pg-h2">{problemesTitre}</h2>
          <div className="pg-cols">
            {problemes.map((p, i) => (
              <div key={p.titre} className="pg-col">
                <span className="nb">{String(i + 1).padStart(2, '0')}</span>
                <h3>{p.titre}</h3>
                <div className="txt">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment WashBoard répond ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Comment WashBoard répond</p>
          <h2 className="pg-h2">{fonctionnalitesTitre}</h2>
          {fonctionnalitesIntro && <p className="chapo">{fonctionnalitesIntro}</p>}
          <div className="pg-liste">
            {fonctionnalites.map(f => (
              <div key={f.titre}>
                <p className="t">{f.titre}</p>
                <div className="txt">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Les métiers couverts — hub de maillage, uniquement sur la page
          catégorie ("metiers" fourni) ── */}
      {metiers && metiers.length > 0 && (
        <section className="section">
          <div className="w">
            <p className="sur-titre"><span className="pt" />Les métiers couverts</p>
            <h2 className="pg-h2">Un même outil, réglé pour chaque métier</h2>
            <ul className="pg-liste">
              {metiers.map((m, i) => {
                // Un nombre impair de cartes laisse un trou en bas à droite de la
                // grille : la dernière occupe alors les deux colonnes. Se corrige
                // tout seul quand une carte s'ajoute.
                const pleine = metiers.length % 2 === 1 && i === metiers.length - 1 ? 'pleine' : undefined
                // Une carte ne devient un lien que si sa page métier existe déjà
                // (voir metierPageForTheme) : pas de lien vers une page absente.
                // Même repère « En savoir plus » que les cartes métier de la landing.
                const contenu = (
                  <>
                    <p className="t">{m.titre}</p>
                    <div className="txt">{m.desc}</div>
                    {m.href && <span className="suite">En savoir plus →</span>}
                  </>
                )
                return (
                  <li key={m.titre} className={pleine}>
                    {m.href ? <Link href={m.href}>{contenu}</Link> : contenu}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── Ce que ça coûte — dérivé de PLAN_CARDS, jamais recopié ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Ce que ça coûte</p>
          <h2 className="pg-h2">
            {prix[0].price === 0 ? 'Gratuit' : `${prix[0].price}€/mois`} pour démarrer, sans engagement en mensuel.
          </h2>
          <div className="pg-texte">
            {prix.map(c => (
              <p key={c.key}>
                {/* tarifOffre : « gratuite », « 19€/mois » ou « sur devis ». Le prix
                    brut affichait « 0€/mois » pour Découverte et « 129€/mois »
                    pour Business, que la grille de l'accueil ne publie pas. */}
                <strong>{c.name} — {tarifOffre(c)}.</strong>{' '}
                {c.features.join(', ')}.
              </p>
            ))}
            <p>
              Passage à l&apos;année possible (engagement de 12 mois), {freeMonthsLabel()}. Détail
              complet des formules sur{' '}
              <Link href="/#tarifs">la page d&apos;accueil</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ── Voir le comparatif — encart visible, pas un lien enterré dans un
          paragraphe : voir le commentaire de la prop `comparatif` plus haut. ── */}
      {comparatif && (
        <section className="w pg-encart-bloc">
          <Link href={comparatif.href} className="pg-encart">
            <div>
              <p className="t">{comparatif.titre}</p>
              <p className="txt">{comparatif.texte}</p>
            </div>
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>
      )}

      {/* ── Pour aller plus loin — automatique, filtré par thème (ou, sans
          thème, les derniers articles tous métiers confondus) ── */}
      {articles.length > 0 && (
        <section className="section">
          <div className="w">
            <p className="sur-titre"><span className="pt" />Pour aller plus loin</p>
            <h2 className="pg-h2">
              {theme
                ? `${articles.length > 1 ? 'Nos articles' : 'Notre article'} ${THEME_LABEL[theme].toLowerCase()}`
                : 'Nos derniers articles'}
            </h2>
            {/* Un seul article ne remplit pas une grille à deux colonnes sans
                paraître abandonnée : on la réserve à partir de deux articles. */}
            <ul className={articles.length > 1 ? 'pg-liste' : 'pg-liste une'}>
              {articles.map(a => (
                <li key={a.slug}>
                  <Link href={`/blog/${a.slug}`}>
                    <p className="t">{a.title}</p>
                    <p className="txt">{a.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── FAQ propre à ce métier ── */}
      <section className="section">
        <div className="w">
          <p className="sur-titre"><span className="pt" />Questions</p>
          <Faq items={faq} />
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="final">
        <div className="w">
          <h2 className="h2">{ctaTitre}</h2>
          <p className="chapo" style={{ marginInline: 'auto' }}>{ctaTexte}</p>
          <div className="heros-cta">
            <Link href="/signup" className="btn btn-accent">Lancer mon mois gratuit</Link>
          </div>
          <p className="rassure">Sans engagement · Sans carte bancaire</p>
        </div>
      </section>
    </Coque>
  )
}
