import Link from 'next/link'
import type { ZoneConfig } from '@/types'
import { DEPARTMENTS } from '@/lib/france-departments'

// Gratuit à afficher : tout vient de `washer.zone_config`, déjà en mémoire
// pour la page — aucune requête de plus.

const NOM_DEPT = new Map(DEPARTMENTS.map(d => [d.code, d.name]))

export function ZoneWidget({ zone }: { zone: ZoneConfig }) {
  return (
    <Link
      href="/dashboard/admin#zone"
      className="block bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        Zone d’intervention
      </h2>

      {!zone || !zone.enabled ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Aucune limite définie — vous intervenez partout où on vous le demande.
        </p>
      ) : zone.type === 'departments' ? (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {zone.departments.length} département{zone.departments.length > 1 ? 's' : ''} :{' '}
          <span className="text-slate-500 dark:text-slate-400">
            {zone.departments.slice(0, 4).map(c => NOM_DEPT.get(c) ?? c).join(', ')}
            {zone.departments.length > 4 ? '…' : ''}
          </span>
        </p>
      ) : (
        <div>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">{zone.radius_km} km</p>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400 dark:text-slate-500 mt-1.5 truncate">autour de {zone.center_address}</p>
        </div>
      )}
    </Link>
  )
}
