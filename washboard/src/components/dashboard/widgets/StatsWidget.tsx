import { formatPrice } from '@/lib/pricing'

// Quatre chiffres, chacun avec sa propre portée dans le temps — annoncée dans
// son libellé pour qu'aucun ne se lise comme un autre : « en attente » et
// « confirmés » sont un instantané de maintenant (un rendez-vous en attente
// n'a pas de mois), « terminés » et le chiffre d'affaires sont bornés au mois
// en cours.

export function StatsWidget({
  pending, confirmed, terminesCeMois, caCeMois,
}: {
  pending: number
  confirmed: number
  terminesCeMois: number
  /** `null` : compte sans accès à la comptabilité (plan Essentiel). La tuile
   *  est alors omise plutôt que de réclamer une mise à niveau dans un espace
   *  aussi compact. */
  caCeMois: number | null
}) {
  const tuiles = [
    { label: 'En attente', value: String(pending), color: 'amber' as const },
    { label: 'Confirmés', value: String(confirmed), color: 'emerald' as const },
    { label: 'Terminés ce mois', value: String(terminesCeMois), color: 'slate' as const },
    ...(caCeMois !== null ? [{ label: 'CA ce mois', value: formatPrice(caCeMois), color: 'blue' as const }] : []),
  ]

  const couleurs = {
    amber:   'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    slate:   'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
    blue:    'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Statistiques</h2>
      <div className="grid grid-cols-2 gap-2">
        {tuiles.map(t => (
          <div key={t.label} className={`rounded-xl border p-2.5 text-center ${couleurs[t.color]}`}>
            <p className="text-lg font-bold tabular-nums">{t.value}</p>
            <p className="text-[11px] font-medium mt-0.5 opacity-80 leading-tight">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
