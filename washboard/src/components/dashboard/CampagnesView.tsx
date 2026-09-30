'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuros } from '@/lib/plan'
import {
  PLATEFORMES, labelPlateforme, estEnCours, lienCampagne,
  type BilanCampagne, type Campagne, type Plateforme,
} from '@/lib/campagne'

const BLEU = '#1651E8'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'
const CARTE = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'

type CampagneAvecBilan = Campagne & { bilan: BilanCampagne }

function jourCourt(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Un nombre, son intitulé, et rien d'autre. */
function Chiffre({ label, valeur, aide, accent }: {
  label: string
  valeur: string
  aide?: string
  accent?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xl font-black tracking-tight truncate" style={accent ? { color: accent } : undefined}>
        {valeur}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
      {aide && <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">{aide}</p>}
    </div>
  )
}

function CarteCampagne({ c, baseUrl, onSupprimer }: {
  c: CampagneAvecBilan
  baseUrl: string
  onSupprimer: (id: string) => void
}) {
  const [copie, setCopie] = useState(false)
  const aujourdHui = new Date().toLocaleDateString('en-CA')
  const active = estEnCours(c, aujourdHui)
  const lien = lienCampagne(baseUrl, c.cle, c.plateforme)
  const b = c.bilan

  // Le retour colore la carte : au-dessus de 1, la publicité a rapporté plus
  // qu'elle n'a coûté. C'est la seule lecture qui compte, et elle doit se voir
  // sans être lue.
  const gagne = b.retour !== null && b.retour >= 1
  const couleurRetour = b.retour === null ? undefined : gagne ? '#047857' : '#DC2626'

  return (
    <li className={`${CARTE} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{c.nom}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {labelPlateforme(c.plateforme)} · du {jourCourt(c.debut)}
            {c.fin ? ` au ${jourCourt(c.fin)}` : ', en cours'} · budget {formatEuros(c.budget)} €
          </p>
        </div>
        <span
          className={`shrink-0 ${SURTITRE} px-2 py-1 rounded-lg ${
            active
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          {active ? 'En cours' : 'Terminée'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Chiffre label="Visites" valeur={String(b.visites)} />
        <Chiffre label="Réservations" valeur={String(b.reservations)} />
        <Chiffre
          label="Transformation"
          valeur={b.tauxConversion === null ? '—' : `${b.tauxConversion.toFixed(1).replace('.', ',')} %`}
        />
        <Chiffre
          label="Retour"
          aide={b.coutParReservation === null ? undefined : `${formatEuros(Math.round(b.coutParReservation * 100) / 100)} € par client`}
          valeur={b.retour === null ? '—' : `× ${b.retour.toFixed(1).replace('.', ',')}`}
          accent={couleurRetour}
        />
      </div>

      {/* La phrase qui dit tout, en toutes lettres : un laveur ne lit pas un
          tableau, il lit une conclusion. */}
      {b.reservations > 0 && (
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {formatEuros(c.budget)} € dépensés, <strong>{formatEuros(b.chiffreAffaires)} € de lavages</strong> réservés.
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <p className={`${SURTITRE} text-slate-400 dark:text-slate-500 mb-2`}>Lien à mettre dans la publicité</p>
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={lien}>
            {lien}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 1500) }}
            className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-transform active:scale-[0.97]"
            style={{ backgroundColor: BLEU }}
          >
            {copie ? 'Copié' : 'Copier'}
          </button>
          <button
            onClick={() => onSupprimer(c.id)}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </li>
  )
}

export default function CampagnesView({ campagnes, baseUrl }: {
  campagnes: CampagneAvecBilan[]
  baseUrl: string
}) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(campagnes.length === 0)
  const [nom, setNom] = useState('')
  const [plateforme, setPlateforme] = useState<Plateforme>('meta')
  const [budget, setBudget] = useState('')
  const [debut, setDebut] = useState(new Date().toLocaleDateString('en-CA'))
  const [fin, setFin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function creer() {
    setErreur(null)
    setEnCours(true)
    const res = await fetch('/api/campagnes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, plateforme, budget, debut, fin: fin || null }),
    })
    setEnCours(false)
    if (!res.ok) {
      const corps = await res.json().catch(() => ({}))
      setErreur(corps.error ?? 'Impossible de créer cette campagne')
      return
    }
    setNom(''); setBudget(''); setFin(''); setOuvert(false)
    router.refresh()
  }

  async function supprimer(id: string) {
    const res = await fetch(`/api/campagnes/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    else setErreur('Impossible de supprimer cette campagne')
  }

  const champ = 'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
  const label = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5'

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Campagnes publicitaires</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Déclarez votre campagne, collez son lien dans votre publicité, et voyez ce qu’elle vous rapporte.
        </p>
      </div>

      {erreur && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
          {erreur}
        </p>
      )}

      {ouvert ? (
        <div className={`${CARTE} p-5 space-y-4`}>
          <p className="font-bold text-slate-900 dark:text-slate-100">Nouvelle campagne</p>

          <div>
            <label className={label} htmlFor="camp-nom">Nom de la campagne</label>
            <input id="camp-nom" className={champ} value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Pub Rentrée" maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="camp-plateforme">Plateforme</label>
              <select id="camp-plateforme" className={champ} value={plateforme}
                onChange={e => setPlateforme(e.target.value as Plateforme)}>
                {PLATEFORMES.map(p => <option key={p.cle} value={p.cle}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="camp-budget">Budget investi (€)</label>
              <input id="camp-budget" className={champ} value={budget} onChange={e => setBudget(e.target.value)}
                inputMode="decimal" placeholder="80" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="camp-debut">Début</label>
              <input id="camp-debut" type="date" className={champ} value={debut} onChange={e => setDebut(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="camp-fin">Fin (facultative)</label>
              <input id="camp-fin" type="date" className={champ} value={fin} onChange={e => setFin(e.target.value)} />
            </div>
          </div>

          {/* Dit ici, pas découvert plus tard : le laveur doit savoir que ce
              montant vient de lui, sinon il nous reprochera l'écart avec ce
              que Meta lui facture. */}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Le budget est celui que vous saisissez : WashBoard ne le récupère pas auprès de la plateforme.
          </p>

          <div className="flex items-center gap-2">
            <button onClick={creer} disabled={enCours}
              className="px-5 py-3 text-white text-sm font-semibold rounded-xl transition-transform active:scale-[0.97] disabled:opacity-40"
              style={{ backgroundColor: BLEU }}>
              {enCours ? 'Création…' : 'Créer la campagne'}
            </button>
            {campagnes.length > 0 && (
              <button onClick={() => { setOuvert(false); setErreur(null) }}
                className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                Annuler
              </button>
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => setOuvert(true)}
          className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-sm font-medium transition-colors">
          + Nouvelle campagne
        </button>
      )}

      {campagnes.length > 0 && (
        <ul className="space-y-3">
          {campagnes.map(c => (
            <CarteCampagne key={c.id} c={c} baseUrl={baseUrl} onSupprimer={supprimer} />
          ))}
        </ul>
      )}

      {campagnes.length === 0 && !ouvert && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
          Aucune campagne pour l’instant.
        </p>
      )}
    </div>
  )
}
