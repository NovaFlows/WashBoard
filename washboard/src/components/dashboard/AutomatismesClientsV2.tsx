'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CarteListe, TitreSection } from '@/components/dashboard/ParametresFormV2'
import { LigneDeuxNiveaux } from '@/components/dashboard/PrestationsUiV2'
import FeuilleCreneauxV2 from '@/components/dashboard/FeuilleCreneauxV2'
import { useOffre } from '@/components/dashboard/OffreContext'
import { requiredPlanLabel } from '@/lib/plan'
import {
  avisActif, blocageAvis, relanceActive, libelleCanal, libelleDelaiAvis, libelleDelaiRelance,
  type ReglagesMessages,
} from '@/lib/messagesAutomatiques'
import {
  prestationExemple, prixLePlusBas, resumeCreneaux,
  type ChampsCreneaux, type PrestationExemple, type ReglagesCreneaux,
} from '@/lib/creneauxForm'
import { enregistrerZoneCreneaux } from '@/lib/zoneApi'

// Section « Automatismes » de l'écran Clients — Alexandre, 2026-09-30 : la demande d'avis Google,
// la relance client et les créneaux intelligents quittent « Plus » et « Prestations et prix »
// pour se ranger avec les clients, ceux qu'ils servent.
//
// Trois lignes, mêmes phrases de résumé qu'avant (les fonctions de `lib/messagesAutomatiques` et
// `lib/creneauxForm`, aucun calcul dupliqué) :
//  · avis et relance mènent à l'écran « Messages automatiques » (`/dashboard/clients/messages`) :
//    c'est là que vivent leurs interrupteurs, leurs réglages et les listes « Programmé » / « Parti » ;
//  · les créneaux intelligents s'ouvrent en feuille, ici même — ils n'ont pas d'écran propre.
// Une offre qui n'inclut pas la fonction : la ligne le dit et mène à l'abonnement (avis, relance) ;
// la feuille des créneaux porte elle-même son verrou.

export type AutomatismesClients = {
  messages: ReglagesMessages
  smsAutorise: boolean
  avisAutorise: boolean
  relanceAutorisee: boolean
  libellePlanAvis: string
  libellePlanRelance: string
  creneaux: ReglagesCreneaux
  prestationsPrix: PrestationExemple[]
}

export default function AutomatismesClientsV2({ automatismes }: { automatismes: AutomatismesClients }) {
  const router = useRouter()
  const { peut } = useOffre()
  const {
    messages, smsAutorise, avisAutorise, relanceAutorisee, libellePlanAvis, libellePlanRelance, prestationsPrix,
  } = automatismes
  const [creneaux, setCreneaux] = useState(automatismes.creneaux)
  // Lien de l'accueil (`/dashboard/clients#creneaux`) : on ouvre directement la feuille.
  const [feuille, setFeuille] = useState(() => typeof window !== 'undefined' && window.location.hash === '#creneaux')

  const ctx = { smsAutorise }
  const avisDisponible = avisAutorise || messages.review_enabled
  const relanceDisponible = relanceAutorisee || messages.followup_enabled

  const blocage = messages.review_enabled ? blocageAvis(messages, ctx) : null
  const avis = !avisDisponible
    ? { texte: `Inclus dans l’offre ${libellePlanAvis}` }
    : avisActif(messages, ctx)
      ? { texte: `${libelleDelaiAvis(messages.review_delay_hours)} · ${libelleCanal(messages.review_channel)}` }
      : blocage === 'lien'
        ? { texte: 'Rien ne part : ajoutez votre lien d’avis Google', ton: 'ambre' as const }
        : blocage === 'sms'
          ? { texte: 'Rien ne part : le SMS est réservé au plan Pro', ton: 'ambre' as const }
          : { texte: 'Désactivée. Un avis après chaque lavage, sans y penser.' }

  const relance = !relanceDisponible
    ? { texte: `Inclus dans l’offre ${libellePlanRelance}` }
    : relanceActive(messages)
      ? { texte: `${libelleDelaiRelance(messages.followup_delay_days)} · ${libelleCanal(messages.review_channel)}` }
      : messages.followup_enabled
        ? { texte: 'Rien ne part : écrivez le message à envoyer', ton: 'ambre' as const }
        : { texte: 'Désactivée. Un message aux clients qui ne sont pas revenus.' }

  async function enregistrerCreneaux(champs: ChampsCreneaux): Promise<string | null> {
    const r = await enregistrerZoneCreneaux(champs)
    if (!r.ok) return r.message
    setCreneaux(prev => ({
      actif: champs.smart_slot_enabled,
      // Éteindre n'envoie que l'interrupteur : le reste garde sa valeur.
      proximite: champs.smart_slot_radius_minutes ?? prev.proximite,
      type: champs.smart_slot_discount_type ?? prev.type,
      valeur: champs.smart_slot_discount_value ?? prev.valeur,
    }))
    setFeuille(false)
    router.refresh()
    return null
  }

  return (
    <section aria-label="Automatismes">
      <TitreSection>Automatismes</TitreSection>
      <CarteListe>
        <ul className="divide-y divide-[color:var(--v2-filet)]">
          <LigneDeuxNiveaux
            label="Avis Google"
            valeur={avis.texte}
            ton={'ton' in avis ? avis.ton : undefined}
            onClick={() => router.push(avisDisponible ? '/dashboard/clients/messages' : '/dashboard/abonnement')}
          />
          <LigneDeuxNiveaux
            label="Relance client"
            valeur={relance.texte}
            ton={'ton' in relance ? relance.ton : undefined}
            onClick={() => router.push(relanceDisponible ? '/dashboard/clients/messages' : '/dashboard/abonnement')}
          />
          <LigneDeuxNiveaux
            label="Créneaux intelligents"
            valeur={peut('creneaux_intelligents')
              ? resumeCreneaux(creneaux)
              : `Inclus dans l’offre ${requiredPlanLabel('creneaux_intelligents')}`}
            onClick={() => setFeuille(true)}
          />
        </ul>
      </CarteListe>

      {feuille && (
        <FeuilleCreneauxV2
          reglages={creneaux}
          prestation={prestationExemple(prestationsPrix)}
          prixLePlusBas={prixLePlusBas(prestationsPrix)}
          onEnregistrer={enregistrerCreneaux}
          onClose={() => setFeuille(false)}
        />
      )}
    </section>
  )
}
