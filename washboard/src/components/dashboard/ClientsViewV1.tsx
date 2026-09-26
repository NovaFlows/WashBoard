'use client'

import { useMemo, useState } from 'react'
import { Building2, Search, X } from 'lucide-react'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import { buildClientProfile, type ClientBooking } from '@/lib/clientProfile'
import { listeClients, rechercherClients, type ResumeClient } from '@/lib/listeClients'
import { formatPhone } from '@/lib/phone'
import { FUSEAU } from '@/lib/dateUtils'

// Fichier clients du laveur, présentation v1 — reprise à l'identique du
// commit 8a1efa6 (dernier avant que cet écran passe en v2). C'est ce que voit
// tout visiteur du SITE, mobile ou ordinateur : la refonte 2026 ne s'applique
// qu'à la PWA installée (décision d'Alexandre, 2026-09-22 — voir
// ClientsView.tsx, le point de branchement). Ne pas faire évoluer visuellement
// ce fichier séparément de v2 sans raison : toute correction de LOGIQUE doit
// profiter aux deux versions (listeClients, rechercherClients,
// buildClientProfile ne sont pas dupliqués, seule la présentation l'est).

const carte = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'

function dateCourte(iso: string, maintenant: number): string {
  const d = new Date(iso)
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }), timeZone: FUSEAU,
  })
}

export default function ClientsViewV1({ bookings }: { bookings: ClientBooking[] }) {
  // L'instant présent, lu une seule fois : le serveur et le navigateur doivent
  // calculer la même liste.
  const [maintenant] = useState(() => Date.now())
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)

  const clients = useMemo(() => listeClients(bookings, new Date(maintenant)), [bookings, maintenant])
  const affiches = useMemo(() => rechercherClients(clients, recherche), [clients, recherche])
  const fiche = ouvert ? buildClientProfile(bookings, ouvert) : null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Clients</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {clients.length === 0
            ? 'Vos clients apparaîtront ici dès leur première réservation.'
            : `${clients.length} client${clients.length > 1 ? 's' : ''}, du plus récent au plus ancien`}
        </p>
      </div>

      {clients.length > 0 && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden />
            <input
              id="recherche-clients"
              type="search"
              inputMode="search"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="Nom, téléphone, email, adresse…"
              aria-label="Rechercher un client"
              autoComplete="off"
              className="w-full h-11 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {recherche.trim() && (
            <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
              {affiches.length === 0
                ? `Aucun client ne correspond à « ${recherche.trim()} ».`
                : `${affiches.length} client${affiches.length > 1 ? 's' : ''} trouvé${affiches.length > 1 ? 's' : ''}`}
            </p>
          )}

          {affiches.length > 0 && (
            <ul aria-label="Liste des clients" className={`${carte} divide-y divide-slate-100 dark:divide-slate-800`}>
              {affiches.map(c => (
                <LigneClient key={c.email} client={c} maintenant={maintenant} onOuvrir={() => setOuvert(c.email)} />
              ))}
            </ul>
          )}
        </>
      )}

      {fiche && <ClientProfileModal profile={fiche} onClose={() => setOuvert(null)} />}
    </div>
  )
}

function LigneClient({ client: c, maintenant, onOuvrir }: { client: ResumeClient; maintenant: number; onOuvrir: () => void }) {
  const titre = c.isProfessional && c.companyName ? c.companyName : c.name
  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Voir la fiche de ${titre}`}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/60"
      >
        <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-500 shrink-0 mt-0.5">
          {c.isProfessional ? <Building2 size={16} strokeWidth={2} /> : c.name.charAt(0).toUpperCase()}
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{titre}</span>
            {c.isProfessional && (
              <span className="shrink-0 px-1 rounded text-[10px] font-semibold tracking-wide text-slate-500 border border-slate-200 dark:border-slate-700">PRO</span>
            )}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
            {[c.isProfessional && c.companyName ? c.name : null, c.phone ? formatPhone(c.phone) : null, c.email].filter(Boolean).join(' · ')}
          </span>
          {/* La date d'abord, et le droit de passer à la ligne : sur téléphone,
              la ligne coupée masquait justement la date. */}
          <span className="block text-xs mt-1">
            {c.derniere ? (
              <span className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-400 dark:text-slate-500">Dernière prestation le </span>
                {dateCourte(c.derniere.date, maintenant)} · {c.derniere.service}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">Pas encore de prestation faite</span>
            )}
          </span>
          {c.prochain && (
            <span className="block text-xs text-emerald-700 dark:text-emerald-400 truncate">
              Prochain rendez-vous : {dateCourte(c.prochain.date, maintenant)}
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{c.honoredCount}</span>
          <span className="block text-[11px] text-slate-400 dark:text-slate-500">lavage{c.honoredCount > 1 ? 's' : ''}</span>
        </span>
      </button>
    </li>
  )
}
