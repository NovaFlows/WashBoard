import Link from 'next/link'
import { PLAN_CARDS, PLAN_LABELS, PLAN_PRICES, requiredPlan, type Feature } from '@/lib/plan'

// Écran affiché à la place d'une fonctionnalité que l'offre ne comprend pas.
//
// Il ne sert pas à annoncer un refus — ça, le cadenas le dit en une seconde —
// mais à donner envie de la prochaine offre. D'où trois choses que la version
// précédente n'avait pas :
//
//   1. LE PRIX. « Offre Starter » seul obligeait le laveur à aller le chercher
//      ailleurs, et la plupart n'y allaient pas.
//   2. CE QU'ELLE CONTIENT, en trois lignes lues depuis `PLAN_CARDS` : on ne
//      vend pas une fonctionnalité isolée, on vend un palier.
//   3. UN BOUTON QUI DIT CE QU'IL FAIT. « Voir les offres » renvoyait vers une
//      page de comparaison, c'est-à-dire vers une décision de plus à prendre.
//
// Le cadenas rapetisse et passe à côté du nom de l'offre : gros et centré, il
// occupait le premier regard pour dire « vous ne pouvez pas », alors que tout
// le reste de la carte cherche à dire « voilà ce que vous auriez ».
//
// `apercu` : une maquette DÉCORATIVE, floutée derrière la carte. Ce qui y
// passe est toujours inventé (voir ApercusVerrouilles) — un flou CSS se retire
// en deux clics dans les outils du navigateur, il ne protège rien. Les vrais
// chiffres ne sont pas seulement floutés, ils ne sont pas chargés du tout.
export function UpgradePrompt({ title, description, feature, apercu }: {
  title: string
  description: string
  feature: Feature
  apercu?: React.ReactNode
}) {
  const plan = requiredPlan(feature)
  const carteOffre = PLAN_CARDS.find(c => c.key === plan)
  const prix = PLAN_PRICES[plan]
  const label = PLAN_LABELS[plan]

  // Trois arguments suffisent : au-delà, on ne lit plus une proposition, on
  // parcourt une grille tarifaire — et il y en a déjà une, à un clic.
  const avantages = (carteOffre?.features ?? []).slice(0, 3)

  const carte = (
    <div className="max-w-md w-full mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-5">
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
          Offre {label}
        </span>
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
          {carteOffre?.from && <span className="font-medium text-slate-400">dès </span>}
          {prix}€<span className="text-xs font-medium text-slate-400">/mois</span>
        </span>
      </div>

      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>

      {avantages.length > 0 && (
        <ul className="mt-5 space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-5">
          {avantages.map(a => (
            <li key={a} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {a}
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/dashboard/abonnement"
        className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Passer à l’offre {label} — {prix}€/mois
      </Link>
      <Link
        href="/dashboard/abonnement"
        className="mt-2.5 block text-center text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        Comparer toutes les offres
      </Link>
    </div>
  )

  if (!apercu) return carte

  return (
    <div className="relative">
      {/* `inert` : la maquette ne se sélectionne pas, ne prend pas le focus au
          clavier et ne se lit pas au lecteur d'écran. Sans ça, un laveur
          naviguant au clavier traversait des chiffres inventés avant
          d'atteindre le bouton qui l'intéresse. */}
      {/* Plus de flou global ici : la maquette floute elle-meme ses VALEURS et
          laisse ses INTITULES nets. Tout flouter revenait a montrer une tache
          grise — le laveur voyait qu'il manquait quelque chose, sans savoir
          quoi. */}
      <div inert className="select-none">
        {apercu}
      </div>

      {/* Voile : éclaircit en clair, ASSOMBRIT en sombre. Un voile blanc en
          mode sombre ferait briller la zone verrouillée plus que le reste. */}
      <div className="absolute inset-0 bg-white/20 dark:bg-slate-950/40" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        {carte}
      </div>
    </div>
  )
}
