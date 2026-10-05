import { notFound } from 'next/navigation'
import { jeuDeDonneesDemo } from '@/lib/demo/jeuDeDonnees'
import DemoDashboard from './DemoDashboard'

// Jamais mis en cache au build : les dates du jeu de données (« cette semaine ») doivent
// rester fraîches à chaque ouverture.
export const dynamic = 'force-dynamic'

// Page de démonstration — pour qu'Alexandre voie enfin le rendu de la refonte avec un fichier
// client qui a l'air vivant, sans toucher à sa vraie base de production (ce dépôt n'a pas de
// base de test séparée, voir `e2e/helpers.ts`, en-tête).
//
// Protection NON NÉGOCIABLE : 404 en production, point. Hors du groupe `(dashboard)` pour ne
// pas hériter de son garde-fou d'authentification (`(dashboard)/layout.tsx`) — cette page
// n'a besoin d'aucune session, et ne doit JAMAIS en exiger une, pour rester un simple aperçu.
//
// Aucune lecture ni écriture Supabase ici : `jeuDeDonneesDemo()` est une fonction pure
// (`src/lib/demo/jeuDeDonnees.ts`) qui fabrique des données en mémoire, typées exactement comme
// celles que `/dashboard/clients/page.tsx` lirait en base. Les vrais composants (DashboardShell,
// ClientsViewV2) ne savent pas que ces données sont fictives.
export default function DemoPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return <DemoDashboard donnees={jeuDeDonneesDemo()} />
}
