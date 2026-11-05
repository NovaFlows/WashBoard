// Pastille « nombre de messages non lus » de la boîte de réception de l'équipe
// (SupportInbox), par fil.
//
// Au-delà de 9, on affiche « 9+ » plutôt que le nombre exact : un « 47 » dans
// une pastille de menu de quelques millimètres devient illisible, et un
// laveur n'a pas besoin de savoir s'il a 12 ou 47 messages en retard pour
// comprendre qu'il doit ouvrir le fil — seulement qu'il y en a beaucoup.

const SEUIL_TRONCATURE = 9

/** Texte annoncé aux lecteurs d'écran — jamais le chiffre seul, qui n'a pas
 *  de sens sans contexte (ex. « 3 » ne dit pas qu'il s'agit de messages non
 *  lus). Un chiffre coloré ne suffit pas comme indicateur d'accessibilité. */
export function unreadLabel(count: number): string {
  return count > 1 ? `${count} messages non lus` : `${count} message non lu`
}

export function UnreadCountBadge({
  count,
  label,
  className = '',
}: {
  /** `null`/`undefined`/`0` : rien ne s'affiche — jamais de « 0 » dans une
   *  pastille, et jamais de recalcul ici : ce composant affiche tel quel ce
   *  que l'API a renvoyé (voir /api/support/non-lues, /api/support/questions,
   *  /api/support/team-questions — contrat livré par `dev`). En cas d'échec
   *  de ces routes (503), l'appelant garde la dernière valeur connue plutôt
   *  que de retomber à zéro : ce composant n'a pas à s'en soucier, il se
   *  contente de ne rien afficher quand `count` est absent. */
  count: number | null | undefined
  /** Texte pour `sr-only`. */
  label: string
  className?: string
}) {
  if (!count || count <= 0) return null
  const affiche = count > SEUIL_TRONCATURE ? `${SEUIL_TRONCATURE}+` : String(count)

  // Bleu fixe du canal support, pas l'accent personnalisable du laveur.
  const couleurs = 'bg-[#1651E8]/10 dark:bg-[#6A9FFF]/15 text-[#1651E8] dark:text-[#6A9FFF]'

  return (
    <>
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-bold leading-none tabular-nums shrink-0 ${couleurs} ${className}`}
      >
        {affiche}
      </span>
      <span className="sr-only">{label}</span>
    </>
  )
}
