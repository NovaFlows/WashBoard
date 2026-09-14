import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { infosFacturationManquantes, phraseManques } from '@/lib/facture'
import { FUSEAU } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type FactureListee = {
  id: string
  facture_numero: string
  facture_emise_le: string
  scheduled_at: string
  client_name: string
  company_name: string | null
  is_professional: boolean | null
  montant: string | number | null
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const moisDe = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: FUSEAU, month: 'long', year: 'numeric' })

const quand = (iso: string) => {
  const d = new Date(iso)
  const jour = d.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const heure = d.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  return `${jour} à ${heure}`
}

// Toutes les factures émises par le laveur, rangées par mois d'émission —
// le mois qui compte pour sa comptabilité et ses déclarations.
export default async function FacturesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!washer) redirect('/login')

  // Lecture paginée : au-delà de 1 000 factures, une lecture simple serait
  // coupée sans prévenir (voir `toutesLesLignes`).
  const { data: factures, error, tronque } = await toutesLesLignes<FactureListee>((debut, fin) =>
    supabase
      .from('bookings')
      .select('id, facture_numero, facture_emise_le, scheduled_at, client_name, company_name, is_professional, montant:facture_contenu->totaux->>ttc')
      .eq('washer_id', washer.id)
      .not('facture_numero', 'is', null)
      .order('facture_emise_le', { ascending: false })
      .order('id')
      .range(debut, fin),
  )
  if (error) logger.error('factures.read_failed', { washerId: washer.id }, error)

  const parMois = new Map<string, FactureListee[]>()
  for (const f of factures) {
    const mois = moisDe(f.facture_emise_le)
    parMois.set(mois, [...(parMois.get(mois) ?? []), f])
  }
  const manques = infosFacturationManquantes(washer)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Factures</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Émises automatiquement quand un rendez-vous est marqué « Terminé ».
        </p>
      </div>

      {manques.length > 0 && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          {phraseManques(manques)}{' '}
          <Link href="/dashboard/parametres#facturation" className="font-semibold underline">Compléter mes informations</Link>
        </p>
      )}

      {error && factures.length === 0 ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Impossible de charger vos factures pour le moment. Rechargez la page dans un instant.
        </p>
      ) : factures.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Aucune facture pour l&apos;instant</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Elles apparaissent ici dès qu&apos;un rendez-vous est marqué « Terminé » dans le calendrier.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...parMois].map(([mois, liste]) => {
            const total = liste.reduce((t, f) => t + Number(f.montant ?? 0), 0)
            return (
              <section key={mois}>
                <div className="flex items-baseline justify-between gap-3 mb-2 px-1">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{mois}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {liste.length} facture{liste.length > 1 ? 's' : ''} · {euros.format(total)}
                  </p>
                </div>
                <ul className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {liste.map(f => (
                    <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 w-20 shrink-0">{f.facture_numero}</span>
                      <div className="flex-1 min-w-[10rem]">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {f.is_professional && f.company_name ? f.company_name : f.client_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Rendez-vous du {quand(f.scheduled_at)}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {f.montant != null ? euros.format(Number(f.montant)) : '—'}
                      </span>
                      <a
                        href={`/api/bookings/${f.id}/pdf`}
                        className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Télécharger
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {tronque && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Une partie de vos factures n&apos;a pas pu être chargée. Rechargez la page pour les voir toutes.
            </p>
          )}
        </div>
      )}
    </DashboardShell>
  )
}
