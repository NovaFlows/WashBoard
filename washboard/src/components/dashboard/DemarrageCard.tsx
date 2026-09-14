import Link from 'next/link'
import { etapeDemarrage, type SetupProgress } from '@/lib/setupProgress'

// Carte d'accueil d'un compte qui ne peut pas encore prendre de réservation.
//
// Un nouvel inscrit arrivait sur un tableau de bord vide (« 0 en attente »)
// sans savoir par où commencer : l'avancement n'était visible que dans les
// Paramètres. Un inscrit avait ainsi tout rempli sauf ses prestations, et sa
// page publique ne proposait rien.
//
// Elle ne montre que l'indispensable, avec un seul bouton vers la prochaine
// étape, et disparaît dès que la page peut encaisser un rendez-vous : le
// confort (avis, relances, logo…) reste l'affaire de la barre des Paramètres.

const BOUTON: Record<string, string> = {
  services: 'Configurer mes prestations',
  availabilities: 'Ajouter mes horaires',
  baseAddress: 'Renseigner mon adresse',
}

export function DemarrageCard({ progress }: { progress: SetupProgress }) {
  const etape = etapeDemarrage(progress)
  if (!etape) return null
  const indispensables = progress.items.filter(i => i.blocking)

  return (
    <section
      aria-labelledby="demarrage-titre"
      className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-5"
    >
      <h2 id="demarrage-titre" className="text-base font-bold text-slate-900 dark:text-white">
        Configurer mon compte et mes prestations
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
        Votre page de réservation ne peut pas encore prendre de rendez-vous. Il reste
        {' '}{indispensables.filter(i => !i.done).length === 1 ? 'une étape' : `${indispensables.filter(i => !i.done).length} étapes`}.
      </p>

      <ol className="mt-4 space-y-2">
        {indispensables.map(item => (
          <li key={item.key} className="flex items-center gap-2.5 text-sm">
            {item.done ? (
              <span aria-hidden className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </span>
            ) : (
              <span
                aria-hidden
                className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                  item.key === etape.key ? 'border-[#1651E8] dark:border-[#6A9FFF]' : 'border-slate-300 dark:border-slate-600'
                }`}
              />
            )}
            <span className={item.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}>
              {item.label}
            </span>
            <span className="sr-only">{item.done ? '(fait)' : '(à faire)'}</span>
          </li>
        ))}
      </ol>

      <Link
        href={etape.href}
        className="mt-5 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-[#1651E8] hover:bg-[#1244c4] text-white text-sm font-semibold transition-colors"
      >
        {BOUTON[etape.key] ?? 'Continuer la configuration'}
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </section>
  )
}
