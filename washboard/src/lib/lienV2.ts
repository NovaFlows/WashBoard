// Où mène, dans l'application refaite, un lien écrit pour le site.
//
// Le guide est écrit une fois, en texte, avec ses liens en ligne — « vos prestations dans
// [Réglages de la page](/dashboard/admin) ». Ces adresses sont celles des anciens écrans :
// suivies depuis la PWA, elles en font sortir (Alexandre, 2026-09-27, à propos des raccourcis
// de configuration — même défaut, même correction).
//
// Le contenu n'est pas dupliqué pour autant : une seule table de correspondance, appliquée à
// l'affichage. Un lien inconnu passe tel quel — mieux vaut un lien qui marche à l'ancienne
// qu'un lien mort.

const CORRESPONDANCES: Record<string, string> = {
  // L'ancien « Réglages de la page » (prestations, disponibilités, zone, créneaux, identité)
  // a éclaté en plusieurs écrans. Sans ancre, on vise le plus demandé : les prestations.
  '/dashboard/admin': '/dashboard/parametres/prestations?vue=prestations',
  '/dashboard/admin#prestations': '/dashboard/parametres/prestations?vue=prestations',
  '/dashboard/admin#disponibilites': '/dashboard/parametres/horaires',
  '/dashboard/admin#zone': '/dashboard/parametres/prestations#zone',
  '/dashboard/admin#creneaux': '/dashboard/parametres/prestations#creneaux',
  '/dashboard/admin#identite': '/dashboard/parametres/apparence',
  '/dashboard/admin#agenda': '/dashboard/calendrier?google=ouvrir',

  // Les anciens écrans d'argent vivent maintenant dans Chiffres.
  '/dashboard/compta': '/dashboard/chiffres',
  '/dashboard/crm': '/dashboard/chiffres',

  // Réglages : l'ancien formulaire géant s'est rangé en écrans. Les ancres qui visent une
  // feuille (`#facturation`, `#notifications`) la font ouvrir à l'arrivée — l'écran d'après
  // les lit dans `window.location.hash`.
  '/dashboard/parametres/tout': '/dashboard/parametres/profil',
  '/dashboard/parametres#profil': '/dashboard/parametres/profil',
  '/dashboard/parametres#compte': '/dashboard/parametres/profil',
  '/dashboard/parametres#facturation': '/dashboard/parametres/profil#facturation',
  '/dashboard/parametres#avis': '/dashboard/parametres/messages',
  '/dashboard/parametres#relances': '/dashboard/parametres/messages',
  '/dashboard/parametres#lien-reservation': '/dashboard/parametres/liens',
  '/dashboard/parametres#personnalisation': '/dashboard/parametres/apparence',
  '/dashboard/parametres#notifications': '/dashboard/parametres/reglages#notifications',
}

export function lienV2(href: string): string {
  return CORRESPONDANCES[href] ?? href
}
