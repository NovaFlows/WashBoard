import Link from 'next/link'
import { PLAN_LABELS, PLAN_PRICES, BOOKING_QUOTA, type Plan } from '@/lib/plan'
import { jourSeul } from '@/lib/reservationsVerrouillees'

const BLEU = '#1651E8'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'

/** Première offre qui lève le plafond de réservations. Calculée plutôt
 *  qu'écrite en dur : déplacer les réservations illimitées d'un palier à
 *  l'autre ne doit pas laisser ces écrans proposer la mauvaise offre. */
const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']
const OFFRE_ILLIMITEE = OFFRES.find(p => BOOKING_QUOTA[p] === null) ?? 'pro'

export type Bloquee = {
  id: string
  client_name: string | null
  scheduled_at: string
}

/** Un nom qu'on devine sans le lire.
 *
 *  Le flou plutôt qu'un « ●●●●● » ou qu'un « Client masqué » : la forme réelle
 *  du nom reste là, sa longueur, ses majuscules. On voit qu'il y a QUELQU'UN
 *  derrière, et c'est ce qui donne envie de savoir qui. Un rond noir ne
 *  ressemble à personne.
 *
 *  Ce n'est pas une barrière — un flou CSS se retire en deux clics dans les
 *  outils du navigateur. Le nom n'est d'ailleurs pas ce qu'on protège : le
 *  téléphone, l'adresse et l'heure, eux, ne sont jamais chargés. */
function NomFloute({ nom }: { nom: string | null }) {
  return (
    <span
      className="blur-[5px] select-none text-slate-900 dark:text-slate-100 font-semibold"
      aria-label="Nom masqué"
    >
      {nom || 'Client'}
    </span>
  )
}

/** Bandeau compact : le compte et la sortie, sur une ligne.
 *
 *  Placé en haut du tableau de bord, comme les « 5 personnes ont vu votre
 *  profil » des grandes applications. Il ne raconte rien, il compte — et un
 *  compte qui monte tout seul est le meilleur argument de vente qu'on ait. */
export function BandeauBloquees({ nombre, offre }: { nombre: number; offre: Plan }) {
  if (nombre <= 0) return null

  return (
    <Link
      href="/dashboard/abonnement"
      className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
    >
      <span
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
        style={{ backgroundColor: BLEU }}
      >
        {nombre}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
          {nombre > 1 ? 'nouveaux clients' : 'nouveau client'} en attente
        </span>
        {/* Deux lignes plutôt qu'une coupée : `truncate` rendait « Votre offre
            Découverte n'en affiche pa… » sur un téléphone, une phrase qui
            s'arrête avant de dire ce qu'elle voulait dire. */}
        <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
          Votre offre {PLAN_LABELS[offre]} ne les affiche pas
        </span>
      </span>
      <span className={`shrink-0 ${SURTITRE}`} style={{ color: BLEU }}>Voir →</span>
    </Link>
  )
}

/** Carte détaillée : les noms floutés, un par un, avec leur jour.
 *
 *  Le compte seul reste abstrait. Voir trois lignes, trois formes de noms,
 *  trois dates — c'est ce qui transforme « j'ai raté des clients » en « j'ai
 *  raté CES clients-là ». */
export function CarteBloquees({ bloquees, offre }: { bloquees: Bloquee[]; offre: Plan }) {
  if (bloquees.length === 0) return null

  const nom = PLAN_LABELS[OFFRE_ILLIMITEE]
  const prix = PLAN_PRICES[OFFRE_ILLIMITEE]

  // Quatre lignes, pas trente. Une liste qui descend sans fin cesse d'être une
  // occasion manquée pour devenir un mur : on arrête de la lire, et le bouton
  // se retrouve trois écrans plus bas. Le nombre, lui, est déjà dans la
  // pastille — c'est lui qui porte le poids.
  const APERCU = 4
  const montrees = bloquees.slice(0, APERCU)
  const reste = bloquees.length - montrees.length

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
          style={{ backgroundColor: BLEU }}
        >
          {bloquees.length}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {bloquees.length > 1 ? 'clients que vous ne voyez pas' : 'client que vous ne voyez pas'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ils ont réservé, votre offre {PLAN_LABELS[offre]} ne les affiche pas.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {montrees.map(b => (
          <li key={b.id} className="flex items-center gap-3 px-5 py-3">
            <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0 text-sm truncate">
              <NomFloute nom={b.client_name} />
            </span>
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {jourSeul(b.scheduled_at)}
            </span>
          </li>
        ))}
        {reste > 0 && (
          <li className="px-5 py-3 text-sm text-slate-400 dark:text-slate-500">
            et {reste} autre{reste > 1 ? 's' : ''}
          </li>
        )}
      </ul>

      <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
        <Link
          href="/dashboard/abonnement"
          className="flex items-center justify-center w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors"
          style={{ backgroundColor: BLEU }}
        >
          Voir {bloquees.length > 1 ? 'ces clients' : 'ce client'} — offre {nom} à {prix}€/mois
        </Link>
        {/* Dit ici plutôt que découvert après coup : personne ne paie pour
            quelque chose dont il ignore l'étendue. */}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2">
          Débloque aussi toutes les réservations à venir.
        </p>
      </div>
    </div>
  )
}
