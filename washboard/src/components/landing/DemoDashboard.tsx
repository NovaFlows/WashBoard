'use client'

import { useRef, useState, type JSX } from 'react'

// Démo manipulable du tableau de bord, posée sur la landing publique.
//
// Pourquoi ce composant existe : jusqu'ici la section « Le produit en vrai »
// ne montrait que des captures d'écran (`/landing/crm-*.webp`). Le visiteur
// regardait l'interface, il ne la touchait pas. Demande d'Alexandre lors du
// chantier `refonte/landing-vitrine` : que le laveur puisse essayer le
// produit depuis la page, sans créer de compte — la landing devient l'outil
// de démo commercial.
//
// IMPORTANT — aucune donnée réelle, aucun appel réseau :
// tout ce qui s'affiche ici est figé dans ce fichier. Pas de Supabase, pas
// de compte de démonstration, pas de fetch. Les noms sont fictifs et les
// montants illustratifs, dans le même esprit que les mockups déjà présents
// sur la page (voir PARCOURS_TOUT_EN_UN dans LandingPage.tsx) — ce ne sont
// pas des chiffres commerciaux, ceux-là vivent dans `lib/plan.ts`.
//
// Les 4 destinations sont EXACTEMENT celles du vrai produit (Aujourd'hui /
// Agenda / Clients / Chiffres, cf. RailBureauV2.tsx) : rien d'inventé, sinon
// la démo promettrait une interface qui n'existe pas.
//
// Le ressort de la démo : UN seul état partagé (`fait` — la prestation de
// Karim marquée Terminée ou non) se répercute dans les quatre écrans. C'est
// l'argument « tout-en-un » montré plutôt que raconté : une action, et
// l'agenda, la liste du jour, la fiche client et les chiffres bougent
// ensemble.

const ONGLETS = [
  { id: 'aujourdhui', label: "Aujourd'hui", icone: 'M4 11l8-7 8 7M6 10v10h12V10' },
  { id: 'agenda', label: 'Agenda', icone: 'M7 3v3M17 3v3M4 8h16M4 6h16v14H4V6zM8 12h3M13 12h3M8 16h3' },
  { id: 'clients', label: 'Clients', icone: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16.5 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 14.2c2.3.4 4 2 4 5.8' },
  { id: 'chiffres', label: 'Chiffres', icone: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
] as const

type OngletId = (typeof ONGLETS)[number]['id']
type OngletClient = 'profil' | 'historique' | 'notes'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'] as const

const CHECK = 'M5 13l4 4L19 7'
const MAIL = 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3.5 6.5l8.5 6 8.5-6'
const TEL = 'M7.5 3.5l2.4 4.2a1 1 0 01-.2 1.25l-1.8 1.5a12.5 12.5 0 005.6 5.6l1.5-1.8a1 1 0 011.25-.2l4.2 2.4a1 1 0 01.5 1V20a1 1 0 01-1 1C9.6 21 3 14.4 3 6a1 1 0 011-1h2.75a1 1 0 01.75.5z'

function Icone({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

// Styles de pastille d'état, repris des trois états réels d'une réservation.
const ETAT_STYLES = {
  confirme: 'bg-[#1651E8]/10 text-[#1651E8] dark:bg-[#6A9FFF]/15 dark:text-[#6A9FFF]',
  attente: 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  termine: 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
} as const

type Etat = keyof typeof ETAT_STYLES

const CARTE = 'rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50'

function Stat({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className={`${CARTE} px-2 py-2.5 text-center`}>
      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{libelle}</span>
      <b className="mt-0.5 block font-mono text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">{valeur}</b>
    </div>
  )
}

function TitreVue({ titre, apart }: { titre: string; apart: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{titre}</h3>
      <span className="text-xs text-slate-400 dark:text-slate-500">{apart}</span>
    </div>
  )
}

export default function DemoDashboard() {
  const [onglet, setOnglet] = useState<OngletId>('agenda')
  const [fait, setFait] = useState(false)
  const [ongletClient, setOngletClient] = useState<OngletClient>('profil')
  const [notes, setNotes] = useState('Portail à code 1420, préfère le samedi matin.')
  const [pulseEnregistre, setPulseEnregistre] = useState(false)
  const minuteurNotes = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Le « Enregistré ✓ » est un leurre assumé : rien ne part sur le réseau,
  // c'est le retour visuel du vrai produit qu'on reproduit pour que la
  // démo ne paraisse pas cassée quand on tape dans la zone de notes.
  const changerNotes = (valeur: string) => {
    setNotes(valeur)
    setPulseEnregistre(true)
    if (minuteurNotes.current) clearTimeout(minuteurNotes.current)
    minuteurNotes.current = setTimeout(() => setPulseEnregistre(false), 1100)
  }

  // Tous les chiffres dérivent de `fait` : c'est ce qui fait que marquer
  // Terminé dans l'agenda change réellement la fiche client et les chiffres,
  // au lieu d'afficher quatre écrans indépendants.
  const visitesPassees = [
    { prestation: 'Lavage complet', date: 'il y a 96 jours', prix: 42, etat: 'termine' as Etat },
    { prestation: 'Lavage extérieur', date: 'il y a 140 jours', prix: 32, etat: 'termine' as Etat },
  ]
  const visiteDuJour = fait
    ? { prestation: 'Lavage complet', date: "Aujourd'hui", prix: 45, etat: 'termine' as Etat, nouvelle: true }
    : { prestation: 'Lavage complet', date: "Aujourd'hui · 11:30", prix: 45, etat: 'confirme' as Etat, nouvelle: false }
  const historique = [visiteDuJour, ...visitesPassees]
  const terminees = historique.filter((v) => v.etat === 'termine')
  const nbLavages = terminees.length
  const total = terminees.reduce((s, v) => s + v.prix, 0)
  const panierMoyen = nbLavages ? Math.round(total / nbLavages) : 0
  const ceMois = fait ? 27 : 26
  const encaisse = fait ? 1225 : 1180

  const allerA = (id: OngletId, sousOnglet?: OngletClient) => {
    setOnglet(id)
    if (sousOnglet) setOngletClient(sousOnglet)
  }

  const Banniere = () => (
    <div className="mt-4 rounded-xl bg-emerald-600/10 px-3 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
      <div className="flex items-center gap-1.5">
        <Icone d={CHECK} />
        <span>La fiche client et les chiffres se sont mis à jour.</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-4">
        <button type="button" onClick={() => allerA('clients', 'historique')} className="text-xs font-bold text-[#1651E8] underline underline-offset-4 dark:text-[#6A9FFF]">
          Voir la fiche →
        </button>
        <button type="button" onClick={() => allerA('chiffres')} className="text-xs font-bold text-[#1651E8] underline underline-offset-4 dark:text-[#6A9FFF]">
          Voir les chiffres →
        </button>
      </div>
    </div>
  )

  const Aujourdhui = () => (
    <>
      <TitreVue titre="Jeudi 14" apart={fait ? '3 rendez-vous · 1 terminé' : '3 rendez-vous'} />
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat libelle="Aujourd'hui" valeur="3" />
        <Stat libelle="À confirmer" valeur="1" />
        <Stat libelle="Ce mois" valeur={String(ceMois)} />
      </div>
      <div className="space-y-2">
        {[
          { heure: '09:00', nom: 'D. Fabre', presta: 'Lavage extérieur', etat: 'confirme' as Etat, libelle: 'Confirmé' },
          {
            heure: '11:30', nom: 'Karim D.', presta: 'Lavage complet',
            etat: (fait ? 'termine' : 'confirme') as Etat, libelle: fait ? 'Terminé' : 'Confirmé',
          },
          { heure: '15:30', nom: 'S. Mercier', presta: 'Lavage intérieur', etat: 'attente' as Etat, libelle: 'En attente' },
        ].map((r) => (
          <div key={r.heure} className={`${CARTE} flex items-center gap-3 px-3 py-2.5`}>
            <time className="w-12 shrink-0 font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">{r.heure}</time>
            <div className="min-w-0 flex-1">
              <b className="block text-sm font-bold text-slate-900 dark:text-white">{r.nom}</b>
              <span className="text-xs text-slate-400 dark:text-slate-500">{r.presta}</span>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-extrabold ${ETAT_STYLES[r.etat]}`}>{r.libelle}</span>
          </div>
        ))}
      </div>
    </>
  )

  const Agenda = () => {
    const semaine: { heure: string; nom: string; etat: Etat; karim?: boolean }[][] = [
      [{ heure: '09:00', nom: 'D. Fabre', etat: 'confirme' }],
      [],
      [{ heure: '14:00', nom: 'S. Mercier', etat: 'attente' }],
      [{ heure: '11:30', nom: 'Karim D.', etat: fait ? 'termine' : 'confirme', karim: true }],
      [{ heure: '10:00', nom: 'T. Royer', etat: 'confirme' }],
    ]
    return (
      <>
        <TitreVue titre="Cette semaine" apart="Bordeaux · zone Nord" />
        <div className="grid grid-cols-5 gap-2">
          {JOURS.map((jour, i) => (
            <div key={jour} className="min-w-0">
              <h4 className="mb-1.5 text-center text-[0.68rem] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">{jour}</h4>
              <div className="space-y-1.5">
                {semaine[i].map((bloc) => (
                  <div key={bloc.heure} className={`rounded-lg px-1.5 py-1.5 text-center text-[0.7rem] font-semibold ${ETAT_STYLES[bloc.etat]}`}>
                    <b className="block font-mono text-[0.66rem] tabular-nums opacity-75">{bloc.heure}</b>
                    <span className="block truncate">{bloc.nom}</span>
                    {bloc.karim && !fait && (
                      <button
                        type="button"
                        onClick={() => setFait(true)}
                        className="mt-1.5 w-full rounded-md border border-current px-1 py-1 text-[0.66rem] font-extrabold transition-colors hover:bg-[#1651E8]/10 dark:hover:bg-[#6A9FFF]/15"
                      >
                        Terminer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {fait && <Banniere />}
      </>
    )
  }

  const Clients = () => (
    <>
      <TitreVue titre="Fiche client" apart="Exemple illustratif" />
      <div className={`${CARTE} p-4`}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#00C4D4] to-[#1651E8]" aria-hidden="true" />
          <div>
            <div className="font-extrabold text-slate-900 dark:text-white">Karim D.</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{fait ? "Vu aujourd'hui" : 'Pas revenu depuis 96 jours'}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 border-b border-slate-200 pb-2.5 dark:border-slate-800" role="tablist" aria-label="Fiche client">
          {([['profil', 'Profil'], ['historique', 'Historique'], ['notes', 'Notes']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ongletClient === id}
              onClick={() => setOngletClient(id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                ongletClient === id
                  ? 'bg-[#1651E8]/10 text-[#1651E8] dark:bg-[#6A9FFF]/15 dark:text-[#6A9FFF]'
                  : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-[9.5rem] pt-3.5">
          {ongletClient === 'profil' && (
            <>
              <p
                className={`mb-3 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold ${
                  fait
                    ? 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                    : 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
                }`}
              >
                {fait && <Icone d={CHECK} />}
                {fait ? "Vu aujourd'hui — la relance à 90 jours ne se déclenchera pas." : 'Pas revenu depuis 96 jours — bon candidat à une relance.'}
              </p>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <Stat libelle="Lavages" valeur={String(nbLavages)} />
                <Stat libelle="Total" valeur={`${total}€`} />
                <Stat libelle="Panier moyen" valeur={`${panierMoyen}€`} />
              </div>
              {/* Coordonnées volontairement en `exemple.fr` / 06 00 00 00 00 :
                  jamais de vrai contact dans une démo publique. */}
              <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <p className="flex items-center gap-2"><Icone d={MAIL} />karim.d@exemple.fr</p>
                <p className="flex items-center gap-2"><Icone d={TEL} />06 00 00 00 00</p>
              </div>
            </>
          )}

          {ongletClient === 'historique' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {historique.map((v) => (
                <div key={v.date} className="flex justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{v.prestation}</p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{v.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">{v.prix}€</p>
                    <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.66rem] font-extrabold ${ETAT_STYLES[v.etat]}`}>
                      {v.etat === 'termine' ? 'Terminé' : 'Confirmé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {ongletClient === 'notes' && (
            <div>
              <label htmlFor="demo-notes" className="sr-only">Note interne sur ce client</label>
              <textarea
                id="demo-notes"
                rows={3}
                value={notes}
                onChange={(e) => changerNotes(e.target.value)}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:border-[#1651E8] focus:ring-2 focus:ring-[#1651E8]/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-[#6A9FFF] dark:focus:ring-[#6A9FFF]/30"
              />
              <p
                aria-live="polite"
                className={`mt-2 text-xs ${pulseEnregistre ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}
              >
                {pulseEnregistre ? 'Enregistré ✓' : 'Note interne — visible seulement par toi.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )

  const Chiffres = () => (
    <>
      <TitreVue titre="Ce mois-ci" apart="Exemple illustratif" />
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat libelle="Prestations" valeur={String(ceMois)} />
        <Stat libelle="Encaissé" valeur={`${encaisse}€`} />
        <Stat libelle="Panier moyen" valeur="42€" />
      </div>
      {!fait ? (
        <div className={`${CARTE} border-dashed p-4 text-sm text-slate-500 dark:text-slate-400`}>
          <p className="mb-1.5 font-bold text-slate-900 dark:text-white">Facture de Karim D. — en attente</p>
          <p className="leading-relaxed">Elle part automatiquement dès que la prestation est marquée Terminée dans l&apos;agenda.</p>
          <button
            type="button"
            onClick={() => setOnglet('agenda')}
            className="mt-3 text-xs font-bold text-[#1651E8] underline underline-offset-4 dark:text-[#6A9FFF]"
          >
            Aller marquer Terminé →
          </button>
        </div>
      ) : (
        <div className={`${CARTE} p-4 text-sm`}>
          <p className="mb-2 font-bold text-slate-900 dark:text-white">Facture de Karim D.</p>
          <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400"><span>Lavage complet</span><span className="font-mono tabular-nums">45,00€</span></div>
          <div className="flex justify-between py-1 text-slate-500 dark:text-slate-400"><span>Frais de déplacement</span><span className="font-mono tabular-nums">0,00€</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-mono font-extrabold tabular-nums text-slate-900 dark:border-slate-700 dark:text-white"><span>Total TTC</span><span>45,00€</span></div>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <Icone d={CHECK} />Envoyée automatiquement
          </p>
        </div>
      )}
    </>
  )

  const VUES: Record<OngletId, () => JSX.Element> = {
    aujourdhui: Aujourdhui,
    agenda: Agenda,
    clients: Clients,
    chiffres: Chiffres,
  }
  const Vue = VUES[onglet]

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:flex">
      {/* Colonne de navigation : horizontale et défilable sur téléphone,
          verticale dès `sm`, comme le rail du vrai dashboard. */}
      <div
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40 sm:w-44 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
        role="tablist"
        aria-label="Démonstration du tableau de bord"
      >
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
              onglet === o.id
                ? 'bg-[#1651E8] text-white dark:bg-[#6A9FFF] dark:text-slate-950'
                : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
            }`}
          >
            <Icone d={o.icone} />
            {o.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <Vue />
      </div>
    </div>
  )
}
