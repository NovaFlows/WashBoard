import Link from 'next/link'

export function ClientsWidget({
  total, nouveauxCeMois, visiteursCeMois, diffVisiteursSemaine,
}: {
  total: number
  nouveauxCeMois: number
  /** Sessions distinctes sur la page de réservation ce mois-ci — même
   *  définition que le CRM (`countDistinctSessions`), pour que ce chiffre ne
   *  raconte jamais une histoire différente de celui de la page CRM. */
  visiteursCeMois: number
  /** Visiteurs de cette semaine (lundi → maintenant) moins ceux de la semaine
   *  précédente (lundi → dimanche) — donc une semaine encore en cours
   *  comparée à une semaine pleine, comme les autres vues « semaine » du
   *  produit (Comptabilité). `null` : pas assez de recul pour comparer, ou
   *  widget Clients tout juste activé. */
  diffVisiteursSemaine: number | null
}) {
  const positif = diffVisiteursSemaine !== null && diffVisiteursSemaine > 0

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
          Clients
        </h2>
        {/* Demandé explicitement à CET endroit (plutôt qu'un raccourci séparé
            en haut de l'accueil) : l'action de suivi vit dans la carte
            qu'elle prolonge. */}
        <Link
          href="/dashboard/clients"
          className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity shrink-0"
        >
          Suivre mes clients →
        </Link>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{total}</p>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">au total</p>
        </div>
        {nouveauxCeMois > 0 && (
          <div>
            {/* Vert assumé : un nombre de nouveaux clients en plus est
                réellement une bonne nouvelle, contrairement aux autres
                chiffres du tableau de bord qui ne sont que des catégories. */}
            <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{nouveauxCeMois}</p>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">nouveaux · mois</p>
          </div>
        )}
        <div>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{visiteursCeMois}</p>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5">visiteurs · mois</p>
          {diffVisiteursSemaine !== null && (
            <p className={`text-[10px] font-semibold tabular-nums mt-1 ${positif ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {diffVisiteursSemaine > 0 ? '+' : ''}{diffVisiteursSemaine} cette semaine
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
