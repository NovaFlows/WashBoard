'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, Copy, Check, Plus, Trash2, Play, ImageIcon, Images, Megaphone,
} from 'lucide-react'
import { formatEuros } from '@/lib/plan'
import {
  PLATEFORMES, FORMATS, labelPlateforme, estEnCours, lienCampagne, lienCreation,
  inventaireFormats, synthese, SEUIL_FIABILITE,
  type BilanCreation, type CampagneAffichee, type Format, type Plateforme,
} from '@/lib/campagne'

// ════════════════════════════════════════════════════════════════════════════
// L'écran des publicités, dans l'onglet CRM
// ════════════════════════════════════════════════════════════════════════════
//
// Il répond à deux questions, dans cet ordre, parce que c'est l'ordre dans
// lequel un laveur se les pose :
//
//   1. « Est-ce que la publicité me rapporte, globalement ? » → la synthèse,
//      en haut, lisible sans rien déplier.
//   2. « Laquelle de mes vidéos marche ? » → le détail par création, replié par
//      défaut, parce que c'est la question du lendemain et pas celle du jour où
//      on lance.
//
// Ce qui a guidé la mise en forme, en regardant comment le font les
// gestionnaires de publicités des grandes plateformes : une bande de totaux,
// puis une liste hiérarchique campagne → publicité, et des chiffres alignés en
// colonnes pour qu'on les compare d'un coup d'œil au lieu de les lire un par
// un. Ce qu'on ne reprend PAS d'eux : les vingt colonnes de CPM, de portée et
// de fréquence. Un laveur n'achète pas des impressions, il achète des lavages.

const BLEU = '#1651E8'
const VERT = '#047857'
const ROUGE = '#DC2626'
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.22em]'
const CARTE = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'

const ICONE_FORMAT: Record<Format, typeof Play> = {
  video: Play, image: ImageIcon, carrousel: Images, autre: Megaphone,
}

function jourCourt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  const jour = d.getUTCDate()
  const mois = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })
  // « 1er », pas « 1 » : le français l'exige, et c'est le genre de détail qui
  // décide si un écran a l'air fini ou bâclé.
  return `${jour === 1 ? '1er' : jour} ${mois}`
}

function pourcent(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(1).replace('.', ',')} %`
}

function multiple(v: number | null): string {
  return v === null ? '—' : `× ${v.toFixed(1).replace('.', ',')}`
}

/** Le retour colore l'écran : au-dessus de 1, la publicité a rapporté plus
 *  qu'elle n'a coûté. C'est la seule lecture qui compte, et elle doit se voir
 *  sans être lue.
 *
 *  Tant qu'aucune réservation n'est arrivée, le retour ne s'affiche pas : un
 *  « × 0,0 » en rouge sur une campagne lancée avant-hier la fait passer pour un
 *  échec avant qu'elle ait eu le temps d'exister. */
function couleurRetour(retour: number | null, reservations: number): string | undefined {
  if (retour === null || reservations === 0) return undefined
  return retour >= 1 ? VERT : ROUGE
}

/** Un nombre, son intitulé, et rien d'autre. */
function Chiffre({ label, valeur, aide, accent, discret }: {
  label: string
  valeur: string
  aide?: string
  accent?: string
  discret?: boolean
}) {
  return (
    <div className="min-w-0">
      <p
        className={`${discret ? 'text-base font-bold text-slate-400 dark:text-slate-500' : 'text-xl font-black'} tracking-tight truncate`}
        style={!discret && accent ? { color: accent } : undefined}
      >
        {valeur}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
      {aide && <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">{aide}</p>}
    </div>
  )
}

/** Le lien à copier, sur une ligne. */
function LigneLien({ lien, libelle }: { lien: string; libelle: string }) {
  const [copie, setCopie] = useState(false)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex-1 min-w-0 text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate" title={lien}>
        {lien}
      </span>
      <button
        onClick={() => { navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 1500) }}
        aria-label={libelle}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg text-white transition-transform duration-150 ease-out active:scale-[0.97]"
        style={{ backgroundColor: BLEU }}
      >
        {copie ? <Check size={12} strokeWidth={3} /> : <Copy size={12} strokeWidth={2.5} />}
        {copie ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
}

// ── Une vidéo ───────────────────────────────────────────────────────────────

function LigneCreation({ b, rang, lien, onSupprimer }: {
  b: BilanCreation
  rang: number
  lien: string
  onSupprimer: (id: string) => void
}) {
  const Icone = ICONE_FORMAT[b.creation.format]
  // La barre montre la PART DES CLIENTS, pas le taux : c'est la grandeur qui
  // additionne à 100 % entre les vidéos, donc la seule qu'on peut comparer
  // visuellement sans tromper.
  const part = b.partReservations ?? 0
  const meilleure = rang === 1 && b.reservations > 0

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2.5">
        <span
          className={`shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black ${
            meilleure
              ? 'text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
          }`}
          style={meilleure ? { backgroundColor: VERT } : undefined}
        >
          {rang}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icone size={13} strokeWidth={2.5} className="shrink-0 text-slate-400 dark:text-slate-500" />
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{b.creation.nom}</p>
            {meilleure && (
              <span className={`${SURTITRE} shrink-0 px-1.5 py-0.5 rounded text-white`} style={{ backgroundColor: VERT }}>
                Meilleure
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-2">
            <Chiffre label="Visites" valeur={String(b.visites)} />
            <Chiffre label="Clients" valeur={String(b.reservations)} />
            {/* Sous le seuil, le taux n'est pas affiché : 1 sur 3 donne 33 % et
                ressemble à un succès, alors que c'est du hasard. Le cacher
                empêche de couper la bonne vidéo sur un chiffre inventé. */}
            <Chiffre
              label={b.fiable ? 'Transformation' : 'Peu de données'}
              valeur={b.fiable ? pourcent(b.tauxConversion) : '—'}
              aide={b.fiable ? undefined : `dès ${SEUIL_FIABILITE} visites`}
              discret={!b.fiable}
            />
            <Chiffre
              label="Encaissé"
              valeur={`${formatEuros(b.chiffreAffaires)} €`}
              aide={b.coutParReservation === null
                ? undefined
                : `${formatEuros(Math.round(b.coutParReservation * 100) / 100)} € / client`}
            />
          </div>

          {b.partReservations !== null && (
            <div className="mt-2.5">
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.min(100, part)}%`, backgroundColor: meilleure ? VERT : BLEU }}
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {pourcent(b.partReservations)} des clients de la campagne
              </p>
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <LigneLien lien={lien} libelle={`Copier le lien de ${b.creation.nom}`} />
            <button
              onClick={() => onSupprimer(b.creation.id)}
              aria-label={`Retirer ${b.creation.nom}`}
              className="shrink-0 p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

const CHAMP = 'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
const LABEL = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5'

/** Le formulaire d'ajout d'une vidéo. Un seul champ obligatoire. */
function FormCreation({ campagneId, onFait }: { campagneId: string; onFait: () => void }) {
  const [nom, setNom] = useState('')
  const [format, setFormat] = useState<Format>('video')
  const [budget, setBudget] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function ajouter() {
    setErreur(null)
    setEnCours(true)
    const res = await fetch(`/api/campagnes/${campagneId}/creations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, format, budget: budget || null }),
    })
    setEnCours(false)
    if (!res.ok) {
      const corps = await res.json().catch(() => ({}))
      setErreur(corps.error ?? 'Impossible d’ajouter cette vidéo')
      return
    }
    setNom(''); setBudget('')
    onFait()
  }

  return (
    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
      {erreur && <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>}

      <div>
        <label className={LABEL} htmlFor={`crea-nom-${campagneId}`}>Nom de la vidéo</label>
        <input
          id={`crea-nom-${campagneId}`} className={CHAMP} value={nom} maxLength={120}
          onChange={e => setNom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nom.trim() && !enCours) ajouter() }}
          placeholder="Avant/après Clio"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor={`crea-format-${campagneId}`}>Format</label>
          <select id={`crea-format-${campagneId}`} className={CHAMP} value={format}
            onChange={e => setFormat(e.target.value as Format)}>
            {FORMATS.map(f => <option key={f.cle} value={f.cle}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor={`crea-budget-${campagneId}`}>
            Budget <span className="font-normal text-slate-400">(si connu)</span>
          </label>
          <input id={`crea-budget-${campagneId}`} className={CHAMP} value={budget}
            onChange={e => setBudget(e.target.value)} inputMode="decimal" placeholder="—" />
        </div>
      </div>

      {/* Dit ici plutôt que découvert plus tard : Meta répartit souvent le
          budget tout seul entre les publicités d'une campagne. Sans cette
          phrase, le laveur cherche un chiffre qu'il n'a pas, et abandonne. */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Laissez le budget vide si Meta répartit lui-même votre budget : les visites et les
        réservations seront comptées quand même, seul le coût par client restera inconnu.
      </p>

      <button onClick={ajouter} disabled={enCours || !nom.trim()}
        className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
        style={{ backgroundColor: BLEU }}>
        {enCours ? 'Ajout…' : 'Ajouter cette vidéo'}
      </button>
    </div>
  )
}

// ── Une campagne ────────────────────────────────────────────────────────────

function CarteCampagne({ c, baseUrl, onSupprimer, onRafraichir }: {
  c: CampagneAffichee
  baseUrl: string
  onSupprimer: (id: string) => void
  onRafraichir: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [ajout, setAjout] = useState(false)
  const aujourdHui = new Date().toLocaleDateString('en-CA')
  const active = estEnCours(c, aujourdHui)
  const b = c.bilan
  const couleur = couleurRetour(b.retour, b.reservations)
  const mesurable = b.retour !== null && b.reservations > 0

  async function supprimerCreation(id: string) {
    const res = await fetch(`/api/campagnes/${c.id}/creations/${id}`, { method: 'DELETE' })
    if (res.ok) onRafraichir()
  }

  return (
    <li className={`${CARTE} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{c.nom}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {labelPlateforme(c.plateforme)} · du {jourCourt(c.debut)}
            {c.fin ? ` au ${jourCourt(c.fin)}` : ', en cours'}
            {c.creations.length > 0 && ` · ${inventaireFormats(c.creations.map(x => x.creation))}`}
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        <Chiffre label="Investi" valeur={`${formatEuros(c.budget)} €`} />
        <Chiffre label="Encaissé" valeur={`${formatEuros(b.chiffreAffaires)} €`} />
        <Chiffre
          label="Retour"
          valeur={mesurable ? multiple(b.retour) : '—'}
          aide={b.coutParReservation === null
            ? undefined
            : `${formatEuros(Math.round(b.coutParReservation * 100) / 100)} € / client`}
          accent={couleur}
        />
        <Chiffre label="Visites" valeur={String(b.visites)} />
        <Chiffre label="Clients" valeur={String(b.reservations)} />
      </div>

      {/* La phrase qui dit tout, en toutes lettres : un laveur ne lit pas un
          tableau, il lit une conclusion. */}
      {b.reservations > 0 && (
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {formatEuros(c.budget)} € dépensés, <strong>{formatEuros(b.chiffreAffaires)} € de lavages</strong> réservés
          {b.tauxConversion !== null && b.visites >= SEUIL_FIABILITE
            && <> — {pourcent(b.tauxConversion)} des visiteurs ont réservé</>}.
        </p>
      )}

      {/* ── Le détail par vidéo ─────────────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setOuvert(o => !o)}
          aria-expanded={ouvert}
          className="w-full flex items-center justify-between gap-2 text-left group"
        >
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {c.creations.length === 0
              ? 'Suivre chaque vidéo séparément'
              : `Vos vidéos (${c.creations.length})`}
          </span>
          <ChevronDown
            size={16} strokeWidth={2.5}
            className={`shrink-0 text-slate-400 transition-transform duration-200 ease-out ${ouvert ? 'rotate-180' : ''}`}
          />
        </button>

        {ouvert && (
          <div className="mt-3">
            {c.creations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Une campagne qui diffuse trois vidéos ne vous donne qu’une moyenne. Déclarez-les
                ici, collez le lien de chacune sous la vidéo correspondante, et vous verrez
                laquelle amène vos clients — au lieu de couper les trois ensemble.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {c.creations.map((x, i) => (
                  <LigneCreation
                    key={x.creation.id}
                    b={x}
                    rang={i + 1}
                    lien={lienCreation(baseUrl, c.cle, x.creation.cle, c.plateforme)}
                    onSupprimer={supprimerCreation}
                  />
                ))}
              </ul>
            )}

            {/* Ce que les vidéos déclarées n'expliquent pas. Affiché plutôt que
                caché : celui qui déclare ses vidéos trois jours après le
                lancement verrait sinon une somme qui ne fait pas le total, et il
                aurait raison de ne plus croire l'écran. */}
            {c.creations.length > 0 && c.reste.visites > 0 && (
              <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                {c.reste.visites} visite{c.reste.visites > 1 ? 's' : ''}
                {c.reste.reservations > 0 && ` et ${c.reste.reservations} client${c.reste.reservations > 1 ? 's' : ''}`}
                {' '}sans vidéo identifiée — du trafic arrivé par le lien de la campagne, avant que
                vous ne déclariez vos vidéos ou par une vidéo retirée depuis.
              </p>
            )}

            {ajout
              ? <FormCreation campagneId={c.id} onFait={() => { setAjout(false); onRafraichir() }} />
              : (
                <button
                  onClick={() => setAjout(true)}
                  className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Ajouter une vidéo
                </button>
              )}
          </div>
        )}
      </div>

      {/* ── Le lien de la campagne entière ──────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className={`${SURTITRE} text-slate-400 dark:text-slate-500 mb-2`}>
          Lien de la campagne {c.creations.length > 0 && <span className="font-medium normal-case tracking-normal">— à n’utiliser que si vous ne suivez pas les vidéos une par une</span>}
        </p>
        <div className="flex items-center gap-2">
          <LigneLien lien={lienCampagne(baseUrl, c.cle, c.plateforme)} libelle={`Copier le lien de ${c.nom}`} />
          <button
            onClick={() => onSupprimer(c.id)}
            className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </li>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

type Filtre = 'toutes' | 'encours' | 'terminees'

const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: 'toutes',    label: 'Toutes' },
  { cle: 'encours',   label: 'En cours' },
  { cle: 'terminees', label: 'Terminées' },
]

export default function CampagnesView({ campagnes, baseUrl, accent }: {
  campagnes: CampagneAffichee[]
  baseUrl: string
  accent?: string
}) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(campagnes.length === 0)
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [nom, setNom] = useState('')
  const [plateforme, setPlateforme] = useState<Plateforme>('meta')
  const [budget, setBudget] = useState('')
  const [debut, setDebut] = useState(new Date().toLocaleDateString('en-CA'))
  const [fin, setFin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const aujourdHui = new Date().toLocaleDateString('en-CA')

  const visibles = useMemo(() => campagnes.filter(c => {
    if (filtre === 'encours') return estEnCours(c, aujourdHui)
    if (filtre === 'terminees') return !estEnCours(c, aujourdHui)
    return true
  }), [campagnes, filtre, aujourdHui])

  // La synthèse porte sur ce qui est AFFICHÉ, pas sur tout : filtrer sur « en
  // cours » et lire un total qui compte les campagnes terminées ferait un écran
  // qui se contredit lui-même.
  const totaux = useMemo(
    () => synthese(visibles.map(c => c.bilan), visibles.map(c => c.budget)),
    [visibles],
  )

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

  const couleurTotal = couleurRetour(totaux.retour, totaux.reservations)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Publicités</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ce que vous dépensez, ce que ça rapporte, et laquelle de vos vidéos y est pour quelque chose.
          </p>
        </div>
        {!ouvert && (
          <button onClick={() => setOuvert(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-white text-sm font-semibold rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
            style={{ backgroundColor: BLEU }}>
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Nouvelle campagne</span>
          </button>
        )}
      </div>

      {erreur && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
          {erreur}
        </p>
      )}

      {/* ── La synthèse, lisible sans rien déplier ───────────────────────── */}
      {campagnes.length > 0 && (
        <div className={`${CARTE} p-4 sm:p-5`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Chiffre label="Investi" valeur={`${formatEuros(totaux.budget)} €`} />
            <Chiffre label="Encaissé" valeur={`${formatEuros(totaux.chiffreAffaires)} €`} accent={accent} />
            <Chiffre
              label="Retour"
              valeur={totaux.reservations > 0 ? multiple(totaux.retour) : '—'}
              accent={couleurTotal}
            />
            <Chiffre
              label="Clients"
              valeur={String(totaux.reservations)}
              aide={totaux.coutParReservation === null
                ? undefined
                : `${formatEuros(Math.round(totaux.coutParReservation * 100) / 100)} € chacun`}
            />
          </div>

          {totaux.reservations > 0 && totaux.retour !== null && (
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Pour 1 € de publicité, vous avez encaissé{' '}
              <strong style={couleurTotal ? { color: couleurTotal } : undefined}>
                {formatEuros(Math.round(totaux.retour * 100) / 100)} €
              </strong>{' '}
              de lavages.
            </p>
          )}
        </div>
      )}

      {/* ── Le formulaire de campagne ────────────────────────────────────── */}
      {ouvert && (
        <div className={`${CARTE} p-5 space-y-4`}>
          <p className="font-bold text-slate-900 dark:text-slate-100">Nouvelle campagne</p>

          <div>
            <label className={LABEL} htmlFor="camp-nom">Nom de la campagne</label>
            <input id="camp-nom" className={CHAMP} value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Pub Rentrée" maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="camp-plateforme">Plateforme</label>
              <select id="camp-plateforme" className={CHAMP} value={plateforme}
                onChange={e => setPlateforme(e.target.value as Plateforme)}>
                {PLATEFORMES.map(p => <option key={p.cle} value={p.cle}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="camp-budget">Budget investi (€)</label>
              <input id="camp-budget" className={CHAMP} value={budget} onChange={e => setBudget(e.target.value)}
                inputMode="decimal" placeholder="80" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="camp-debut">Début</label>
              <input id="camp-debut" type="date" className={CHAMP} value={debut} onChange={e => setDebut(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="camp-fin">Fin (facultative)</label>
              <input id="camp-fin" type="date" className={CHAMP} value={fin} onChange={e => setFin(e.target.value)} />
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
              className="px-5 py-3 text-white text-sm font-semibold rounded-xl transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
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
      )}

      {/* ── Le filtre, seulement quand il sert ───────────────────────────── */}
      {campagnes.length > 1 && (
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {FILTRES.map(f => (
            <button
              key={f.cle}
              onClick={() => setFiltre(f.cle)}
              aria-pressed={filtre === f.cle}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-[background-color,color] duration-150 ease-out ${
                filtre === f.cle
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {visibles.length > 0 && (
        <ul className="space-y-3">
          {visibles.map(c => (
            <CarteCampagne
              key={c.id}
              c={c}
              baseUrl={baseUrl}
              onSupprimer={supprimer}
              onRafraichir={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      {campagnes.length > 0 && visibles.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
          Aucune campagne {filtre === 'encours' ? 'en cours' : 'terminée'}.
        </p>
      )}

      {campagnes.length === 0 && !ouvert && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
          Aucune campagne pour l’instant.
        </p>
      )}
    </div>
  )
}
