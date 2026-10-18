// Comparaison dédiée, pas le composant `Table` partagé de Prose.tsx : ce dernier force chaque
// cellule sur une seule ligne et défile horizontalement — pensé pour des cellules courtes (prix,
// dates), pas pour des phrases complètes. Avec ce contenu, la colonne « WashBoard » — celle qui
// doit justement convaincre — se retrouvait hors champ. Ici le texte s'enroule normalement, et la
// colonne WashBoard est teintée. En grille dès 640 px, en lignes empilées sur téléphone (quatre
// colonnes de prose ne tiennent pas sur un petit écran). Styles : `.cb-*` dans vitrine/pages.css.
export function ComparatifBesoins({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="cb">
      {/* En-tête visible dès 640 px : sur téléphone chaque ligne répète son libellé de colonne. */}
      <div className="cb-tete" aria-hidden="true">
        {head.map(h => <p key={h}>{h}</p>)}
      </div>
      <div>
        {rows.map((row, i) => (
          <div key={i} className="cb-ligne">
            <p>{row[0]}</p>
            {row.slice(1).map((cell, j) => (
              <div key={j} className="cb-cell">
                <span className="lib">{head[j + 1]}</span>
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
