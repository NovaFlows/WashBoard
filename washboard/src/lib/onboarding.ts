// Onboarding des nouveaux inscrits (`/onboarding`) : personnaliser le lien de
// réservation, puis « Comment as-tu connu WashBoard ? ».
//
// `washers.onboarding_complete_at` décide s'il faut le montrer. Les comptes
// antérieurs à sa mise en place ont été remplis à leur date de création : seul
// un compte créé depuis peut avoir NULL.

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'
import { migrationEnAttente } from './migrationEnAttente'

export const SOURCES_ACQUISITION = [
  { valeur: 'instagram', libelle: 'Instagram' },
  { valeur: 'tiktok', libelle: 'TikTok' },
  { valeur: 'google', libelle: 'Google' },
  { valeur: 'recommandation', libelle: 'Recommandation' },
  { valeur: 'autre', libelle: 'Autre' },
] as const

export type SourceAcquisition = (typeof SOURCES_ACQUISITION)[number]['valeur']

export function estSourceAcquisition(v: unknown): v is SourceAcquisition {
  return SOURCES_ACQUISITION.some(s => s.valeur === v)
}

export type Destination = '/onboarding' | '/dashboard'

/** Sans fiche, le tableau de bord sait quoi faire (session orpheline → déconnexion) :
 *  l'onboarding n'aurait rien à personnaliser. */
export function destinationSelonFiche(fiche: { onboarding_complete_at?: string | null } | null): Destination {
  if (!fiche) return '/dashboard'
  return fiche.onboarding_complete_at ? '/dashboard' : '/onboarding'
}

export type EtatOnboarding = { destination: Destination; slug: string | null; name: string | null }

/** Où envoyer un laveur qui vient de se connecter, son lien actuel et son nom
 *  (pour l'initiale du logo à l'étape correspondante, voir `Onboarding.tsx`).
 *
 *  Une lecture ratée mène au tableau de bord : l'onboarding n'ouvre aucun droit,
 *  et bloquer l'accès au compte pour une question marketing serait pire que de
 *  la sauter. L'erreur est tracée — avant l'exécution du SQL, la colonne manque
 *  et chaque connexion passe ici : averti, pas alerte. */
export async function etatOnboarding(db: SupabaseClient, userId: string): Promise<EtatOnboarding> {
  const { data, error } = await db
    .from('washers')
    .select('slug, name, onboarding_complete_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (migrationEnAttente(error)) logger.warn('onboarding.gate.migration_en_attente', { userId })
    else logger.error('onboarding.gate.read_failed', { userId }, error)
    return { destination: '/dashboard', slug: null, name: null }
  }
  return { destination: destinationSelonFiche(data), slug: data?.slug ?? null, name: data?.name ?? null }
}

// ── Questions sur l'activité (dernière page de l'onboarding) ─────────────────────────────
//
// Alexandre, 2026-10-13 : mieux connaître les laveurs (chiffre d'affaires, volume, panier
// moyen, ancienneté…), sur UNE seule page — il répond à tout puis valide, pas un écran par
// question. Toutes facultatives ; des fourchettes plutôt que des chiffres à taper : plus rapide
// au pouce, et une réponse approximative honnête vaut mieux qu'un champ laissé vide. Liste
// volontairement large : Alexandre retirera celles qui ne servent pas.
//
// Ajouter, retirer ou renommer une question se fait ICI seulement : la page, la vérification
// serveur et les tests lisent cette liste.

export type QuestionActivite = {
  cle: string
  question: string
  /** Plusieurs réponses possibles (sinon une seule). */
  multiple?: boolean
  choix: readonly { valeur: string; libelle: string }[]
}

const c = (valeur: string, libelle: string) => ({ valeur, libelle })

export const QUESTIONS_ACTIVITE: readonly QuestionActivite[] = [
  { cle: 'anciennete', question: 'Depuis combien de temps fais-tu ce métier ?', choix: [c('moins_1_an', 'Moins d’1 an'), c('1_3_ans', '1 à 3 ans'), c('3_5_ans', '3 à 5 ans'), c('plus_5_ans', 'Plus de 5 ans')] },
  { cle: 'equipe', question: 'Combien de laveurs êtes-vous, toi compris ?', choix: [c('1', 'Seul'), c('2', '2'), c('3_5', '3 à 5'), c('6_plus', '6 et plus')] },
  { cle: 'prestations_semaine', question: 'Combien de prestations par semaine ?', choix: [c('moins_5', 'Moins de 5'), c('5_15', '5 à 15'), c('15_30', '15 à 30'), c('plus_30', 'Plus de 30')] },
  { cle: 'ca_mois', question: 'Ton chiffre d’affaires par mois ?', choix: [c('moins_1000', 'Moins de 1 000 €'), c('1000_3000', '1 000 à 3 000 €'), c('3000_6000', '3 000 à 6 000 €'), c('plus_6000', 'Plus de 6 000 €'), c('ne_dit_pas', 'Je préfère ne pas dire')] },
  { cle: 'panier_moyen', question: 'Prix moyen d’une prestation ?', choix: [c('moins_40', 'Moins de 40 €'), c('40_80', '40 à 80 €'), c('80_150', '80 à 150 €'), c('plus_150', 'Plus de 150 €')] },
  { cle: 'clientele', question: 'Tes clients sont surtout…', choix: [c('particuliers', 'Des particuliers'), c('pros', 'Des pros'), c('les_deux', 'Les deux')] },
  { cle: 'prise_rdv', question: 'Aujourd’hui, tes rendez-vous arrivent par…', multiple: true, choix: [c('telephone', 'Téléphone'), c('messages', 'SMS / WhatsApp'), c('reseaux', 'Réseaux sociaux'), c('site', 'Site ou plateforme')] },
  { cle: 'statut', question: 'Ton statut ?', choix: [c('auto_entrepreneur', 'Auto-entrepreneur'), c('societe', 'Société'), c('pas_declare', 'Pas encore déclaré')] },
  { cle: 'temps_perdu', question: 'Ce qui te prend le plus de temps…', multiple: true, choix: [c('rendez_vous', 'Gérer les rendez-vous'), c('factures', 'Faire les factures'), c('relances', 'Relancer les clients'), c('prospection', 'Trouver des clients')] },
]

export type ProfilActivite = Record<string, string | string[]>

/** Ne garde que des réponses connues de `QUESTIONS_ACTIVITE` : clé existante, valeur dans
 *  ses choix, tableau (sans doublon) seulement pour une question à choix multiples. Tout le
 *  reste est ignoré sans erreur — une réponse hors liste ne doit ni bloquer l'onboarding ni
 *  finir en base. */
export function nettoyerProfilActivite(brut: unknown): ProfilActivite {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {}
  const entree = brut as Record<string, unknown>
  const sortie: ProfilActivite = {}
  for (const q of QUESTIONS_ACTIVITE) {
    const v = entree[q.cle]
    const permises = new Set(q.choix.map(x => x.valeur))
    if (q.multiple) {
      if (!Array.isArray(v)) continue
      const valeurs = [...new Set(v.filter((x): x is string => typeof x === 'string' && permises.has(x)))]
      if (valeurs.length) sortie[q.cle] = valeurs
    } else if (typeof v === 'string' && permises.has(v)) {
      sortie[q.cle] = v
    }
  }
  return sortie
}
