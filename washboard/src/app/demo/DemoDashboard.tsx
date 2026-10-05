'use client'

import { useEffect, useState } from 'react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsViewV2 from '@/components/dashboard/ClientsViewV2'
import Accueil from '@/components/dashboard/Accueil'
import CalendrierDashboardV2 from '@/components/dashboard/CalendrierDashboardV2'
import { DemarrageCard } from '@/components/dashboard/DemarrageCard'
import type { jeuDeDonneesDemo, jeuDeDonneesAgendaDemo, AccueilDemo } from '@/lib/demo/jeuDeDonnees'

type Donnees = ReturnType<typeof jeuDeDonneesDemo>
type AgendaDonnees = ReturnType<typeof jeuDeDonneesAgendaDemo>
type AccueilTroisEtats = { normal: AccueilDemo; premierJour: AccueilDemo; quota: AccueilDemo }

// Trois écrans sont branchés ici : « Clients » (passe pilote), « Aujourd'hui » (passe
// « bureau ») et « Agenda » (passe « bureau », agenda — celle qui ajoute cette branche, voir le
// rapport). Les trois sont les seuls réellement migrés en v2 dont les requêtes/actions se
// résument à des fonctions pures, ou à des appels réseau sans conséquence sur la vraie base.
//
// `ClientsViewV2` porte deux actions d'écriture (glisser pour « Supprimer » un client, « Ne
// plus relancer ») : elles restent câblées vers les vraies routes `/api/clients/[cle]`, parce
// que la consigne était de montrer le VRAI composant, pas une copie — le verrou d'écriture
// ci-dessous les bloque. L'écran « Aujourd'hui » n'a AUCUNE action d'écriture (c'est un écran de
// lecture : héros, journée, à confirmer, widgets) : rien à bloquer de plus pour lui.
//
// `CalendrierDashboardV2` (Agenda) porte, lui, PLUSIEURS actions d'écriture réelles (statut,
// reprogrammation, facture, congés, rendez-vous manuel) : toutes bloquées par le même verrou,
// comme pour Clients. La seule requête de LECTURE qu'il déclenche tout seul (`/api/trajet`,
// temps de route) ne coûte rien ici : cette route exige une session (`401` sans elle, voir
// `api/trajet/route.ts`) et `/demo` n'authentifie personne — l'appel échoue avant d'atteindre
// Google. Voir le commentaire de `jeuDeDonneesAgendaDemo()` pour le détail.
//
// « Aujourd'hui » passe par le VRAI point de branchement (`Accueil.tsx`), pas directement par
// `AccueilV2` : c'est ce qui permet à ce même écran de PROUVER, sur cette même page, que le site
// étroit (téléphone, pas de PWA installée) reste en v1 — réduis la fenêtre sous 880px et la
// carte « V1Placeholder » ci-dessous apparaît à la place du héros, exactement ce que ferait le
// vrai `/dashboard` (voir le rapport de la passe). `v1` reçoit un simple repère visuel plutôt que
// l'arbre complet du site (BookingList, widgets serveur…) : le reproduire ici déplacerait ce
// travail dans le navigateur, l'exact contraire de ce que `Accueil.tsx` existe pour éviter.
// « Agenda », lui, est branché directement sur `CalendrierDashboardV2` (pas sur
// `CalendrierDashboard.tsx`, le point de branchement v1/v2) : cette page sert à juger la
// présentation v2, pas à redémontrer le branchement v1/v2 déjà prouvé par « Aujourd'hui » —
// `CalendrierDashboardV2` lit lui-même `useGrandEcran()` en interne, donc réduire la fenêtre
// sous 1024px y montre aussi, à l'intérieur de l'écran, sa disposition à une seule colonne.

type Ecran = 'clients' | 'aujourdhui' | 'agenda'
type EtatAujourdhui = 'normal' | 'premierJour' | 'quota'

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`

function PilulePilote({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-[var(--v2-radius-pilule)] px-3 py-1.5 text-[12.5px] ${corpsFort} transition-colors`}
      style={actif
        ? { background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }
        : { background: 'transparent', color: 'var(--v2-color-gris)', border: '1px solid var(--v2-filet-fort)' }}
    >
      {children}
    </button>
  )
}

function SelecteurDemo({
  ecran, onEcran, etat, onEtat,
}: {
  ecran: Ecran
  onEcran: (e: Ecran) => void
  etat: EtatAujourdhui
  onEtat: (e: EtatAujourdhui) => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`rounded-full px-3 py-1 text-[11px] ${corpsFort}`} style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }}>
          Démo
        </span>
        <div className="flex gap-1.5">
          <PilulePilote actif={ecran === 'aujourdhui'} onClick={() => onEcran('aujourdhui')}>Aujourd’hui</PilulePilote>
          <PilulePilote actif={ecran === 'clients'} onClick={() => onEcran('clients')}>Clients</PilulePilote>
          <PilulePilote actif={ecran === 'agenda'} onClick={() => onEcran('agenda')}>Agenda</PilulePilote>
        </div>
        <span className={`text-[12px] ${corps}`} style={{ color: 'var(--v2-color-gris)' }}>
          Jeu de données fabriqué en mémoire — rien n’est lu ni écrit dans la base.
        </span>
      </div>

      {/* Les trois états de la maquette (écrans 1, 45, 46) — Alexandre veut juger les quatre
          (le 4e, la fiche verrouillée, s'ouvre en cliquant une ligne floutée de l'état « Quota
          atteint »). */}
      {ecran === 'aujourdhui' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11.5px] ${corps}`} style={{ color: 'var(--v2-color-gris)' }}>État :</span>
          <PilulePilote actif={etat === 'normal'} onClick={() => onEtat('normal')}>Journée normale</PilulePilote>
          <PilulePilote actif={etat === 'premierJour'} onClick={() => onEtat('premierJour')}>Premier jour</PilulePilote>
          <PilulePilote actif={etat === 'quota'} onClick={() => onEtat('quota')}>Quota atteint</PilulePilote>
        </div>
      )}
    </div>
  )
}

/** Ce que `v1` montre ici — un repère, pas l'accueil v1 réel. Volontairement SANS jeton `--v2-*`
 *  (bordure et fond en dur) : un simple rectangle qui tranche visuellement avec le reste de la
 *  page, pour qu'une capture à 390px dise d'un coup d'œil « ceci est la branche v1 », sans
 *  confusion possible avec un écran v2 qui aurait mal dégradé. */
function V1Placeholder() {
  return (
    <div style={{ border: '1px dashed #94a3b8', borderRadius: 12, padding: 16, color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
      Accueil v1 (site, pas de PWA installée, écran trop étroit pour le châssis bureau) — rendu
      réel par <code>dashboard/page.tsx</code> (carte de démarrage, widgets, <code>BookingList</code>…),
      pas reproduit dans cette démo pour ne pas déplacer ce travail côté navigateur. Preuve que
      le point de branchement (<code>Accueil.tsx</code>) choisit bien cette branche sous 880px /
      sans pointeur fin, exactement comme sur le vrai tableau de bord.
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

/** Rendu client de `/demo` : le vrai châssis (`DashboardShell`) et les vrais écrans
 *  (`ClientsViewV2`, `Accueil`/`AccueilV2`), nourris des jeux de données fabriqués côté serveur
 *  (`jeuDeDonneesDemo()`/`jeuDeDonneesAccueilDemo()`, appelés une fois par `page.tsx` pour que
 *  les dates relatives (« cette semaine », « demain ») restent cohérentes sur toute la page). */
export default function DemoDashboard({ donnees, accueil, agenda }: { donnees: Donnees; accueil: AccueilTroisEtats; agenda: AgendaDonnees }) {
  useVerrouEcriture()
  const [ecran, setEcran] = useState<Ecran>('aujourdhui')
  const [etat, setEtat] = useState<EtatAujourdhui>('normal')
  const donneesAccueil = accueil[etat]

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
      <SelecteurDemo ecran={ecran} onEcran={setEcran} etat={etat} onEtat={setEtat} />
      {ecran === 'aujourdhui' ? (
        <Accueil
          v1={<V1Placeholder />}
          betaRefonte
          demarrage={<DemarrageCard progress={donneesAccueil.progress} />}
          rdvAujourdhui={donneesAccueil.rdvAujourdhui}
          rdvProchains={donneesAccueil.rdvProchains}
          aConfirmer={donneesAccueil.aConfirmer}
          verrouillees={donneesAccueil.verrouillees}
          journeeCommencee={donneesAccueil.journeeCommencee}
          dateDuJour={donneesAccueil.dateDuJour}
          widgets={donneesAccueil.widgets}
          stats={donneesAccueil.stats}
          clients={donneesAccueil.clients}
          trafic={donneesAccueil.trafic}
          prestationTop={donneesAccueil.prestationTop}
          zone={donneesAccueil.zone}
          jauge={donneesAccueil.jauge}
          offreDeblocage={donneesAccueil.offreDeblocage}
          semaine={donneesAccueil.semaine}
          rdvDemain={donneesAccueil.rdvDemain}
          demainStr={donneesAccueil.demainStr}
          configurationIncomplete={donneesAccueil.configurationIncomplete}
        />
      ) : ecran === 'agenda' ? (
        <CalendrierDashboardV2
          bookings={agenda.bookings}
          unavailabilities={agenda.unavailabilities}
          teamSize={agenda.teamSize}
          services={agenda.services}
          categories={agenda.categories}
          washerId={agenda.washerId}
          facturationPrete={agenda.facturationPrete}
          googleAgendaConnecte={agenda.googleAgendaConnecte}
          joursMasques={agenda.joursMasques}
          masquees={agenda.masquees}
          offreDeblocage={agenda.offreDeblocage}
        />
      ) : (
        <ClientsViewV2
          bookings={donnees.bookings}
          documents={donnees.documents}
          reglages={donnees.reglages}
          reglagesMessages={donnees.reglagesMessages}
          entreprises={donnees.entreprises}
          nomLaveur={donnees.nomLaveur}
          automatismes={donnees.automatismes}
        />
      )}
    </DashboardShell>
  )
}
