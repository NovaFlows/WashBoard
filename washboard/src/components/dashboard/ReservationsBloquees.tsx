import Link from 'next/link'
import { PLAN_LABELS, formatEuros, type Plan } from '@/lib/plan'

const BLEU = '#1651E8'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Bandeau compact : le compte et la sortie, sur une ligne.
 *
 *  Placé en haut du tableau de bord, comme les « 5 personnes ont vu votre
 *  profil » des grandes applications. Il ne raconte rien, il compte — et un
 *  compte qui monte tout seul est le meilleur argument de vente qu'on ait. */
export function BandeauBloquees({ nombre, offre, montant = 0 }: {
  nombre: number
  offre: Plan
  /** Total des lavages masqués, en euros. Zéro quand le prix est inconnu : on
   *  retombe alors sur le seul décompte, jamais sur un montant inventé. */
  montant?: number
}) {
  if (nombre <= 0) return null

  return (
    // Vers les CLIENTS, pas vers la page d'abonnement. Le bandeau annonce des
    // gens ; il doit mener aux gens. Envoyer directement à la caisse, c'est
    // demander de payer avant d'avoir montré pour quoi — on y va depuis la
    // liste, une fois qu'on a vu les noms et les dates.
    <Link
      href="/dashboard/clients"
      className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
    >
      <span
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
        style={{ backgroundColor: BLEU }}
      >
        {nombre}
      </span>
      <span className="flex-1 min-w-0">
        {/* Le montant passe devant le décompte quand on le connaît : « 195 € »
            se compare tout seul aux 19 € de l'abonnement, « 3 clients » non. */}
        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
          {montant > 0
            ? `${formatEuros(montant)} € de lavages en attente`
            : `${nombre > 1 ? 'nouveaux clients' : 'nouveau client'} en attente`}
        </span>
        {/* Deux lignes plutôt qu'une coupée : `truncate` rendait « Votre offre
            Découverte n'en affiche pa… » sur un téléphone, une phrase qui
            s'arrête avant de dire ce qu'elle voulait dire. */}
        <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
          {montant > 0 && `${nombre} client${nombre > 1 ? 's' : ''} · `}
          Votre offre {PLAN_LABELS[offre]} ne les affiche pas
        </span>
      </span>
      <span className={`shrink-0 ${SURTITRE}`} style={{ color: BLEU }}>Voir →</span>
    </Link>
  )
}
