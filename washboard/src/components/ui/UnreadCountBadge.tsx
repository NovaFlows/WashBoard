// Pastille « nombre de messages non lus », partagée par les quatre endroits
// du canal Assistance qui en affichent une : l'entrée « Assistance » du menu
// latéral et le bouton ☰ (Sidebar/DashboardShell, côté laveur — un compte de
// messages tous fils confondus), la liste des fils côté laveur
// (SupportConversation) et la boîte de réception côté équipe (SupportInbox),
// ces deux dernières par fil. Un seul composant pour que le style et le seuil
// de troncature ne divergent jamais entre les quatre — c'est le sens même de
// la demande de Ryan (« un nombre partout, harmonisé »).
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
  variant = 'subtle',
  announce = true,
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
  /** Texte pour `sr-only` (ignoré si `announce` est `false`). */
  label: string
  /** `solid` : fond plein, texte blanc — utilisé sur un fond neutre où la
   *  pastille doit ressortir fort (le bouton ☰). `subtle` : même teinte que
   *  les badges de statut déjà en place (StatutBadge, PlanBadge) — utilisé
   *  partout ailleurs, en ligne avec du texte. */
  variant?: 'solid' | 'subtle'
  /** À `false` quand l'élément parent porte déjà son propre `aria-label`
   *  décrivant l'état non lu (le bouton ☰) : évite une double annonce au
   *  lecteur d'écran. */
  announce?: boolean
  className?: string
}) {
  if (!count || count <= 0) return null
  const affiche = count > SEUIL_TRONCATURE ? `${SEUIL_TRONCATURE}+` : String(count)

  // Mêmes teintes que le reste du canal Assistance (bleu de marque du
  // laveur non utilisé ici à dessein : ce bleu-là est celui, fixe, du canal
  // support lui-même — voir StatutBadge/Composer dans SupportConversation —
  // pas question de le confondre avec l'accent personnalisable par laveur).
  const couleurs = variant === 'solid'
    ? 'bg-[#1651E8] dark:bg-[#6A9FFF] text-white dark:text-slate-950'
    : 'bg-[#1651E8]/10 dark:bg-[#6A9FFF]/15 text-[#1651E8] dark:text-[#6A9FFF]'

  return (
    <>
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[10px] font-bold leading-none tabular-nums shrink-0 ${couleurs} ${className}`}
      >
        {affiche}
      </span>
      {announce && <span className="sr-only">{label}</span>}
    </>
  )
}
