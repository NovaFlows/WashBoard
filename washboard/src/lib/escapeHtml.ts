// Échappement HTML pour les emails transactionnels.
//
// Le nom d'un client, ses notes de réservation ou le message de relance d'un
// laveur étaient interpolés bruts dans du HTML envoyé depuis
// noreply@washboard.fr. Quelqu'un pouvait donc réserver sous le nom
// `<a href="...">Cliquez ici</a>` et faire partir un lien de sa composition
// dans un email portant l'adresse de WashBoard — vecteur de hameçonnage
// crédible vers le laveur, ou vers ses propres clients. Signalé par un audit
// externe le 2026-09-05.
//
// Ces cinq caractères suffisent : ils couvrent l'ouverture de balise, la
// fermeture, les attributs et les entités.

const REMPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Rend une valeur sûre à insérer dans du HTML.
 *
 *  Accepte `null`/`undefined` et rend une chaîne vide : les appelants
 *  interpolent souvent des champs facultatifs, et les forcer à tester chaque
 *  cas ferait qu'on oublierait d'échapper quelque part. */
export function escapeHtml(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return ''
  // `&` doit être traité en premier, sinon on ré-échapperait les `&` qu'on
  // vient d'introduire — `<` deviendrait `&amp;lt;` et s'afficherait tel quel.
  return String(valeur).replace(/[&<>"']/g, c => REMPLACEMENTS[c])
}
