import { formatPrice } from '@/lib/pricing'

// Quatre chiffres, sans une couleur par case : « en attente » n'est pas un
// avertissement et « confirmés » n'est pas un succès, ce ne sont que des
// catégories — leur donner une couleur chacune n'aurait rien annoncé de réel
// (c'est le motif "quatre pavés aux bordures arc-en-ciel" qui a fait dire que
// cette section « faisait trop IA »). La seule couleur qui reste est celle du
// chiffre d'affaires : lui seul est le résultat qu'on regarde en premier.
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Statistiques</h2>

      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {compteurs.map((c, i) => (
          <div
            key={c.label}
            className={i > 0 ? 'pl-5 border-l border-slate-100 dark:border-slate-800' : ''}
          >
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">{c.value}</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {caCeMois !== null && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatPrice(caCeMois)}</span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">de chiffre d’affaires ce mois-ci</span>
        </div>
      )}
    </div>
  )
}
