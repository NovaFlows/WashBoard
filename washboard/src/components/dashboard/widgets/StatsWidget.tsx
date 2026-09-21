import { formatPrice } from '@/lib/pricing'

// Une seule couleur pour les quatre chiffres, pas une par case : « en
// attente » n'est pas un avertissement et « confirmés » n'est pas un succès,
// ce ne sont que des catégories — leur donner CHACUNE sa couleur n'annoncerait
// rien de réel. La même teinte que le chiffre d'affaires, reprise pour tous,
// lit la carte comme une famille cohérente plutôt que comme un feu tricolore.
//
// Traitement « panneau d'instrument » plutôt que carte SaaS générique : le
// titre s'efface en petite légende technique, les chiffres — en monospace,
// comme un compteur — portent tout le poids visuel. C'est la lecture qui
// compte, pas la décoration autour.
//
// Chaque libellé annonce sa propre portée dans le temps, pour qu'aucun ne se
// lise comme un autre : « en attente »/« confirmés » sont un instantané de
// maintenant, « terminés » et le CA sont bornés au mois en cours.

export function StatsWidget({
  pending, confirmed, terminesCeMois, caCeMois,
}: {
  pending: number
  confirmed: number
  terminesCeMois: number
  /** `null` : compte sans accès à la comptabilité (plan Essentiel). La case
   *  est alors omise plutôt que de réclamer une mise à niveau dans un espace
   *  aussi compact. */
  caCeMois: number | null
}) {
  const compteurs = [
    { label: 'En attente', value: String(pending) },
    { label: 'Confirmés', value: String(confirmed) },
    { label: 'Terminés ce mois', value: String(terminesCeMois) },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        Statistiques
      </h2>

      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {compteurs.map((c, i) => (
          <div
            key={c.label}
            className={i > 0 ? 'pl-5 border-l border-slate-100 dark:border-slate-800' : ''}
          >
            <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums leading-none">{c.value}</p>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">{c.label}</p>
          </div>
        ))}
      </div>

      {caCeMois !== null && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatPrice(caCeMois)}</span>
          <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500">chiffre d’affaires · mois</span>
        </div>
      )}
    </div>
  )
}
