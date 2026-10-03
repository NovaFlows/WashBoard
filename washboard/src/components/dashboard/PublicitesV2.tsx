'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Copy, Check, Plus, AlertTriangle, Clock } from 'lucide-react'
import { Repliable } from '@/components/dashboard/PrestationsUiV2'
import { Feuille, BOUTON } from '@/components/dashboard/FeuilleV2'
import { formatEuros } from '@/lib/plan'
import {
  PLATEFORMES, FORMATS, labelPlateforme, estEnCours, lienCampagne, lienCreation,
  inventaireFormats, synthese, joursDepuisBudget, budgetAVerifier, SEUIL_FIABILITE,
  type BilanCreation, type CampagneAffichee, type Format, type Plateforme,
} from '@/lib/campagne'

// « Publicités » — l'écran de l'application installée (v2).
//
// Même matière que l'onglet du CRM côté site : les mêmes fonctions de calcul,
// les mêmes règles, les mêmes chiffres. Seule la présentation change, parce que
// la direction artistique de la refonte n'est pas celle du site — fond papier,
// surfaces blanches, filets à 6 %, Archivo, et des listes plutôt que des
// grilles.
//
// Ce que la v2 impose et qui change vraiment la mise en page :
//  · pas de tableau à quatre colonnes — à 390 px de large, une ligne par
//    chiffre se lit, quatre colonnes se déchiffrent ;
//  · les formulaires vivent en feuilles glissantes, pas en blocs qui poussent
//    le contenu vers le bas ;
//  · un seul niveau de repli, celui des vidéos, parce que c'est la seule chose
//    qu'on ne regarde pas à chaque visite.
//
// L'écran se range dans « Automatismes », avec les avis et les relances : ce
// sont les trois choses qui travaillent pendant que le laveur lave.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

const CHAMP = `h-11 w-full rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[15px] ${corps} text-[color:var(--v2-color-encre)] outline-none focus:border-[color:var(--v2-color-accent)]`
const ETIQUETTE = `mb-1.5 block text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`

function jourCourt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  const j = d.getUTCDate()
  const m = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })
  return `${j === 1 ? '1er' : j} ${m}`
}

const pourcent = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')} %`)
const multiple = (v: number | null) => (v === null ? '—' : `× ${v.toFixed(1).replace('.', ',')}`)

/** Vert au-dessus de 1, rouge en dessous — mais seulement quand il y a eu au
 *  moins un client. Un « × 0,0 » rouge sur une campagne lancée avant-hier la
 *  condamne avant qu'elle ait eu le temps d'exister. */
function couleurRetour(retour: number | null, reservations: number): string | undefined {
  if (retour === null || reservations === 0) return undefined
  return retour >= 1 ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)'
}

function Carte({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
      {children}
    </div>
  )
}

/** Une mesure, sur une ligne : l'intitulé à gauche, le chiffre à droite.
 *
 *  En ligne et pas en colonnes : à la largeur d'un téléphone, quatre colonnes
 *  coupent « Transformation » en trois morceaux. Une liste se lit d'une
 *  traite, et l'œil compare les chiffres alignés à droite. */
function Mesure({ label, valeur, aide, couleur, pale }: {
  label: string
  valeur: string
  aide?: string
  couleur?: string
  pale?: boolean
}) {
  return (
    <div className="flex min-h-11 items-baseline gap-3 py-1.5">
      <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{label}</span>
      <span className="ml-auto text-right">
        <span
          className={`text-[17px] ${pale ? corps : corpsFort}`}
          style={{ color: couleur ?? (pale ? 'var(--v2-color-gris)' : 'var(--v2-color-encre)') }}
        >
          {valeur}
        </span>
        {aide && (
          <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{aide}</span>
        )}
      </span>
    </div>
  )
}

function LienCopiable({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 1500) }}
      className="flex min-h-11 w-full items-center gap-2 text-left transition-transform active:scale-[.99]"
      style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
    >
      <span className={`min-w-0 flex-1 truncate text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{lien}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 text-[13px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
        {copie ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
        {copie ? 'Copié' : 'Copier'}
      </span>
    </button>
  )
}

// ── Une vidéo ───────────────────────────────────────────────────────────────

function Video({ b, rang, lien }: { b: BilanCreation; rang: number; lien: string }) {
  const meilleure = rang === 1 && b.reservations > 0
  const part = b.partReservations ?? 0

  return (
    <li className="border-t border-[color:var(--v2-filet)] py-3 first:border-t-0">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--v2-radius-pilule)] text-[12px] ${corpsFort}`}
          style={meilleure
            ? { background: 'var(--v2-color-vert)', color: 'var(--v2-color-surface)' }
            : { background: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }}
        >
          {rang}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[15px] ${nom}`}>{b.creation.nom}</span>
        {meilleure && (
          <span
            className={`shrink-0 rounded-[var(--v2-radius-pilule)] px-2 py-0.5 text-[11px] ${corpsFort}`}
            style={{ background: 'var(--v2-color-vert)', color: 'var(--v2-color-surface)' }}
          >
            Meilleure
          </span>
        )}
      </div>

      <div className="mt-1 pl-8">
        <Mesure label="Visites" valeur={String(b.visites)} />
        <Mesure label="Clients" valeur={String(b.reservations)} />
        {/* Sous le seuil, le taux ne s'affiche pas : 1 client sur 3 visites
            donne 33 % et ressemble à un succès, alors que c'est du hasard.
            L'afficher ferait couper la bonne vidéo. */}
        <Mesure
          label={b.fiable ? 'Transformation' : 'Transformation'}
          valeur={b.fiable ? pourcent(b.tauxConversion) : 'Peu de données'}
          aide={b.fiable ? undefined : `dès ${SEUIL_FIABILITE} visites`}
          pale={!b.fiable}
        />
        <Mesure
          label="Encaissé"
          valeur={`${formatEuros(b.chiffreAffaires)} €`}
          aide={b.coutParReservation === null
            ? undefined
            : `${formatEuros(Math.round(b.coutParReservation * 100) / 100)} € par client`}
        />

        {b.partReservations !== null && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-[var(--v2-radius-pilule)]" style={{ background: 'var(--v2-filet-fort)' }}>
              <div
                className="h-full rounded-[var(--v2-radius-pilule)]"
                style={{
                  width: `${Math.min(100, part)}%`,
                  background: meilleure ? 'var(--v2-color-vert)' : 'var(--v2-color-accent)',
                  transitionDuration: 'var(--v2-duration-press)',
                }}
              />
            </div>
            <p className={`mt-1 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {pourcent(b.partReservations)} des clients de la campagne
            </p>
          </div>
        )}

        <div className="mt-1">
          <LienCopiable lien={lien} />
        </div>
      </div>
    </li>
  )
}

// ── Les feuilles ────────────────────────────────────────────────────────────

function FeuilleCampagne({ campagne, onClose, onFait }: {
  /** `null` = création. Sinon, modification de celle-ci. */
  campagne: CampagneAffichee | null
  onClose: () => void
  onFait: () => void
}) {
  const [nomChamp, setNomChamp] = useState(campagne?.nom ?? '')
  const [plateforme, setPlateforme] = useState<Plateforme>(campagne?.plateforme ?? 'meta')
  const [budget, setBudget] = useState(campagne ? String(campagne.budget) : '')
  const [debut, setDebut] = useState(campagne?.debut ?? new Date().toLocaleDateString('en-CA'))
  const [fin, setFin] = useState(campagne?.fin ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function enregistrer() {
    setErreur(null)
    setEnCours(true)
    const res = await fetch(campagne ? `/api/campagnes/${campagne.id}` : '/api/campagnes', {
      method: campagne ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nomChamp, plateforme, budget, debut, fin: fin || null }),
    })
    setEnCours(false)
    if (!res.ok) {
      const corpsRep = await res.json().catch(() => ({}))
      setErreur(corpsRep.error ?? 'Impossible d’enregistrer')
      return
    }
    onFait()
  }

  return (
    <Feuille
      titre={campagne ? 'Modifier la campagne' : 'Nouvelle campagne'}
      onClose={onClose}
      verrou="campagnes"
      pied={
        <button
          onClick={enregistrer}
          disabled={enCours || !nomChamp.trim()}
          className={`${BOUTON} w-full`}
          style={{ background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }}
        >
          {enCours ? 'Enregistrement…' : campagne ? 'Enregistrer' : 'Créer la campagne'}
        </button>
      }
    >
      <div className="space-y-4 pb-2">
        {erreur && (
          <p className={`text-[13px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>
        )}

        <div>
          <label className={ETIQUETTE} htmlFor="v2-camp-nom">Nom</label>
          <input id="v2-camp-nom" className={CHAMP} value={nomChamp} maxLength={120}
            onChange={e => setNomChamp(e.target.value)} placeholder="Pub Rentrée" />
        </div>

        {!campagne && (
          <div>
            <label className={ETIQUETTE} htmlFor="v2-camp-plateforme">Plateforme</label>
            <select id="v2-camp-plateforme" className={CHAMP} value={plateforme}
              onChange={e => setPlateforme(e.target.value as Plateforme)}>
              {PLATEFORMES.map(p => <option key={p.cle} value={p.cle}>{p.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={ETIQUETTE} htmlFor="v2-camp-budget">Budget dépensé à ce jour (€)</label>
          <input id="v2-camp-budget" className={CHAMP} value={budget} inputMode="decimal"
            onChange={e => setBudget(e.target.value)} placeholder="80" />
          <p className={`mt-1.5 text-[12.5px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
            Le montant TOTAL dépensé depuis le début. Recopiez-le depuis votre gestionnaire de
            publicités : c’est lui qui sert à calculer ce que chaque client vous a coûté. WashBoard
            ne va pas le chercher tout seul.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ETIQUETTE} htmlFor="v2-camp-debut">Début</label>
            <input id="v2-camp-debut" type="date" className={CHAMP} value={debut}
              onChange={e => setDebut(e.target.value)} />
          </div>
          <div>
            <label className={ETIQUETTE} htmlFor="v2-camp-fin">Fin</label>
            <input id="v2-camp-fin" type="date" className={CHAMP} value={fin}
              onChange={e => setFin(e.target.value)} />
          </div>
        </div>

        {/* Vider la date remet la campagne en durée indéterminée — l'état
            normal d'une publicité qu'on laisse tourner, et qu'on ne devine pas
            en regardant un champ date. */}
        <button
          type="button"
          onClick={() => setFin('')}
          disabled={!fin}
          className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-accent)] disabled:opacity-40`}
        >
          Sans fin prévue
        </button>

        <p
          className={`rounded-[var(--v2-radius-bouton)] px-3 py-2.5 text-[12.5px] leading-relaxed ${corps}`}
          style={{ background: 'var(--v2-color-fond)', color: 'var(--v2-color-gris)' }}
        >
          <span className={corpsFort} style={{ color: 'var(--v2-color-encre)' }}>Vos liens ne changent jamais.</span>{' '}
          Rallonger la campagne ou corriger le budget ne touche pas à l’adresse déjà en ligne dans
          votre publicité : l’algorithme de la plateforme ne repart pas de zéro.
        </p>
      </div>
    </Feuille>
  )
}

function FeuilleVideo({ campagneId, onClose, onFait }: {
  campagneId: string
  onClose: () => void
  onFait: () => void
}) {
  const [nomChamp, setNomChamp] = useState('')
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
      body: JSON.stringify({ nom: nomChamp, format, budget: budget || null }),
    })
    setEnCours(false)
    if (!res.ok) {
      const corpsRep = await res.json().catch(() => ({}))
      setErreur(corpsRep.error ?? 'Impossible d’ajouter cette vidéo')
      return
    }
    onFait()
  }

  return (
    <Feuille
      titre="Ajouter une vidéo"
      sousTitre="Un lien par vidéo, pour savoir laquelle marche"
      onClose={onClose}
      verrou="campagnes"
      pied={
        <button
          onClick={ajouter}
          disabled={enCours || !nomChamp.trim()}
          className={`${BOUTON} w-full`}
          style={{ background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }}
        >
          {enCours ? 'Ajout…' : 'Ajouter'}
        </button>
      }
    >
      <div className="space-y-4 pb-2">
        {erreur && (
          <p className={`text-[13px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>
        )}

        <div>
          <label className={ETIQUETTE} htmlFor="v2-crea-nom">Nom de la vidéo</label>
          <input id="v2-crea-nom" className={CHAMP} value={nomChamp} maxLength={120}
            onChange={e => setNomChamp(e.target.value)} placeholder="Avant/après Clio" />
        </div>

        <div>
          <label className={ETIQUETTE} htmlFor="v2-crea-format">Format</label>
          <select id="v2-crea-format" className={CHAMP} value={format}
            onChange={e => setFormat(e.target.value as Format)}>
            {FORMATS.map(f => <option key={f.cle} value={f.cle}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <label className={ETIQUETTE} htmlFor="v2-crea-budget">Budget de cette vidéo (€)</label>
          <input id="v2-crea-budget" className={CHAMP} value={budget} inputMode="decimal"
            onChange={e => setBudget(e.target.value)} placeholder="Laissez vide si vous ne savez pas" />
          <p className={`mt-1.5 text-[12.5px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
            Meta répartit souvent le budget tout seul entre vos vidéos : dans ce cas, laissez vide.
            Les visites et les clients seront comptés quand même, seul le coût par client restera
            inconnu.
          </p>
        </div>
      </div>
    </Feuille>
  )
}

// ── Une campagne ────────────────────────────────────────────────────────────

function CarteCampagne({ c, baseUrl, onRafraichir, onModifier }: {
  c: CampagneAffichee
  baseUrl: string
  onRafraichir: () => void
  onModifier: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [ajout, setAjout] = useState(false)
  const aujourdHui = new Date().toLocaleDateString('en-CA')
  const active = estEnCours(c, aujourdHui)
  const b = c.bilan
  const couleur = couleurRetour(b.retour, b.reservations)
  const mesurable = b.retour !== null && b.reservations > 0
  const jours = joursDepuisBudget(c)
  const aVerifier = budgetAVerifier(c, aujourdHui)

  return (
    <Carte>
      <div className="px-4 pt-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[17px] ${nom}`}>{c.nom}</p>
            <p className={`mt-0.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {labelPlateforme(c.plateforme)} · du {jourCourt(c.debut)}
              {c.fin ? ` au ${jourCourt(c.fin)}` : ', sans fin prévue'}
              {c.creations.length > 0 && ` · ${inventaireFormats(c.creations.map(x => x.creation))}`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-[var(--v2-radius-pilule)] px-2 py-1 text-[11px] ${corpsFort}`}
            style={active
              ? { background: 'color-mix(in srgb, var(--v2-color-vert) 12%, transparent)', color: 'var(--v2-color-vert)' }
              : { background: 'var(--v2-filet-fort)', color: 'var(--v2-color-gris)' }}
          >
            {active ? 'En cours' : 'Terminée'}
          </span>
        </div>

        <div className="mt-2">
          <Mesure label="Dépensé" valeur={`${formatEuros(c.budget)} €`} />
          <Mesure label="Encaissé" valeur={`${formatEuros(b.chiffreAffaires)} €`} />
          <Mesure
            label="Retour"
            valeur={mesurable ? multiple(b.retour) : '—'}
            couleur={couleur}
            aide={b.coutParReservation === null
              ? undefined
              : `${formatEuros(Math.round(b.coutParReservation * 100) / 100)} € par client`}
          />
          <Mesure label="Visites" valeur={String(b.visites)} />
          <Mesure label="Clients" valeur={String(b.reservations)} />
        </div>

        {/* Un budget figé sur une campagne qui tourne encore rend le retour
            FAUX dans le sens dangereux : les clients continuent de s'ajouter
            pendant que la dépense reste à sa valeur du premier jour, donc le
            multiple monte tout seul. */}
        {aVerifier && (
          <button
            type="button"
            onClick={onModifier}
            className="mt-2 flex w-full items-start gap-2 rounded-[var(--v2-radius-bouton)] px-3 py-2.5 text-left"
            style={{ background: 'color-mix(in srgb, var(--v2-color-ambre) 10%, transparent)' }}
          >
            <AlertTriangle size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: 'var(--v2-color-ambre)' }} />
            <span className={`text-[12.5px] leading-relaxed ${corps}`} style={{ color: 'var(--v2-color-ambre)' }}>
              Ce budget date de {jours} jours et la campagne tourne toujours. Tant qu’il n’est pas
              actualisé, le retour affiché monte tout seul.{' '}
              <span className={corpsFort}>Mettre à jour</span>
            </span>
          </button>
        )}

        {b.reservations > 0 && (
          <p className={`mt-2 text-[14px] leading-relaxed ${corps}`}>
            {formatEuros(c.budget)} € dépensés, <span className={corpsFort}>{formatEuros(b.chiffreAffaires)} € de lavages</span> réservés.
          </p>
        )}
      </div>

      <div className="px-4">
        <Repliable
          id={`videos-${c.id}`}
          titre={c.creations.length === 0 ? 'Suivre chaque vidéo' : 'Vos vidéos'}
          resume={c.creations.length === 0 ? 'aucune' : `${c.creations.length}`}
          ouvert={ouvert}
          onBascule={() => setOuvert(o => !o)}
        >
          {c.creations.length === 0 ? (
            <p className={`text-[13px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
              Une campagne qui diffuse trois vidéos ne vous donne qu’une moyenne. Déclarez-les ici,
              collez le lien de chacune sous la vidéo correspondante, et vous verrez laquelle amène
              vos clients — au lieu de couper les trois ensemble.
            </p>
          ) : (
            <ul>
              {c.creations.map((x, i) => (
                <Video
                  key={x.creation.id}
                  b={x}
                  rang={i + 1}
                  lien={lienCreation(baseUrl, c.cle, x.creation.cle, c.plateforme)}
                />
              ))}
            </ul>
          )}

          {/* Ce que les vidéos n'expliquent pas. Affiché plutôt que caché :
              une somme qui ne fait pas le total détruit la confiance dans
              tout l'écran. */}
          {c.creations.length > 0 && c.reste.visites > 0 && (
            <p className={`mt-3 text-[12px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
              {c.reste.visites} visite{c.reste.visites > 1 ? 's' : ''}
              {c.reste.reservations > 0 && ` et ${c.reste.reservations} client${c.reste.reservations > 1 ? 's' : ''}`}
              {' '}sans vidéo identifiée — arrivées par le lien de la campagne.
            </p>
          )}

          <button
            type="button"
            onClick={() => setAjout(true)}
            className={`mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[var(--v2-radius-bouton)] border border-dashed border-[color:var(--v2-filet-fort)] text-[14px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
          >
            <Plus size={15} strokeWidth={2.5} />
            Ajouter une vidéo
          </button>

          <div className="mt-3 border-t border-[color:var(--v2-filet)] pt-2">
            <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Lien de la campagne entière
            </p>
            <LienCopiable lien={lienCampagne(baseUrl, c.cle, c.plateforme)} />
          </div>
        </Repliable>
      </div>

      {ajout && (
        <FeuilleVideo
          campagneId={c.id}
          onClose={() => setAjout(false)}
          onFait={() => { setAjout(false); onRafraichir() }}
        />
      )}
    </Carte>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

export type PublicitesProps = {
  campagnes: CampagneAffichee[]
  baseUrl: string
  /** Vrai quand la base n'a pas encore les tables : le suivi n'est pas en
   *  service, et l'écran le dit au lieu d'offrir un formulaire qui échouerait. */
  indisponible?: boolean
}

export default function PublicitesV2({ campagnes, baseUrl, indisponible }: PublicitesProps) {
  const router = useRouter()
  const [feuille, setFeuille] = useState<{ quoi: 'creer' } | { quoi: 'modifier'; c: CampagneAffichee } | null>(null)

  const totaux = useMemo(
    () => synthese(campagnes.map(c => c.bilan), campagnes.map(c => c.budget)),
    [campagnes],
  )
  const couleur = couleurRetour(totaux.retour, totaux.reservations)

  const sousTitre = indisponible
    ? 'Pas encore activé'
    : campagnes.length === 0
      ? 'Aucune campagne'
      : `${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''} · ${formatEuros(totaux.budget)} € dépensés`

  return (
    <div
      className={`mx-auto -mx-3 -mt-6 max-w-3xl bg-[color:var(--v2-color-fond)] px-3 pb-6 pt-3 text-[color:var(--v2-color-encre)] sm:-mx-4 sm:px-4 ${police}`}
    >
      <div className="flex items-center gap-1 pb-3">
        <Link
          href="/dashboard/clients"
          aria-label="Retour à Clients"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[21px] leading-none ${titre}`}>Publicités</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>
        </div>
        {!indisponible && (
          <button
            type="button"
            onClick={() => setFeuille({ quoi: 'creer' })}
            aria-label="Nouvelle campagne"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--v2-radius-pilule)]"
            style={{ background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }}
          >
            <Plus size={19} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {indisponible ? (
        <Carte>
          <div className="flex items-start gap-3 p-4">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--v2-radius-bouton)]"
              style={{ background: 'color-mix(in srgb, var(--v2-color-ambre) 12%, transparent)', color: 'var(--v2-color-ambre)' }}
            >
              <Clock size={16} strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className={`text-[15px] ${nom}`}>Le suivi des publicités n’est pas encore activé</p>
              <p className={`mt-1 text-[13.5px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
                Rien n’est cassé de votre côté. Vos visites et vos réservations continuent d’être
                enregistrées normalement.
              </p>
            </div>
          </div>
        </Carte>
      ) : (
        <div className="space-y-3">
          {campagnes.length > 0 && (
            <Carte>
              <div className="p-4">
                <Mesure label="Dépensé" valeur={`${formatEuros(totaux.budget)} €`} />
                <Mesure label="Encaissé" valeur={`${formatEuros(totaux.chiffreAffaires)} €`} />
                <Mesure
                  label="Retour"
                  valeur={totaux.reservations > 0 ? multiple(totaux.retour) : '—'}
                  couleur={couleur}
                />
                <Mesure
                  label="Clients"
                  valeur={String(totaux.reservations)}
                  aide={totaux.coutParReservation === null
                    ? undefined
                    : `${formatEuros(Math.round(totaux.coutParReservation * 100) / 100)} € chacun`}
                />
                {totaux.reservations > 0 && totaux.retour !== null && (
                  <p className={`mt-2 border-t border-[color:var(--v2-filet)] pt-3 text-[14px] leading-relaxed ${corps}`}>
                    Pour 1 € de publicité, vous avez encaissé{' '}
                    <span className={corpsFort} style={couleur ? { color: couleur } : undefined}>
                      {formatEuros(Math.round(totaux.retour * 100) / 100)} €
                    </span>{' '}
                    de lavages.
                  </p>
                )}
              </div>
            </Carte>
          )}

          {campagnes.map(c => (
            <CarteCampagne
              key={c.id}
              c={c}
              baseUrl={baseUrl}
              onRafraichir={() => router.refresh()}
              onModifier={() => setFeuille({ quoi: 'modifier', c })}
            />
          ))}

          {campagnes.length === 0 && (
            <Carte>
              <div className="p-4">
                <p className={`text-[15px] ${nom}`}>Aucune campagne pour l’instant</p>
                <p className={`mt-1 text-[13.5px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
                  Déclarez votre campagne, collez son lien dans votre publicité, et voyez ce qu’elle
                  vous rapporte — vidéo par vidéo.
                </p>
                <button
                  type="button"
                  onClick={() => setFeuille({ quoi: 'creer' })}
                  className={`${BOUTON} mt-3 w-full`}
                  style={{ background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }}
                >
                  Créer ma première campagne
                </button>
              </div>
            </Carte>
          )}
        </div>
      )}

      {feuille && (
        <FeuilleCampagne
          campagne={feuille.quoi === 'modifier' ? feuille.c : null}
          onClose={() => setFeuille(null)}
          onFait={() => { setFeuille(null); router.refresh() }}
        />
      )}
    </div>
  )
}
