// Reconnaît la forme d'un UUID (sans distinguer les versions — ce n'est pas
// un contrôle cryptographique, juste un format). Pensé pour les routes
// PUBLIQUES qui prennent un id de réservation/document en paramètre d'URL
// comme seul jeton d'accès (voir bookings/[id]/pdf, bookings/[id]/source,
// documents/[id]/pdf) : sans ce contrôle, un lien cassé, un bot qui scanne
// des URLs au hasard, ou un `undefined` côté client mal interpolé dans un
// lien (`/api/bookings/undefined/pdf`) atteint Postgres tel quel, qui répond
// alors « invalid input syntax for type uuid » — une vraie erreur serveur
// (niveau ERROR dans les journaux) pour ce qui n'est jamais qu'un lien
// invalide. Vérifier la forme ici permet de rendre un simple 404, propre et
// silencieux, avant même d'interroger la base.
const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function uuidValide(valeur: string): boolean {
  return FORME_UUID.test(valeur)
}
