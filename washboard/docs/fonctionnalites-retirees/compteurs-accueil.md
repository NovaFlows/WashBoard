# Compteurs « En attente » et « Confirmés » de l'accueil

**Avant** : une carte « Statistiques » sur l'accueil, avec quatre chiffres :
En attente · Confirmés · Terminés ce mois · chiffre d'affaires du mois.
« En attente » et « Confirmés » comptaient toutes les réservations dans cet état, sans
borne de date.

**Dans la V2** : la ligne Statistiques de l'accueil garde les rendez-vous terminés et le
chiffre d'affaires. Les demandes en attente sont listées dans « À confirmer ». Le nombre de
rendez-vous confirmés n'est plus affiché.

**Source** (commit `007d644`) :
- `washboard/src/components/dashboard/widgets/StatsWidget.tsx` (la carte) ;
- `washboard/src/app/(dashboard)/dashboard/page.tsx` (les comptages).

## Code d'origine — comptages (page de l'accueil)

```ts
visibles.has('stats')
  ? Promise.all([
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'pending'),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('washer_id', washer.id).eq('status', 'confirmed'),
      // … puis les rendez-vous terminés du mois (booked_price, smart_discount, is_smart_slot)
    ])
  : null

let pending = 0
let confirmed = 0
if (statsMois) {
  const [enAttente, confirmes, doneMois] = statsMois
  if (enAttente.error) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: 'pending' }, enAttente.error)
  if (confirmes.error) logger.warn('dashboard.count_failed', { washerId: washer.id, statut: 'confirmed' }, confirmes.error)
  pending = enAttente.count ?? 0
  confirmed = confirmes.count ?? 0
}
```

## Code d'origine — la carte

```tsx
export function StatsWidget({
  pending, confirmed, terminesCeMois, caCeMois,
}: {
  pending: number
  confirmed: number
  terminesCeMois: number
  /** `null` : compte sans accès au suivi du chiffre d'affaires (offre Découverte). */
  caCeMois: number | null
}) {
  const compteurs = [
    { label: 'En attente', value: String(pending) },
    { label: 'Confirmés', value: String(confirmed) },
    { label: 'Terminés ce mois', value: String(terminesCeMois) },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        Statistiques
      </h2>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {compteurs.map((c, i) => (
          <div key={c.label} className={i > 0 ? 'pl-5 border-l border-slate-100 dark:border-slate-800' : ''}>
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
```

## Pour le reprendre

Les deux comptages s'ajoutent tels quels à la page de l'accueil V2 ; l'affichage se fait
dans la ligne Statistiques existante d'`AccueilV2`.
