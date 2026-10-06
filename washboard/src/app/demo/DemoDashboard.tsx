'use client'

import { useEffect, useState } from 'react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsViewV2 from '@/components/dashboard/ClientsViewV2'
import Accueil from '@/components/dashboard/Accueil'
import CalendrierDashboardV2 from '@/components/dashboard/CalendrierDashboardV2'
import MessagesAutomatiquesV2 from '@/components/dashboard/MessagesAutomatiquesV2'
import PublicitesV2 from '@/components/dashboard/PublicitesV2'
import BilanPublicitesV2 from '@/components/dashboard/BilanPublicitesV2'
import ChiffresV2 from '@/components/dashboard/ChiffresV2'
import DepensesV2 from '@/components/dashboard/DepensesV2'
import { DemarrageCard } from '@/components/dashboard/DemarrageCard'
import ParametresFormV2 from '@/components/dashboard/ParametresFormV2'
import ApparenceV2 from '@/components/dashboard/ApparenceV2'
import PrestationsV2 from '@/components/dashboard/PrestationsV2'
import HorairesV2 from '@/components/dashboard/HorairesV2'
import ProfilV2 from '@/components/dashboard/ProfilV2'
import MesLiensV2 from '@/components/dashboard/MesLiensV2'
import type { Depense, DepenseRecurrente } from '@/lib/depenses'
import type {
  jeuDeDonneesDemo, jeuDeDonneesAgendaDemo, jeuDeDonneesMessagesDemo, jeuDeDonneesPublicitesDemo,
  jeuDeDonneesChiffresDemo, jeuDeDonneesDepensesDemo, jeuDeDonneesPlusDemo, AccueilDemo,
} from '@/lib/demo/jeuDeDonnees'

type Donnees = ReturnType<typeof jeuDeDonneesDemo>
type AgendaDonnees = ReturnType<typeof jeuDeDonneesAgendaDemo>
type MessagesDonnees = ReturnType<typeof jeuDeDonneesMessagesDemo>
type PublicitesDonnees = ReturnType<typeof jeuDeDonneesPublicitesDemo>
type ChiffresDonnees = ReturnType<typeof jeuDeDonneesChiffresDemo>
type DepensesDonnees = ReturnType<typeof jeuDeDonneesDepensesDemo>
type PlusDonnees = ReturnType<typeof jeuDeDonneesPlusDemo>
type AccueilTroisEtats = { normal: AccueilDemo; premierJour: AccueilDemo; quota: AccueilDemo }

// Huit écrans sont branchés ici : « Clients » (passe pilote), « Aujourd'hui » (passe
// « bureau »), « Agenda » (passe « bureau », agenda), trois écrans de la passe « bureau,
// Clients — suite » (2026-10-06) — « Messages automatiques » (écrans 31/32 — le réglage d'un
// automatisme s'ouvre EN CLIQUANT une ligne, pas par un onglet séparé, exactement comme sur le
// vrai écran), « Publicités » (écran 33) et son « Bilan » (écran 34, tab séparée plutôt que le
// lien de l'écran Publicités : ce lien navigue vers une vraie route `/dashboard/...` qui
// exigerait une session, ce que `/demo` ne fournit jamais) — et deux écrans de la passe
// « Chiffres bureau » (2026-10-06) : « Chiffres » (ses trois onglets, écrans 7/8/40) et
// « Dépenses » (écran 41, avec ses deux feuilles d'ajout, écrans 42/47, déjà centrées en modale
// par `Feuille`/FeuilleV2.tsx au-delà de 640px — rien à coder en plus pour elles ici). Tous sont
// les seuls réellement migrés en v2 dont les requêtes/actions se résument à des fonctions
// pures, ou à des appels réseau sans conséquence sur la vraie base.
//
// « Chiffres » et « Dépenses » sont branchés directement sur `ChiffresV2`/`DepensesV2` (pas sur
// `Chiffres.tsx`/`Depenses.tsx`, les garde-fous v1/v2) : même raison que pour « Agenda », cette
// page sert à juger la présentation, pas à redémontrer un branchement déjà prouvé par
// « Aujourd'hui ». `DepensesV2` (et la section « Dépenses » de l'onglet Argent) lisent
// eux-mêmes `/api/expenses`/`/api/expenses/recurring` au montage — contrairement aux autres
// écrans de cette page, leur état n'est pas reçu en props. Ces routes exigent une session que
// `/demo` ne fournit jamais (401) : sans rien de plus, l'onglet Argent entier ET l'écran
// Dépenses afficheraient une erreur de chargement (constaté en écrivant cette passe — l'erreur
// de la section « Dépenses » remonte jusqu'au bloc héros de l'onglet Argent, voir
// ChiffresArgent.tsx). `useDonneesDepensesDemo`, plus bas, dévie donc CES DEUX LECTURES SEULES
// vers `jeuDeDonneesDepensesDemo()` — jamais une écriture, `useVerrouEcriture` les bloque déjà
// toutes. Différent de `/api/trajet` pour l'Agenda (voir plus bas), laissé en échec assumé : là,
// une seule ligne secondaire (le temps de route) en dépend, pas l'écran entier.
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

// Passe « Plus bureau » (2026-10-06) : six écrans de plus, derrière un sous-sélecteur (même
// geste que les trois états d'« Aujourd'hui ») — la liste elle-même (`ParametresFormV2`, état
// de repos) et les cinq réglages qu'elle ouvre. Branchés directement sur les composants V2
// (pas sur `ParametresForm.tsx`/`Apparence.tsx`/etc., les garde-fous v1/v2/bureau) : même
// raison que pour Agenda et Chiffres plus haut — cette page juge la présentation, le
// branchement v1/v2/bureau est déjà prouvé par « Aujourd'hui ». Chacun reçoit sa propre
// prop `liste` (sauf « Mon profil », qui la dérive de la fiche laveur complète qu'il reçoit
// déjà — voir ProfilV2.tsx) : réduire la fenêtre sous 1024px y montre, à l'intérieur de
// l'écran, sa disposition à une seule colonne (`useGrandEcran()`, lu par chacun en interne).
type Ecran = 'clients' | 'aujourdhui' | 'agenda' | 'messages' | 'publicites' | 'bilan' | 'chiffres' | 'depenses' | 'plus'
type EtatAujourdhui = 'normal' | 'premierJour' | 'quota'
type EcranPlus = 'liste' | 'profil' | 'liens' | 'prestations' | 'horaires' | 'apparence'

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
  ecran, onEcran, etat, onEtat, ecranPlus, onEcranPlus,
}: {
  ecran: Ecran
  onEcran: (e: Ecran) => void
  etat: EtatAujourdhui
  onEtat: (e: EtatAujourdhui) => void
  ecranPlus: EcranPlus
  onEcranPlus: (e: EcranPlus) => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`rounded-full px-3 py-1 text-[11px] ${corpsFort}`} style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }}>
          Démo
        </span>
        {/* `flex-wrap` : neuf pilules ne tiennent plus sur une ligne à 390px — sans lui, la
            ligne déborde et fait défiler toute la page horizontalement. */}
        <div className="flex flex-wrap gap-1.5">
          <PilulePilote actif={ecran === 'aujourdhui'} onClick={() => onEcran('aujourdhui')}>Aujourd’hui</PilulePilote>
          <PilulePilote actif={ecran === 'clients'} onClick={() => onEcran('clients')}>Clients</PilulePilote>
          <PilulePilote actif={ecran === 'agenda'} onClick={() => onEcran('agenda')}>Agenda</PilulePilote>
          <PilulePilote actif={ecran === 'messages'} onClick={() => onEcran('messages')}>Messages automatiques</PilulePilote>
          <PilulePilote actif={ecran === 'publicites'} onClick={() => onEcran('publicites')}>Publicités</PilulePilote>
          <PilulePilote actif={ecran === 'bilan'} onClick={() => onEcran('bilan')}>Bilan publicités</PilulePilote>
          <PilulePilote actif={ecran === 'chiffres'} onClick={() => onEcran('chiffres')}>Chiffres</PilulePilote>
          <PilulePilote actif={ecran === 'depenses'} onClick={() => onEcran('depenses')}>Dépenses</PilulePilote>
          <PilulePilote actif={ecran === 'plus'} onClick={() => onEcran('plus')}>Plus</PilulePilote>
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

      {/* « Plus » : la liste (écran de repos, écran 60) et les cinq réglages qu'elle ouvre. */}
      {ecran === 'plus' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11.5px] ${corps}`} style={{ color: 'var(--v2-color-gris)' }}>Écran :</span>
          <PilulePilote actif={ecranPlus === 'liste'} onClick={() => onEcranPlus('liste')}>Liste (repos)</PilulePilote>
          <PilulePilote actif={ecranPlus === 'profil'} onClick={() => onEcranPlus('profil')}>Mon profil</PilulePilote>
          <PilulePilote actif={ecranPlus === 'liens'} onClick={() => onEcranPlus('liens')}>Mes liens</PilulePilote>
          <PilulePilote actif={ecranPlus === 'prestations'} onClick={() => onEcranPlus('prestations')}>Prestations et prix</PilulePilote>
          <PilulePilote actif={ecranPlus === 'horaires'} onClick={() => onEcranPlus('horaires')}>Horaires</PilulePilote>
          <PilulePilote actif={ecranPlus === 'apparence'} onClick={() => onEcranPlus('apparence')}>Apparence de ma page</PilulePilote>
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

/** `DepensesV2` (et la section « Dépenses » de `ChiffresArgent`) ne reçoivent pas leurs frais
 *  en props, contrairement au reste de cette page : ils lisent eux-mêmes `/api/expenses` et
 *  `/api/expenses/recurring` au montage. Ces routes exigent une session, que `/demo` ne fournit
 *  jamais (401) — sans ce deuxième filtre, les deux écrans n'afficheraient qu'une erreur de
 *  chargement. Il s'empile sur `useVerrouEcriture` (qui bloque déjà toute écriture) : seules les
 *  deux lectures GET ci-dessous sont déviées vers `jeuDeDonneesDepensesDemo()` ; tout le reste
 *  continue vers le réseau comme avant. */
function useDonneesDepensesDemo(depenses: Depense[], recurrents: DepenseRecurrente[]) {
  useEffect(() => {
    const origine = window.fetch
    window.fetch = async (entree, init) => {
      const url = typeof entree === 'string'
        ? entree
        : (typeof Request !== 'undefined' && entree instanceof Request ? entree.url : String(entree))
      const methode = (init?.method
        ?? (typeof Request !== 'undefined' && entree instanceof Request ? entree.method : 'GET')).toUpperCase()
      const chemin = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url

      if (methode === 'GET' && chemin.startsWith('/api/expenses/recurring')) {
        return new Response(JSON.stringify({ recurring: recurrents }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (methode === 'GET' && chemin.startsWith('/api/expenses')) {
        const params = new URL(url, 'http://localhost').searchParams
        const start = params.get('start') ?? ''
        const end = params.get('end') ?? ''
        const dansLaPeriode = depenses.filter(d => (!start || d.date >= start) && (!end || d.date <= end))
        return new Response(JSON.stringify({ expenses: dansLaPeriode }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return origine(entree, init)
    }
    return () => { window.fetch = origine }
  }, [depenses, recurrents])
}

/** Rendu client de `/demo` : le vrai châssis (`DashboardShell`) et les vrais écrans
 *  (`ClientsViewV2`, `Accueil`/`AccueilV2`), nourris des jeux de données fabriqués côté serveur
 *  (`jeuDeDonneesDemo()`/`jeuDeDonneesAccueilDemo()`, appelés une fois par `page.tsx` pour que
 *  les dates relatives (« cette semaine », « demain ») restent cohérentes sur toute la page). */
export default function DemoDashboard({ donnees, accueil, agenda, messages, publicites, chiffres, depenses, plus }: {
  donnees: Donnees
  accueil: AccueilTroisEtats
  agenda: AgendaDonnees
  messages: MessagesDonnees
  publicites: PublicitesDonnees
  chiffres: ChiffresDonnees
  depenses: DepensesDonnees
  plus: PlusDonnees
}) {
  useVerrouEcriture()
  useDonneesDepensesDemo(depenses.depenses, depenses.recurrents)
  const [ecran, setEcran] = useState<Ecran>('aujourdhui')
  const [etat, setEtat] = useState<EtatAujourdhui>('normal')
  const [ecranPlus, setEcranPlus] = useState<EcranPlus>('liste')
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
      <SelecteurDemo ecran={ecran} onEcran={setEcran} etat={etat} onEtat={setEtat} ecranPlus={ecranPlus} onEcranPlus={setEcranPlus} />
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
      ) : ecran === 'messages' ? (
        <MessagesAutomatiquesV2 {...messages} />
      ) : ecran === 'publicites' ? (
        <PublicitesV2 campagnes={publicites.campagnes} baseUrl="https://app.washboard.fr/book/demo-eclat-mobile" />
      ) : ecran === 'bilan' ? (
        <BilanPublicitesV2 campagnes={publicites.campagnes} />
      ) : ecran === 'chiffres' ? (
        <ChiffresV2
          bookings={donnees.bookings}
          facturesManuelles={chiffres.facturesManuelles}
          events={chiffres.events}
          websiteHost={chiffres.websiteHost}
          hasCrm={chiffres.hasCrm}
          hasCa={chiffres.hasCa}
          hasCompta={chiffres.hasCompta}
          facturesCount={chiffres.facturesCount}
          facturesImpayees={chiffres.facturesImpayees}
          evenementsDepuis={chiffres.evenementsDepuis}
        />
      ) : ecran === 'depenses' ? (
        <DepensesV2 />
      ) : ecran === 'plus' ? (
        ecranPlus === 'liste' ? (
          <ParametresFormV2
            washer={plus.profil.washer}
            servicesCount={plus.prestations.services.length}
            resumeHoraires="Lun.–ven. 8h–18h · sam. 9h–13h"
          />
        ) : ecranPlus === 'profil' ? (
          <ProfilV2 washer={plus.profil.washer} email={plus.profil.email} peutEquipe={plus.profil.peutEquipe} />
        ) : ecranPlus === 'liens' ? (
          <MesLiensV2 slug={plus.slug} liste={plus.listeBase} />
        ) : ecranPlus === 'prestations' ? (
          <PrestationsV2
            services={plus.prestations.services}
            categories={plus.prestations.categories}
            availabilities={plus.prestations.availabilities}
            lectureIncomplete={false}
            zone={plus.prestations.zone}
            adresseDeBase={plus.prestations.adresseDeBase}
            plafond={plus.prestations.plafond}
            offre={plus.prestations.offre}
            liste={plus.listeBase}
          />
        ) : ecranPlus === 'horaires' ? (
          <HorairesV2
            availabilities={plus.horaires.availabilities}
            unavailabilities={plus.horaires.unavailabilities}
            teamSize={plus.horaires.teamSize}
            jourMemeAutorise={plus.horaires.jourMemeAutorise}
            adresseDepart={plus.horaires.adresseDepart}
            lectureIncomplete={false}
            liste={plus.listeBase}
          />
        ) : (
          <ApparenceV2 nom={plus.listeBase.nom} slug={plus.slug} initial={plus.apparence} liste={plus.listeBase} />
        )
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
