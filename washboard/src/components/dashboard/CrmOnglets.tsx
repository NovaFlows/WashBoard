import Link from 'next/link'

/** Les deux moitiés du CRM : ce qui arrive tout seul, et ce qu'on a acheté.
 *
 *  Pourquoi les campagnes vivent ICI et plus dans le menu : elles répondent à
 *  la même question que le reste du CRM — « d'où viennent mes clients » — et
 *  les deux écrans se lisent l'un contre l'autre. Séparés, le laveur comparait
 *  de tête le trafic de sa publicité au trafic de sa page, en changeant de
 *  page entre les deux.
 *
 *  Un lien et pas un `useState` : l'onglet est dans l'URL, donc partageable,
 *  rechargeable, et surtout la page ne lit en base que ce que l'onglet ouvert
 *  demande — une année d'événements d'entonnoir ne se charge pas pour afficher
 *  trois campagnes. */
export type OngletCrm = 'apercu' | 'campagnes'

const ONGLETS: { cle: OngletCrm; label: string; href: string }[] = [
  { cle: 'apercu',    label: 'Vue d’ensemble', href: '/dashboard/crm' },
  { cle: 'campagnes', label: 'Publicités',     href: '/dashboard/crm?onglet=campagnes' },
]

export default function CrmOnglets({ actif, badge }: {
  actif: OngletCrm
  /** Nom de l'offre qui ouvre les publicités, quand l'offre actuelle ne les
   *  couvre pas. Dit d'avance plutôt que découvert en cliquant. */
  badge?: { label: string; couleur: string }
}) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 w-full">
      {ONGLETS.map(o => (
        <Link
          key={o.cle}
          href={o.href}
          scroll={false}
          aria-current={actif === o.cle ? 'page' : undefined}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-[background-color,color] duration-150 ease-out ${
            actif === o.cle
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {o.label}
          {o.cle === 'campagnes' && badge && (
            <span
              className="text-[10px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: badge.couleur }}
            >
              {badge.label}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
