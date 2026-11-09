import { CLE_PRECISION_SOURCE, QUESTIONS_ACTIVITE, SOURCES_ACQUISITION } from '@/lib/onboarding'
import { dateCourte } from '@/lib/ficheLaveur'

// Section « Onboarding » de la fiche laveur (2026-11-09). Demande d'Alexandre : « sur chaque
// fiche on a tout l'onboarding, et pour ceux inscrits avant sa mise en place, l'écrire dans la
// section ». Calcul pur : l'écran ne fait que l'afficher.
//
// Ce que l'onboarding garde en base : la date de fin (`onboarding_complete_at`), « comment as-tu
// connu WashBoard » (`acquisition_source`, + précision d'« Autre » rangée dans le profil) et les
// réponses sur l'activité (`profil_activite`, depuis le 2026-10-13). Les comptes antérieurs à
// l'onboarding ont été marqués « terminé » à leur date de création, sans aucune réponse.

export type ReponseOnboarding = { question: string; reponse: string | null }

export type Onboarding = {
  /** `avant` : compte créé avant l'onboarding ; `en_cours` : jamais terminé ; `termine` : fini (avec ou sans réponses). */
  etat: 'termine' | 'avant' | 'en_cours'
  /** Une ligne qui dit où il en est. */
  resume: string
  /** Précision utile à Alexandre (compte ancien, réponses absentes…), ou null. */
  note: string | null
  reponses: ReponseOnboarding[]
}

type Entree = {
  created_at: string
  onboarding_complete_at: string | null
  acquisition_source: string | null
  profil_activite: Record<string, unknown> | null
}

/** Un compte « terminé » moins d'une minute après sa création et sans réponse n'a pas fait l'onboarding : il a été marqué à la mise en place. */
const DELAI_MARQUAGE_MS = 60_000

/** « 4 min », « 2 h », « 3 j » : le temps entre l'inscription et la fin de l'onboarding. */
export function dureeCourte(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'moins d’une minute'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} j`
}

function texteReponse(valeur: unknown, choix: readonly { valeur: string; libelle: string }[]): string | null {
  const lire = (v: unknown) => (typeof v === 'string' ? choix.find(c => c.valeur === v)?.libelle ?? v : null)
  if (Array.isArray(valeur)) {
    const l = valeur.map(lire).filter((x): x is string => !!x)
    return l.length ? l.join(', ') : null
  }
  return lire(valeur)
}

export function resumerOnboarding(w: Entree): Onboarding {
  const profil = w.profil_activite ?? {}
  const brute = w.acquisition_source
  const precision = typeof profil[CLE_PRECISION_SOURCE] === 'string' ? (profil[CLE_PRECISION_SOURCE] as string) : null
  const source = !brute ? null
    : brute === 'autre' && precision ? `Autre : ${precision}`
    : SOURCES_ACQUISITION.find(s => s.valeur === brute)?.libelle ?? brute

  const reponses: ReponseOnboarding[] = [
    { question: 'Comment as-tu connu WashBoard ?', reponse: source },
    ...QUESTIONS_ACTIVITE.map(q => ({ question: q.question, reponse: texteReponse(profil[q.cle], q.choix) })),
  ]
  const nbReponses = reponses.filter(r => r.reponse).length

  if (!w.onboarding_complete_at) {
    return {
      etat: 'en_cours',
      resume: 'Onboarding pas terminé',
      note: nbReponses ? null : 'Il n’a pas fini de personnaliser son lien et de répondre aux questions : aucune réponse pour l’instant.',
      reponses,
    }
  }

  const delai = Date.parse(w.onboarding_complete_at) - Date.parse(w.created_at)
  if (nbReponses === 0 && delai <= DELAI_MARQUAGE_MS) {
    return {
      etat: 'avant',
      resume: 'Inscrit avant la mise en place de l’onboarding',
      note: `Compte créé le ${dateCourte(w.created_at)}, avant l’onboarding : il ne l’a jamais vu, donc aucune réponse.`,
      reponses,
    }
  }

  const resume = `Terminé le ${dateCourte(w.onboarding_complete_at)}${delai > 0 ? `, ${dureeCourte(delai)} après l’inscription` : ''}`
  const note = nbReponses === 0
    ? 'Aucune réponse enregistrée : il a passé les questions, ou son compte date d’avant elles.'
    : !w.profil_activite || Object.keys(profil).filter(k => k !== CLE_PRECISION_SOURCE).length === 0
      ? 'Les questions sur l’activité n’existaient pas encore, ou il ne les a pas remplies.'
      : null
  return { etat: 'termine', resume, note, reponses }
}
