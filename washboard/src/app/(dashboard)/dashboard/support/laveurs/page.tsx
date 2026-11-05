import Link from 'next/link'
import { exigerEquipe, chargerTousLesLaveurs } from '@/lib/ficheLaveurDonnees'
import { analyserLaveur, dateCourte, ilYa } from '@/lib/ficheLaveur'
import { COMPTES_INTERNES_EXCLUS_DIFFUSION } from '@/lib/plan'
import CoqueEquipe from '@/components/dashboard/equipe/CoqueEquipe'
import { Pastille } from '@/components/dashboard/equipe/FicheLaveurVue'

export const dynamic = 'force-dynamic'

// Liste des laveurs pour l'équipe : les plus récents en premier, avec de quoi
// voir d'un coup d'œil qui a besoin d'un appel.
export default async function LaveursPage() {
  const { washer } = await exigerEquipe()
  const now = new Date()
  const laveurs = (await chargerTousLesLaveurs())
    .filter(d => !COMPTES_INTERNES_EXCLUS_DIFFUSION.includes(d.washer.slug))
    .map(d => ({ d, topo: analyserLaveur(d, now) }))

  return (
    <CoqueEquipe washer={washer}>
      <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Support
      </Link>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Laveurs</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">
        {laveurs.length} comptes, les derniers inscrits en premier. Comptes de test exclus.
      </p>
      <ul className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {laveurs.map(({ d, topo }) => (
          <li key={d.washer.id}>
            <Link href={`/dashboard/support/laveurs/${d.washer.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${topo.priorite === 1 ? 'bg-red-500' : topo.priorite === 2 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-900 dark:text-white truncate">{d.washer.name}</span>
                  <Pastille ton={topo.statut.ton}>{topo.statut.libelle}</Pastille>
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Inscrit le {dateCourte(d.washer.created_at)}
                  {' · '}{topo.pagePrete ? 'page prête' : 'page à configurer'}
                  {' · '}{topo.activite.visites30} visite{topo.activite.visites30 > 1 ? 's' : ''}, {topo.activite.reservations30} résa (30 j)
                  {topo.activite.derniereConnexion ? ` · vu ${ilYa(topo.activite.derniereConnexion, now)}` : ''}
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Pastille rouge : à appeler en premier (fin d’essai proche, ou des visites sans réservations). Orange : à accompagner.</p>
    </CoqueEquipe>
  )
}
