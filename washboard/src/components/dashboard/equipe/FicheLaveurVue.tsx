import Link from 'next/link'
import type { DonneesLaveur, Topo, Ton } from '@/lib/ficheLaveur'
import { dateCourte, dateHeure, ilYa } from '@/lib/ficheLaveur'

// Fiche d'un laveur dans l'espace équipe. Composant serveur, sans état :
// tout est calculé par `analyserLaveur`. Pensée d'abord pour le téléphone —
// on y arrive le plus souvent en touchant la notification d'inscription.

const TONS: Record<Ton, string> = {
  ok: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  attention: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  alerte: 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  neutre: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function Pastille({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONS[ton]}`}>{children}</span>
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">{titre}</h2>
      {children}
    </section>
  )
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{libelle}</span>
      <span className="text-right text-slate-900 dark:text-slate-100 min-w-0 break-words">{children}</span>
    </div>
  )
}

/** Numéro au format international pour WhatsApp (06… → 336…). */
function numeroWhatsApp(tel: string): string {
  const chiffres = tel.replace(/\D/g, '')
  return chiffres.startsWith('0') ? '33' + chiffres.slice(1) : chiffres
}

const ETAPES = ['Page ouverte', 'Créneaux', 'Coordonnées', 'Réservé']

export default function FicheLaveurVue({ donnees, topo, now }: { donnees: DonneesLaveur; topo: Topo; now: Date }) {
  const w = donnees.washer
  const a = topo.activite
  const lienPage = `washboard.fr/book/${w.slug}`
  const max = Math.max(a.parcours[0], 1)

  return (
    <div className="space-y-4 pb-10">
      <Link href="/dashboard/support/laveurs" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Tous les laveurs
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{w.name}</h1>
          <Pastille ton={topo.statut.ton}>{topo.statut.libelle}</Pastille>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Inscrit le {dateHeure(w.created_at)}{w.acquisition_source ? ` · venu par « ${w.acquisition_source} »` : ''}
          {topo.statut.detail ? ` · ${topo.statut.detail}` : ''}
        </p>
      </header>

      {/* Actions en premier : depuis la notification, on veut appeler tout de suite. */}
      <div className="grid grid-cols-3 gap-2">
        {w.phone ? <a href={`tel:${w.phone.replace(/\s/g, '')}`} className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold text-center py-3">Appeler</a>
          : <span className="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-sm text-center py-3">Pas de n°</span>}
        {w.phone ? <a href={`https://wa.me/${numeroWhatsApp(w.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-center py-3 text-slate-800 dark:text-slate-100">WhatsApp</a>
          : <span className="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-sm text-center py-3">WhatsApp</span>}
        <a href={`https://${lienPage}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-center py-3 text-slate-800 dark:text-slate-100">Sa page</a>
      </div>

      <Bloc titre="À dire à l’appel">
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{topo.pourquoi}</p>
        {topo.aDire.length ? (
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-900 dark:text-slate-100">
            {topo.aDire.map(x => <li key={x}>{x}</li>)}
          </ol>
        ) : <p className="text-sm text-slate-500">Rien de particulier : prendre des nouvelles.</p>}
      </Bloc>

      <Bloc titre="Contact">
        <Ligne libelle="Téléphone">{w.phone ?? '—'}{w.telephone_verifie_le ? ' ✓' : ''}</Ligne>
        <Ligne libelle="Email">{donnees.email ? <a className="underline" href={`mailto:${donnees.email}`}>{donnees.email}</a> : '—'}</Ligne>
        {w.facture_nom_legal && <Ligne libelle="Nom légal">{w.facture_nom_legal}</Ligne>}
        <Ligne libelle="Adresse">{w.base_address ?? '—'}</Ligne>
        {w.website_url && <Ligne libelle="Site">{w.website_url.replace(/^https?:\/\//, '')}</Ligne>}
        <Ligne libelle="Page">{lienPage}</Ligne>
      </Bloc>

      <Bloc titre="Activité">
        <Ligne libelle="Dernière connexion">{a.derniereConnexion ? `${ilYa(a.derniereConnexion, now)} (${dateHeure(a.derniereConnexion)})` : 'Jamais'}</Ligne>
        <Ligne libelle="Réservations">{a.reservations}{a.reservations ? ` dont ${a.reservationsEnLigne} en ligne` : ''}</Ligne>
        <Ligne libelle="Sur 30 jours">{a.reservations30} réservation{a.reservations30 > 1 ? 's' : ''}{a.chiffre30 ? ` · ${a.chiffre30} €` : ''}</Ligne>
        {a.derniereReservation && <Ligne libelle="Dernière réservation">{dateCourte(a.derniereReservation)}</Ligne>}
        <Ligne libelle="Demandes d’avis envoyées">{a.smsAvis}</Ligne>

        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-4 mb-2">Sa page sur 30 jours</h3>
        <div className="space-y-1.5">
          {a.parcours.map((n, i) => (
            <div key={ETAPES[i]} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{ETAPES[i]}</span>
              <span className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <span className="block h-full rounded-full bg-slate-700 dark:bg-slate-300" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums font-semibold text-slate-900 dark:text-white">{n}</span>
            </div>
          ))}
        </div>
        {a.provenance.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          D’où viennent les visites : {a.provenance.map(p => `${p.source} ${p.visites}`).join(', ')}. Ses propres tests comptent aussi, souvent en « Direct ».
        </p>}
        <Ligne libelle="Lien dans ses réseaux ?">{a.lienReseaux}</Ligne>
      </Bloc>

      <Bloc titre="Configuration">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {topo.configuration.map(c => (
            <li key={c.libelle} className="flex items-start gap-3 py-2 text-sm">
              <span aria-hidden="true" className={`mt-0.5 shrink-0 grid place-items-center w-5 h-5 rounded-full text-xs font-bold ${c.fait ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{c.fait ? '✓' : '–'}</span>
              <span className="min-w-0">
                <span className="font-semibold text-slate-900 dark:text-white">{c.libelle}</span>
                <span className="sr-only">{c.fait ? ' : fait' : ' : à faire'}</span>
                <span className="block text-slate-500 dark:text-slate-400 break-words">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Bloc>

      {(topo.profil.length > 0 || topo.problemes.length > 0) && (
        <Bloc titre="Profil et points bloquants">
          {topo.profil.length > 0 && <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 mb-3">{topo.profil.map(x => <li key={x}>{x}</li>)}</ul>}
          {topo.problemes.length > 0 && <ul className="text-sm space-y-1">{topo.problemes.map(x => <li key={x} className="text-red-700 dark:text-red-400">• {x}</li>)}</ul>}
        </Bloc>
      )}
    </div>
  )
}
