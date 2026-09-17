import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ImportFactures } from '@/components/dashboard/ImportFactures'
import { SupprimerFactureImportee } from '@/components/dashboard/SupprimerFactureImportee'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { infosFacturationManquantes, phraseManques } from '@/lib/facture'
import {
  lireFiltre, filtrerFactures, anneesDisponibles, moisDisponibles, libelleMois, anneeMois,
} from '@/lib/listeFactures'
import { FUSEAU } from '@/lib/dateUtils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type FactureEmise = {
  id: string
  facture_numero: string
  facture_emise_le: string
  scheduled_at: string
  client_name: string
  company_name: string | null
  is_professional: boolean | null
  montant: string | number | null
}

type FactureImportee = {
  id: string
  nom_fichier: string
  date_facture: string
  montant: string | number | null
  numero: string | null
}

/** Une ligne de la liste, qu'elle vienne de WashBoard ou d'un import. */
type Ligne = {
  cle: string
  genre: 'emise' | 'importee'
  id: string
  numero: string | null
  /** Date qui range la facture : émission, ou date de la facture importée. */
  facture_emise_le: string
  titre: string
  detail: string
  montant: number | null
  lien: string
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const quand = (iso: string) => {
  const d = new Date(iso)
  const jour = d.toLocaleDateString('fr-FR', { timeZone: FUSEAU, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const heure = d.toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' })
  return `${jour} à ${heure}`
}

const jourSeul = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })

// Majuscule à la première lettre seulement. La classe CSS `capitalize` en
// mettait une à chaque mot : « Toutes Les Factures », « Toute L'année ».
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const total = (liste: Ligne[]) => liste.reduce((t, f) => t + (f.montant ?? 0), 0)
const nombre = (v: string | number | null) => (v === null || v === '' ? null : Number(v))

/** Côté Achats, annoncé avant d'exister : sans lui, le laveur rangerait ses
 *  factures d'achat parmi ses ventes (constaté au premier essai, le 15/09). */
function AchatsEnDeveloppement() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Factures d&apos;achat : en développement</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
        Bientôt, vos factures d&apos;achat (matériel, produits, carburant, abonnements) seront rangées ici, mois par
        mois, séparément de vos ventes. Vous les ajouterez comme vos anciennes factures : une par une ou en ZIP.
      </p>
    </div>
  )
}

function Filtre({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? 'page' : undefined}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        actif
          ? 'bg-[#1651E8] border-[#1651E8] text-white'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {children}
    </Link>
  )
}

// Toutes les factures du laveur : celles émises par WashBoard et celles qu'il
// a importées (faites avant), filtrables par année et par mois — le mois qui
// compte pour sa comptabilité. Les filtres sont de simples liens : l'adresse
// (?annee=2026&mois=09) se partage et se met en favori.
export default async function FacturesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const parametres = await searchParams
  const filtre = lireFiltre(parametres)
  const cote: 'ventes' | 'achats' = parametres.cote === 'achats' ? 'achats' : 'ventes'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'factures')

  // Lectures paginées : au-delà de 1 000 lignes, une lecture simple serait
  // coupée sans prévenir (voir `toutesLesLignes`).
  const [emises, importees] = await Promise.all([
    toutesLesLignes<FactureEmise>((debut, fin) =>
      supabase
        .from('bookings')
        .select('id, facture_numero, facture_emise_le, scheduled_at, client_name, company_name, is_professional, montant:facture_contenu->totaux->>ttc')
        .eq('washer_id', washer.id)
        .not('facture_numero', 'is', null)
        .order('facture_emise_le', { ascending: false })
        .order('id')
        .range(debut, fin)),
    toutesLesLignes<FactureImportee>((debut, fin) =>
      supabase
        .from('factures_importees')
        .select('id, nom_fichier, date_facture, montant, numero')
        .eq('washer_id', washer.id)
        .order('date_facture', { ascending: false })
        .order('id')
        .range(debut, fin)),
  ])
  if (emises.error) logger.error('factures.read_failed', { washerId: washer.id }, emises.error)
  if (importees.error) logger.error('factures_importees.read_failed', { washerId: washer.id }, importees.error)

  const toutes: Ligne[] = [
    ...emises.data.map(f => ({
      cle: `e-${f.id}`, genre: 'emise' as const, id: f.id, numero: f.facture_numero,
      facture_emise_le: f.facture_emise_le,
      titre: f.is_professional && f.company_name ? f.company_name : f.client_name,
      detail: `Rendez-vous du ${quand(f.scheduled_at)}`,
      montant: nombre(f.montant),
      lien: `/api/bookings/${f.id}/pdf`,
    })),
    ...importees.data.map(f => ({
      cle: `i-${f.id}`, genre: 'importee' as const, id: f.id, numero: f.numero,
      // Midi UTC : la date d'une facture importée reste le même jour à Paris.
      facture_emise_le: `${f.date_facture}T12:00:00.000Z`,
      titre: f.nom_fichier,
      detail: `Facture du ${jourSeul(f.date_facture)}`,
      montant: nombre(f.montant),
      lien: `/api/factures/importees/${f.id}`,
    })),
  ].sort((a, b) => b.facture_emise_le.localeCompare(a.facture_emise_le))

  const factures = filtrerFactures(toutes, filtre)
  const annees = anneesDisponibles(toutes)
  const mois = filtre.annee ? moisDisponibles(toutes, filtre.annee) : []
  const selection = filtre.mois
    ? `${libelleMois(filtre.mois)} ${filtre.annee}`
    : filtre.annee ?? 'Toutes les factures'
  const erreur = (emises.error && emises.data.length === 0) ? true : false

  const parMois = new Map<string, Ligne[]>()
  for (const f of factures) {
    const { annee, mois: m } = anneeMois(f.facture_emise_le)
    const cle = `${libelleMois(m)} ${annee}`
    parMois.set(cle, [...(parMois.get(cle) ?? []), f])
  }
  const manques = infosFacturationManquantes(washer)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Factures</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Émises automatiquement quand un rendez-vous est marqué « Terminé ». Vous pouvez aussi y ranger
          les factures faites avant WashBoard.
        </p>
      </div>

      {/* Deux côtés : ce que le laveur a vendu, et ce qu'il a acheté. Mélangés,
          le total du mois additionnerait ses ventes et ses achats. */}
      <nav aria-label="Ventes ou achats" className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5 w-full sm:w-fit">
        {([
          { valeur: 'ventes', libelle: 'Ventes', href: '/dashboard/factures' },
          { valeur: 'achats', libelle: 'Achats', href: '/dashboard/factures?cote=achats' },
        ] as const).map(o => (
          <Link
            key={o.valeur}
            href={o.href}
            aria-current={cote === o.valeur ? 'page' : undefined}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold text-center transition-all ${
              cote === o.valeur
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {o.libelle}
            {o.valeur === 'achats' && (
              <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                bientôt
              </span>
            )}
          </Link>
        ))}
      </nav>

      {cote === 'achats' ? <AchatsEnDeveloppement /> : (<>
      <div className="mb-5">
        <ImportFactures />
      </div>

      {manques.length > 0 && (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          {phraseManques(manques)}{' '}
          <Link href="/dashboard/parametres#facturation" className="font-semibold underline">Compléter mes informations</Link>
        </p>
      )}

      {toutes.length > 0 && (
        <nav aria-label="Filtrer les factures" className="mb-5 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Filtre href="/dashboard/factures" actif={!filtre.annee}>Tout</Filtre>
            {annees.map(a => (
              <Filtre key={a} href={`/dashboard/factures?annee=${a}`} actif={filtre.annee === a && !filtre.mois}>{a}</Filtre>
            ))}
          </div>
          {filtre.annee && mois.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Filtre href={`/dashboard/factures?annee=${filtre.annee}`} actif={!filtre.mois}>Toute l&apos;année</Filtre>
              {mois.map(m => (
                <Filtre key={m} href={`/dashboard/factures?annee=${filtre.annee}&mois=${m}`} actif={filtre.mois === m}>
                  {majuscule(libelleMois(m))}
                </Filtre>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 pt-1">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{majuscule(selection)}</span>
            {' · '}{factures.length} facture{factures.length > 1 ? 's' : ''}
            {' · '}<span className="font-semibold tabular-nums">{euros.format(total(factures))}</span>
          </p>
        </nav>
      )}

      {erreur ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Impossible de charger vos factures pour le moment. Rechargez la page dans un instant.
        </p>
      ) : toutes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Aucune facture pour l&apos;instant</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Elles apparaissent ici dès qu&apos;un rendez-vous est marqué « Terminé » dans le calendrier.
          </p>
        </div>
      ) : factures.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Aucune facture sur cette période.{' '}
          <Link href="/dashboard/factures" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Voir toutes les factures</Link>
        </p>
      ) : (
        <div className="space-y-6">
          {[...parMois].map(([libelle, liste]) => (
            <section key={libelle}>
              <div className="flex items-baseline justify-between gap-3 mb-2 px-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{libelle}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {liste.length} facture{liste.length > 1 ? 's' : ''} · {euros.format(total(liste))}
                </p>
              </div>
              <ul className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {liste.map(f => (
                  <li key={f.cle} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 w-20 shrink-0 truncate">
                      {f.numero ?? '—'}
                    </span>
                    <div className="flex-1 min-w-[10rem]">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-all">
                        {f.titre}
                        {f.genre === 'importee' && (
                          <span className="ml-2 align-middle px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            importée
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{f.detail}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {f.montant != null ? euros.format(f.montant) : '—'}
                    </span>
                    <a href={f.lien} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                      Télécharger
                    </a>
                    {f.genre === 'importee' && <SupprimerFactureImportee id={f.id} nom={f.titre} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {(emises.tronque || importees.tronque) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Une partie de vos factures n&apos;a pas pu être chargée. Rechargez la page pour les voir toutes.
            </p>
          )}
        </div>
      )}
      </>)}
    </DashboardShell>
  )
}
