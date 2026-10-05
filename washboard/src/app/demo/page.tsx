import { notFound } from 'next/navigation'
import { jeuDeDonneesDemo, jeuDeDonneesAccueilDemo } from '@/lib/demo/jeuDeDonnees'
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
// Aucune lecture ni écriture Supabase ici : `jeuDeDonneesDemo()`/`jeuDeDonneesAccueilDemo()`
// sont des fonctions pures (`src/lib/demo/jeuDeDonnees.ts`) qui fabriquent des données en
// mémoire, typées exactement comme celles que `/dashboard/clients/page.tsx` ou
// `/dashboard/page.tsx` liraient en base. Les vrais composants (DashboardShell, ClientsViewV2,
// AccueilV2) ne savent pas que ces données sont fictives.
//
// Les trois états d'« Aujourd'hui » (passe « bureau », écrans 1/45/46 de la maquette) sont
// calculés ICI, les trois d'un coup : `DemoDashboard` ne fait que choisir laquelle des trois
// afficher, sans refaire une aller-retour serveur à chaque bascule du sélecteur.
export default function DemoPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <DemoDashboard
      donnees={jeuDeDonneesDemo()}
      accueil={{
        normal: jeuDeDonneesAccueilDemo('normal'),
        premierJour: jeuDeDonneesAccueilDemo('premier-jour'),
        quota: jeuDeDonneesAccueilDemo('quota'),
      }}
    />
  )
}
