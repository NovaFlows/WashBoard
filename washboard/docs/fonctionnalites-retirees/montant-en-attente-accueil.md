# Montant des lavages en attente sur l'accueil

**Avant** : en haut de l'accueil, un bandeau cliquable quand des réservations dépassaient le
plafond de l'offre :

```
(3)  195 € de lavages en attente
     3 clients · Votre offre Découverte ne les affiche pas        Voir →
```

Il menait à la page Clients, pas à l'abonnement. Seules les réservations **à venir**
comptaient. Sans prix connu, il affichait « 3 nouveaux clients en attente », jamais un
montant inventé.

**Dans la V2** : les réservations au-delà du plafond apparaissent floutées dans
« À confirmer » sur l'accueil, sans montant. Le montant est sur la page Clients
(« 3 masqués · 266,64 € »).

**Source** (commit `007d644`) :
- `washboard/src/components/dashboard/ReservationsBloquees.tsx` (`BandeauBloquees`) ;
- `washboard/src/app/(dashboard)/dashboard/page.tsx` (calcul).

`montantVerrouille` existe toujours : `src/lib/reservationsVerrouillees.ts`.

## Code d'origine — calcul (page de l'accueil)

```ts
// Le compte porte sur les rendez-vous À VENIR : un client bloqué dont la date
// est passée n'est plus une occasion à saisir.
const nbBloquees = aVenirVisible.filter(b => b.verrouillee).length
// Le montant se calcule sur la liste BRUTE : `masquerVerrouillees` efface
// justement le prix. On somme d'abord, on masque ensuite.
const montantBloque = montantVerrouille(aVenir ?? [], seuilsVerrou)

<BandeauBloquees nombre={nbBloquees} offre={planEffectif(washer)} montant={montantBloque} />
```

## Code d'origine — le bandeau

```tsx
import Link from 'next/link'
import { PLAN_LABELS, formatEuros, type Plan } from '@/lib/plan'

const BLEU = '#1651E8'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

export function BandeauBloquees({ nombre, offre, montant = 0 }: {
  nombre: number
  offre: Plan
  /** Total des lavages masqués, en euros. Zéro quand le prix est inconnu. */
  montant?: number
}) {
  if (nombre <= 0) return null

  return (
    <Link
      href="/dashboard/clients"
      className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
    >
      <span
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
        style={{ backgroundColor: BLEU }}
      >
        {nombre}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
          {montant > 0
            ? `${formatEuros(montant)} € de lavages en attente`
            : `${nombre > 1 ? 'nouveaux clients' : 'nouveau client'} en attente`}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
          {montant > 0 && `${nombre} client${nombre > 1 ? 's' : ''} · `}
          Votre offre {PLAN_LABELS[offre]} ne les affiche pas
        </span>
      </span>
      <span className={`shrink-0 ${SURTITRE}`} style={{ color: BLEU }}>Voir →</span>
    </Link>
  )
}
```

## Pour le reprendre

Attention à la sécurité : le montant doit être calculé côté serveur sur la liste brute, et
seul le total part vers l'écran (jamais le prix ou le nom d'une réservation masquée).
