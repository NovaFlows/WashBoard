// Nom de ville court à partir d'une adresse — pour l'agenda v2, qui affiche
// « Pessac » sous le nom du client (planche `project/Agenda.dc.html`).
//
// L'adresse est un champ libre : rien ne garantit qu'elle soit découpée en
// rue / ville / pays (voir `StepContact.tsx` du tunnel de réservation, et le
// commentaire de `ClientProfileModalV2.tsx`, qui avait écarté l'idée pour
// cette raison). Demande d'Alexandre du 2026-09-24 : l'afficher quand même.
//
// La règle ci-dessous ne DEVINE pas : elle ne lit la ville que dans le format
// produit par la suggestion d'adresse Google (« 52 Rue d'Enghien, 95600
// Eaubonne, France »), et renvoie `null` au moindre doute — mieux vaut pas de
// ville qu'une fausse. Une adresse tapée à la main d'un seul tenant n'en
// donnera donc aucune.

const PAYS = new Set(['france', 'belgique', 'suisse', 'luxembourg', 'monaco'])

/** Code postal en tête de segment : « 95600 Eaubonne » → « Eaubonne ». */
const CODE_POSTAL = /^\d[\d\s]{2,}\s*/

export function villeDepuisAdresse(adresse: string | null | undefined): string | null {
  const parts = (adresse ?? '').split(',').map(p => p.trim()).filter(Boolean)
  // Un seul segment : impossible de distinguer une rue d'une ville.
  if (parts.length < 2) return null

  if (PAYS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop()
    if (parts.length < 2) return null
  }

  const ville = parts[parts.length - 1].replace(CODE_POSTAL, '').trim()
  // Un chiffre restant trahit un numéro de rue ou un code postal isolé : c'est
  // que le découpage n'est pas celui attendu.
  if (!ville || /\d/.test(ville)) return null
  // Une ville commence par une majuscule. Sans ce contrôle, une adresse libre
  // à deux segments (« chez le client, derrière l'église ») passait pour une
  // ville — c'est exactement le genre d'invention à éviter ici.
  if (ville[0] === ville[0].toLowerCase()) return null
  return ville
}
