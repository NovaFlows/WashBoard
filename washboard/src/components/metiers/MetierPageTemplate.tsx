import Link from 'next/link'
import Image from 'next/image'
import { ARTICLES, THEME_LABEL, type Theme } from '@/lib/blog'
import { PLAN_CARDS, freeMonthsLabel } from '@/lib/plan'
import { tarifOffre } from '@/lib/resumeOffres'
import { Faq, type FaqItem } from '@/components/blog/Prose'

// Gabarit commun aux pages métier ("logiciel pour <métier>"). Une page par
// métier publié : voir `@/lib/metiers`. Ce fichier porte la structure et le
// style — le contenu (problèmes, fonctionnalités, FAQ) est écrit à la main
// pour chaque métier, dans son `page.tsx`, jamais généré.
//
// Volontairement en dehors de `/blog` : ce n'est pas un article daté, mais une
// page produit qui mélange explication du métier et fonctionnalités. Elle
// porte donc sa propre nav/pied de page, comme la landing.

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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans">
      <Nav />

      {/* ── Hero ── */}
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-16">
        <Breadcrumb current={h1} />
        <p className="text-xs font-black text-[#1651E8] dark:text-[#00C4D4] uppercase tracking-[0.22em] mb-5">
          {eyebrow}
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white mb-6 max-w-3xl text-balance">
          {h1}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-white/65 max-w-2xl leading-relaxed mb-8">
          {intro}
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

      {/* ── Le problème du métier ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Le problème</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-10">
          {problemesTitre}
        </h2>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
          {problemes.map((p, i) => (
            <div key={p.titre}>
              <span className="text-3xl font-black text-[#1651E8]/25 leading-none">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-3 font-bold text-slate-900 dark:text-white">{p.titre}</p>
              <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comment WashBoard répond ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Comment WashBoard répond</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl">
          {fonctionnalitesTitre}
        </h2>
        {fonctionnalitesIntro && (
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">{fonctionnalitesIntro}</p>
        )}
        <div className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-8">
          {fonctionnalites.map(f => (
            <div key={f.titre}>
              <p className="font-bold text-slate-900 dark:text-white">{f.titre}</p>
              <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Les métiers couverts — hub de maillage, uniquement sur la page
          catégorie ("metiers" fourni) ── */}
      {metiers && metiers.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Les métiers couverts</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-10">
            Un même outil, réglé pour chaque métier
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {metiers.map((m, i) => {
              // Une carte cliquable doit se voir comme telle : au repos, rien
              // ne la distinguait d'une carte dont la page n'existe pas
              // encore. Même repère "En savoir plus →" que les cartes métier
              // de la landing, déjà en production.
              const contenu = (
                <>
                  <p className="font-bold text-slate-900 dark:text-white group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors">
                    {m.titre}
                  </p>
                  <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</div>
                  {m.href && (
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1651E8] dark:text-[#6A9FFF]">
                      En savoir plus
                      <svg aria-hidden className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </>
              )
              // Un nombre impair de cartes laisse un trou en bas à droite de la
              // grille : la dernière occupe alors les deux colonnes, et son
              // texte remplit la ligne au lieu de se tasser dans la moitié
              // gauche. Se corrige tout seul quand une carte s'ajoute.
              const pleineLargeur =
                metiers.length % 2 === 1 && i === metiers.length - 1 ? 'sm:col-span-2' : ''
              // Une carte ne devient un lien que si sa page métier existe déjà
              // (voir metierPageForTheme) : pas de lien vers une page absente.
              return m.href ? (
                <Link
                  key={m.titre}
                  href={m.href}
                  className={`group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 rounded-lg ${pleineLargeur}`}
                >
                  {contenu}
                </Link>
              ) : (
                <div key={m.titre} className={pleineLargeur}>{contenu}</div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Ce que ça coûte — dérivé de PLAN_CARDS, jamais recopié ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Ce que ça coûte</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-6">
          {prix[0].price === 0 ? 'Gratuit' : `${prix[0].price}€/mois`} pour démarrer, sans engagement en mensuel.
        </h2>
        <div className="max-w-2xl space-y-3 text-slate-500 dark:text-slate-400 leading-relaxed">
          {prix.map(c => (
            <p key={c.key}>
              {/* tarifOffre : « gratuite », « 19€/mois » ou « sur devis ». Le prix
                  brut affichait « 0€/mois » pour Découverte et « 129€/mois »
                  pour Business, que la grille de l'accueil ne publie pas. */}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">{c.name} — {tarifOffre(c)}.</strong>{' '}
              {c.features.join(', ')}.
            </p>
          ))}
          <p>
            Passage à l&apos;année possible (engagement de 12 mois), {freeMonthsLabel()}. Détail
            complet des formules sur{' '}
            <Link href="/#tarifs" className="font-semibold text-[#1651E8] dark:text-[#6A9FFF] hover:underline">
              la page d&apos;accueil
            </Link>.
          </p>
        </div>
      </section>

      {/* ── Voir le comparatif — encart visible, pas un lien enterré dans un
          paragraphe : voir le commentaire de la prop `comparatif` plus haut. ── */}
      {comparatif && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <Link
            href={comparatif.href}
            className="group flex items-center justify-between gap-4 sm:gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-8 hover:border-[#1651E8]/40 dark:hover:border-[#6A9FFF]/40 transition-colors"
          >
            <div>
              <p className="font-bold text-slate-900 dark:text-white group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors">
                {comparatif.titre}
              </p>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {comparatif.texte}
              </p>
            </div>
            <svg aria-hidden className="w-5 h-5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>
      )}

      {/* ── Pour aller plus loin — automatique, filtré par thème (ou, sans
          thème, les derniers articles tous métiers confondus) ── */}
      {articles.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
          <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Pour aller plus loin</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white max-w-2xl mb-10">
            {theme
              ? `${articles.length > 1 ? 'Nos articles' : 'Notre article'} ${THEME_LABEL[theme].toLowerCase()}`
              : 'Nos derniers articles'}
          </h2>
          {/* Un seul article ne remplit pas une grille à deux colonnes sans
              paraître abandonnée : on la réserve à partir de deux articles,
              et on limite la largeur du cas à un seul pour qu'il ne s'étire
              pas sur toute la largeur de la page. */}
          <ul className={articles.length > 1 ? 'grid sm:grid-cols-2 gap-x-10 gap-y-8' : 'max-w-xl'}>
            {articles.map(a => (
              <li key={a.slug}>
                <Link href={`/blog/${a.slug}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 rounded-lg">
                  <p className="font-bold text-slate-900 dark:text-white group-hover:text-[#1651E8] dark:group-hover:text-[#6A9FFF] transition-colors leading-snug">
                    {a.title}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{a.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── FAQ propre à ce métier ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-100 dark:border-slate-800/50">
        <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.22em] mb-4">Questions</p>
        <Faq items={faq} />
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
              {ctaTitre}
            </h2>
            <p className="relative text-white/60 text-base mb-10 max-w-sm mx-auto">
              {ctaTexte}
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
