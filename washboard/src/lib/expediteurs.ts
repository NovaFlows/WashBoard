// Noms d'expéditeur SMS déjà approuvés chez Brevo : ils passent directement en « approuvé ».
// Tout autre nom attend la validation de l'équipe (section Expéditeurs SMS du support).
// À tenir à jour avec le compte Brevo.
export const EXPEDITEURS_APPROUVES: readonly string[] = ['AutoNett']

export function estExpediteurApprouve(nom: string): boolean {
  return EXPEDITEURS_APPROUVES.includes(nom.trim())
}
