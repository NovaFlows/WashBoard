import Link from 'next/link'
import { PLAN_LABELS, PLAN_COULEURS, type Plan } from '@/lib/plan'

const BLEU = '#1651E8'
const ORANGE = '#D97706'
const ROUGE = '#DC2626'

/** Où en est le laveur de son quota du mois, tout le temps, sans rien cacher.
 *
 *  Avant, rien ne le renseignait tant qu'il n'avait pas cogné le mur : il
 *  découvrait le plafond au moment où il perdait un client, c'est-à-dire au
 *  pire moment pour lui demander de payer. Un compteur qui monte fait le
 *  travail tout seul, et il le fait à froid.
 *
 *  Trois états, et le changement de couleur est le message : bleu tant qu'il
 *  reste de la marge, orange à la dernière réservation disponible, rouge une
 *  fois dépassé. Personne ne lit une barre de progression ; tout le monde voit
 *  qu'elle a changé de couleur.
 *
 *  Ne s'affiche pas sur une offre sans plafond : il n'y a alors rien à
 *  compter, et une jauge pleine à 3 % serait un rappel gratuit qu'on paie. */
export function JaugeReservations({ utilisees, quota, offre, remiseAZero }: {
  utilisees: number
  /** `null` sur une offre sans plafond : le composant ne rend alors rien. */
  quota: number | null
  offre: Plan
  /** Date de remise à zéro du compteur, déjà écrite (« 22 octobre »). Elle
   *  tombe à la date anniversaire de l'inscription, pas le 1er du mois. */
  remiseAZero?: string
}) {
  if (quota === null || quota <= 0) return null

  const restantes = Math.max(0, quota - utilisees)
  const depasse = utilisees >= quota
  const derniere = restantes === 1
  const couleur = depasse ? ROUGE : derniere ? ORANGE : BLEU

  // Bornée à 100 % : au-delà du plafond, la barre est pleine, elle ne déborde
  // pas de son cadre.
  const pourcent = Math.min(100, Math.round((utilisees / quota) * 100))

  const message = depasse
    ? `Plafond atteint — les suivantes sont masquées${remiseAZero ? ` jusqu’au ${remiseAZero}` : ''}`
    : derniere
      ? 'Plus qu’une réservation avant le plafond'
      : `Encore ${restantes} réservations avant le ${remiseAZero ?? 'prochain palier'}`

  return (
    <div className="mb-4 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
          <span style={{ color: couleur }}>{utilisees}</span>
          <span className="text-slate-400 dark:text-slate-500"> / {quota}</span>
          <span className="font-semibold text-slate-500 dark:text-slate-400"> réservations ce mois</span>
        </p>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: PLAN_COULEURS[offre] }}
            aria-hidden
          />
          {PLAN_LABELS[offre]}
        </span>
      </div>

      {/* `aria-hidden` : la barre redit ce que le texte au-dessus énonce déjà.
          L'annoncer deux fois ferait lire deux fois la même chose. */}
      <div
        className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
        aria-hidden
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pourcent}%`, backgroundColor: couleur }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
        {/* Le lien n'apparaît qu'à partir du moment où il sert à quelque chose.
            Proposé dès la première réservation du mois, il ne serait qu'une
            publicité de plus dans un outil de travail. */}
        {(derniere || depasse) && (
          <Link
            href="/dashboard/abonnement"
            className="shrink-0 text-[11px] font-black uppercase tracking-[0.18em] hover:underline"
            style={{ color: couleur }}
          >
            Changer d’offre →
          </Link>
        )}
      </div>
    </div>
  )
}
