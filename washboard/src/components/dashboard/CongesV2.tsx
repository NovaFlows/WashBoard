'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { Unavailability } from '@/components/dashboard/CalendrierDashboardV1'
import type { AjoutConge } from '@/hooks/useConges'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { erreurPeriode } from '@/lib/horaires'

// Congés / indisponibilités, présentation v2 — réservée à la PWA installée
// (voir CalendrierDashboardV2.tsx). Passe 7, sous-lot 3. La logique (états,
// requêtes `/api/unavailabilities`) vient de `useConges`
// (`src/hooks/useConges.ts`), la même que celle de `CalendrierDashboardV1.tsx` :
// ce fichier ne contient que de la présentation.
//
// Ni la maquette `Agenda.dc.html` ni aucun autre artboard ne montrent les
// congés : mise en forme construite avec les conventions v2 déjà posées
// (point plein + le mot, feuille du bas, filets de 1 px), pas d'après un
// modèle à reproduire. Le point ambre dit « indisponible » ; le texte reste en
// encre/gris parce que l'ambre seul, sur le fond sombre, n'atteint pas un
// contraste lisible pour du texte courant.

const MOTIFS = ['Vacances', 'Formation', 'Congé maladie', 'Jour férié']

function jourLisible(iso: string, avecAnnee: boolean): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(avecAnnee ? { year: 'numeric' } : {}),
  })
}

/** « 12 août » ou « 12 août → 19 août » — même format que la fenêtre de
 *  suppression de v1 (`→`), l'année en plus quand on le demande. */
export function libellePeriode(u: Pick<Unavailability, 'start_date' | 'end_date'>, avecAnnee = false): string {
  return u.start_date === u.end_date
    ? jourLisible(u.start_date, avecAnnee)
    : `${jourLisible(u.start_date, false)} → ${jourLisible(u.end_date, avecAnnee)}`
}

/** Qui est concerné — rien à dire pour un laveur seul. */
function detailEquipe(u: Unavailability, teamSize: number, complet: boolean): string | null {
  if (teamSize <= 1) return null
  return complet ? 'Toute l’équipe' : `${u.team_members_off} / ${teamSize} laveurs · capacité réduite`
}

function Point() {
  return <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-ambre)' }} aria-hidden />
}

/** Bandeau en tête du jour affiché, quand ce jour est dans un congé. */
export function BandeauConge({
  conge,
  teamSize,
  complet,
  onSupprimer,
}: {
  conge: Unavailability
  teamSize: number
  complet: boolean
  onSupprimer: () => void
}) {
  const equipe = detailEquipe(conge, teamSize, complet)
  return (
    <div className="flex items-center gap-3 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] py-2 pl-3.5 pr-1.5">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Point />
        <div className="min-w-0">
          <p className={`truncate text-[14.5px] ${corpsFort}`}>{conge.label ?? 'Indisponible'}</p>
          <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {libellePeriode(conge)}{equipe ? ` · ${equipe}` : ''}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSupprimer}
        aria-label={`Supprimer la période ${libellePeriode(conge)}`}
        className={`flex h-11 shrink-0 items-center px-3 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
      >
        Supprimer
      </button>
    </div>
  )
}

/** Périodes à venir (ou en cours), une ligne chacune — c'est ici qu'on voit
 *  d'un coup d'œil ce qu'on a bloqué sans feuilleter les semaines. */
export function CongesAVenir({
  conges,
  teamSize,
  estComplet,
  onOuvrir,
}: {
  conges: Unavailability[]
  teamSize: number
  estComplet: (u: Unavailability) => boolean
  onOuvrir: (u: Unavailability) => void
}) {
  if (conges.length === 0) return null
  return (
    <section aria-label="Congés à venir">
      <h2 className={`text-[15px] ${corpsFort}`}>Congés à venir</h2>
      <ul className="mt-1">
        {conges.map((u, i) => {
          const equipe = detailEquipe(u, teamSize, estComplet(u))
          return (
            <li key={u.id} className={i > 0 ? 'border-t border-[color:var(--v2-filet)]' : ''}>
              <button
                type="button"
                onClick={() => onOuvrir(u)}
                className="flex min-h-11 w-full items-start gap-2.5 py-2.5 text-left"
              >
                <Point />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14.5px] ${corpsFort}`}>{u.label ?? 'Indisponible'}</span>
                  <span className={`block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    {libellePeriode(u, true)}{equipe ? ` · ${equipe}` : ''}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Feuille « Bloquer une période » — mêmes champs, mêmes règles que la fenêtre
 *  de v1 (dates, motif rapide ou libre, nombre de laveurs si équipe > 1). */
export function FeuilleAjoutConge({
  form,
  setForm,
  teamSize,
  saving,
  onSave,
  onClose,
}: {
  form: AjoutConge
  setForm: Dispatch<SetStateAction<AjoutConge | null>>
  teamSize: number
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const restants = teamSize - form.team_members_off
  const toutes = form.team_members_off >= teamSize
  // Présentation seulement : `useConges.saveUnavail` (partagé avec le site) ne
  // dit rien quand le serveur refuse des dates incohérentes — la feuille
  // resterait ouverte sans un mot. On grise donc le bouton et on dit pourquoi.
  const erreurDates = erreurPeriode(form.start, form.end)
  return (
    <Feuille
      titre="Bloquer une période"
      sousTitre="Plus aucune réservation ne sera possible sur ces jours."
      onClose={onClose}
      fermerSurFond={false}
      pied={
        <div>
          {erreurDates && <div className="mb-3"><Constat ton="rouge" role="alert">{erreurDates}</Constat></div>}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !!erreurDates}
              className={`${BOUTON} flex-1 text-white`}
              style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
            >
              {saving ? 'Enregistrement…' : 'Bloquer'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="conge-du" className={ETIQUETTE}>Du</label>
            <input
              id="conge-du"
              type="date"
              value={form.start}
              onChange={e => setForm(m => (m ? { ...m, start: e.target.value } : m))}
              className={CHAMP}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="conge-au" className={ETIQUETTE}>Au</label>
            <input
              id="conge-au"
              type="date"
              value={form.end}
              min={form.start}
              onChange={e => setForm(m => (m ? { ...m, end: e.target.value } : m))}
              className={CHAMP}
            />
          </div>
        </div>

        <div>
          <p className={ETIQUETTE}>Motif (facultatif)</p>
          <div className="flex flex-wrap gap-2">
            {MOTIFS.map(p => {
              const actif = form.label === p
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setForm(m => (m ? { ...m, label: m.label === p ? '' : p } : m))}
                  className={`h-11 rounded-full border px-4 text-[14px] ${corpsFort} transition-transform active:scale-[.97] ${
                    actif
                      ? 'border-[color:var(--v2-color-encre)] text-[color:var(--v2-color-encre)]'
                      : 'border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]'
                  }`}
                  style={PRESSION}
                >
                  {p}
                </button>
              )
            })}
          </div>
          <label htmlFor="conge-motif" className="sr-only">Motif libre</label>
          <input
            id="conge-motif"
            type="text"
            value={form.label}
            onChange={e => setForm(m => (m ? { ...m, label: e.target.value } : m))}
            placeholder="Ou un motif libre…"
            className={`${CHAMP} mt-2.5`}
          />
        </div>

        {/* Nombre de laveurs concernés — seulement s'il y a une équipe */}
        {teamSize > 1 && (
          <div>
            <p className={ETIQUETTE}>Laveurs indisponibles</p>
            <div className="flex items-center gap-3 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-2 py-1.5">
              <button
                type="button"
                aria-label="Un laveur de moins"
                onClick={() => setForm(m => (m ? { ...m, team_members_off: Math.max(1, m.team_members_off - 1) } : m))}
                disabled={form.team_members_off <= 1}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--v2-color-encre)] disabled:opacity-30"
              >
                <Minus size={18} strokeWidth={2} />
              </button>
              <p className={`flex-1 text-center text-[20px] ${corpsFort} tabular-nums`}>
                {form.team_members_off}
                <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}> / {teamSize}</span>
              </p>
              <button
                type="button"
                aria-label="Un laveur de plus"
                onClick={() => setForm(m => (m ? { ...m, team_members_off: Math.min(teamSize, m.team_members_off + 1) } : m))}
                disabled={toutes}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--v2-color-encre)] disabled:opacity-30"
              >
                <Plus size={18} strokeWidth={2} />
              </button>
            </div>
            <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {toutes
                ? 'Toute l’équipe — les créneaux seront bloqués.'
                : `${restants} laveur${restants > 1 ? 's' : ''} restant — capacité réduite.`}
            </p>
          </div>
        )}
      </div>
    </Feuille>
  )
}

/** Feuille « Supprimer cette période ? » — confirmation avant de rouvrir les
 *  créneaux. */
export function FeuilleSuppressionConge({
  conge,
  teamSize,
  complet,
  saving,
  onDelete,
  onClose,
}: {
  conge: Unavailability
  teamSize: number
  complet: boolean
  saving: boolean
  onDelete: () => void
  onClose: () => void
}) {
  const equipe = detailEquipe(conge, teamSize, complet)
  return (
    <Feuille
      titre="Supprimer cette période ?"
      sousTitre="Les créneaux redeviennent réservables."
      onClose={onClose}
      pied={
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
            style={PRESSION}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className={`${BOUTON} flex-1 text-white`}
            style={{ background: 'var(--v2-color-rouge)', ...PRESSION }}
          >
            {saving ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-2.5 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3">
        <Point />
        <div className="min-w-0">
          <p className={`text-[15px] ${corpsFort}`}>{libellePeriode(conge, true)}</p>
          {conge.label && <p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{conge.label}</p>}
          {equipe && <p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{equipe}</p>}
        </div>
      </div>
    </Feuille>
  )
}
