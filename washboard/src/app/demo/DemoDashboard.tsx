'use client'

import { useEffect } from 'react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsViewV2 from '@/components/dashboard/ClientsViewV2'
import type { jeuDeDonneesDemo } from '@/lib/demo/jeuDeDonnees'

type Donnees = ReturnType<typeof jeuDeDonneesDemo>

// Le seul écran branché ici est « Clients » : c'est le seul réellement migré en v2, et le seul
// dont les requêtes/actions se résument à des fonctions pures (`listeClients`,
// `buildClientProfile`...) sans appel réseau automatique. Aujourd'hui/Agenda ne sont PAS
// branchés : leurs actions (clôturer un rendez-vous, reprogrammer...) appellent de VRAIES
// routes API qui écriraient dans la base du compte réellement connecté en dev — exactement le
// risque que cette page existe pour éviter. `ClientsViewV2` lui-même porte deux actions de ce
// genre (glisser pour « Supprimer » un client, « Ne plus relancer ») : elles restent câblées
// vers les vraies routes `/api/clients/[cle]`, parce que la consigne était de montrer le VRAI
// composant, pas une copie. Sur une clé fictive comme celles de ce jeu de données, l'écriture
// ne touche ni argent ni message envoyé — mais c'est une écriture réelle quand même (voir le
// rapport de la passe). Ne pas s'en servir ici.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`

function SelecteurDemo() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <span className={`rounded-full px-3 py-1 text-[11px] ${corpsFort}`} style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }}>
        Démo
      </span>
      <div className="flex gap-1.5">
        <span
          className={`rounded-[var(--v2-radius-pilule)] px-3 py-1.5 text-[12.5px] ${corpsFort}`}
          style={{ background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }}
        >
          Clients
        </span>
        {/* Pas encore branchés — voir le commentaire au-dessus de `ECRANS`. */}
        <span
          className={`rounded-[var(--v2-radius-pilule)] border px-3 py-1.5 text-[12.5px] ${corps}`}
          style={{ borderColor: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }}
          title="Pas encore branché : ses actions écriraient dans la vraie base"
        >
          Aujourd’hui
        </span>
        <span
          className={`rounded-[var(--v2-radius-pilule)] border px-3 py-1.5 text-[12.5px] ${corps}`}
          style={{ borderColor: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }}
          title="Pas encore branché : ses actions écriraient dans la vraie base"
        >
          Agenda
        </span>
      </div>
      <span className={`text-[12px] ${corps}`} style={{ color: 'var(--v2-color-gris)' }}>
        Jeu de données fabriqué en mémoire — rien n’est lu ni écrit dans la base.
      </span>
    </div>
  )
}

/** VERROU D’ÉCRITURE — la raison d’être de cette page.
 *
 *  On rend ici les VRAIS composants, et certains portent des actions câblées sur de vraies
 *  routes d’API : glisser une ligne pour supprimer un client, « ne plus relancer », fusionner
 *  deux fiches. Ces routes font un `upsert` dans la table `clients` du compte réellement
 *  connecté — et ce dépôt n’a pas de base de test (voir l’en-tête de e2e/helpers.ts). Ce
 *  serait donc la vraie base de production d’un laveur.
 *
 *  On neutralise donc toute requête qui n’est pas une lecture, le temps que cette page vive.
 *  Le filtre porte sur la MÉTHODE, pas sur une liste d’adresses : une action ajoutée demain
 *  sera bloquée elle aussi, sans que personne ait à y penser. C’est ce qui rend vraie la
 *  phrase affichée en haut de l’écran — « rien n’est lu ni écrit dans la base ».
 */
function useVerrouEcriture() {
  useEffect(() => {
    const origine = window.fetch
    window.fetch = async (entree, init) => {
      const methodeBrute = init?.method
        ?? (typeof Request !== 'undefined' && entree instanceof Request ? entree.method : 'GET')
      const methode = methodeBrute.toUpperCase()
      if (methode !== 'GET' && methode !== 'HEAD') {
        const ou = typeof entree === 'string'
          ? entree
          : (typeof Request !== 'undefined' && entree instanceof Request ? entree.url : String(entree))
        console.warn('[démo] écriture bloquée : ' + methode + ' ' + ou + ' — cette page ne touche jamais à la base.')
        return new Response(JSON.stringify({ error: 'demo_lecture_seule' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
      return origine(entree, init)
    }
    return () => { window.fetch = origine }
  }, [])
}

/** Rendu client de `/demo` : le vrai châssis (`DashboardShell`) et le vrai `ClientsViewV2`,
 *  nourris du jeu de données fabriqué côté serveur (`jeuDeDonneesDemo()`, appelé une fois par
 *  `page.tsx` pour que les dates « cette semaine » restent cohérentes sur toute la page). */
export default function DemoDashboard({ donnees }: { donnees: Donnees }) {
  useVerrouEcriture()
  return (
    <DashboardShell
      washerName={donnees.nomLaveur}
      plan="pro"
      subscriptionStatus="active"
      grandfathered={false}
      createdAt="2026-03-01T00:00:00.000Z"
      slug="demo-eclat-mobile"
      betaRefonte
    >
      <SelecteurDemo />
      <ClientsViewV2
        bookings={donnees.bookings}
        documents={donnees.documents}
        reglages={donnees.reglages}
        reglagesMessages={donnees.reglagesMessages}
        entreprises={donnees.entreprises}
        nomLaveur={donnees.nomLaveur}
        automatismes={donnees.automatismes}
      />
    </DashboardShell>
  )
}
