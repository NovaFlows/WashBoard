// Comparaison dédiée, pas le composant `Table` partagé de Prose.tsx : ce
// dernier force chaque cellule sur une seule ligne (`whitespace-nowrap`) et
// défile horizontalement — pensé pour des cellules courtes (prix, dates), pas
// pour des phrases complètes. Avec ce contenu, la colonne "WashBoard" — celle
// qui doit justement convaincre — se retrouvait hors champ, à faire défiler
// pour la voir. Ici le texte s'enroule normalement, et la colonne WashBoard
// est visuellement distincte (fond teinté) plutôt que perdue au même niveau
// que les deux autres. En grille sur écran large, en cartes empilées sur
// téléphone (trois colonnes de prose ne tiennent pas sur un petit écran).
//
// Partagé entre la page /meilleur-logiciel-lavage-auto et la landing (doublon
// volontaire demandé par Ryan/Alexandre, la page comparatif étant jugée trop
// intéressante pour rester seulement accessible via un lien).
export function ComparatifBesoins({ head, rows }: { head: string[]; rows: string[][] }) {
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
