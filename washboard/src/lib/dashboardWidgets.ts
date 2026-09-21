// Widgets configurables du tableau de bord.
//
// Quatre blocs, chacun affichable ou masquable depuis le bouton « Configurer » :
// aucune réorganisation, l'ordre reste toujours celui déclaré ici. Ce qui n'est
// PAS dans ce registre — la carte de démarrage et la liste des réservations —
// reste toujours affiché : masquer ses propres rendez-vous n'aurait aucun sens.
//
// La préférence est stockée sur `washers.dashboard_widgets` (tableau de clés).
// `null` (compte jamais personnalisé) veut dire « tout afficher », pas « rien
// afficher » : un compte neuf ne doit pas paraître amputé avant d'avoir touché
// au réglage.

export type WidgetKey = 'today' | 'stats' | 'clients' | 'upcoming' | 'traffic' | 'services' | 'zone'

export const WIDGETS: { key: WidgetKey; label: string; description: string }[] = [
  { key: 'today',    label: 'Aujourd’hui',           description: 'Vos rendez-vous du jour, en un coup d’œil' },
  { key: 'stats',    label: 'Statistiques',          description: 'Réservations et chiffre d’affaires' },
  { key: 'clients',  label: 'Clients',               description: 'Combien, et les nouveaux cette semaine' },
  { key: 'upcoming', label: 'Prochains rendez-vous', description: 'Ce qui arrive après aujourd’hui' },
  { key: 'traffic',  label: 'Trafic & conversion',   description: 'Vos visiteurs de la semaine, d’où ils viennent, et combien réservent' },
  { key: 'services', label: 'Prestations',           description: 'La plus demandée ce mois-ci' },
  { key: 'zone',     label: 'Zone d’intervention',   description: 'Votre rayon d’action actuel' },
]

const CLES_VALIDES = new Set<string>(WIDGETS.map(w => w.key))

function estCleValide(v: unknown): v is WidgetKey {
  return typeof v === 'string' && CLES_VALIDES.has(v)
}

/** Widgets à afficher, dans l'ordre fixe de `WIDGETS`.
 *
 *  `pref` vaut `null`/`undefined` tant que le laveur n'a jamais ouvert le
 *  réglage : tout s'affiche par défaut, plutôt qu'un tableau de bord vide qui
 *  laisserait croire à une panne. */
export function widgetsVisibles(pref: string[] | null | undefined): Set<WidgetKey> {
  if (pref == null) return new Set(WIDGETS.map(w => w.key))
  return new Set(pref.filter(estCleValide))
}

/** Normalise ce qu'on s'apprête à écrire en base : uniquement des clés
 *  connues, sans doublon. Une clé inconnue (ancienne version, faute de frappe
 *  côté client) est silencieusement écartée plutôt que de faire échouer
 *  l'enregistrement pour les autres. */
export function widgetsValides(cles: unknown): WidgetKey[] {
  if (!Array.isArray(cles)) return []
  return [...new Set(cles.filter(estCleValide))]
}
