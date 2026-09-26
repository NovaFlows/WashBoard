'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort, police } from '@/components/dashboard/FeuilleV2'
import { Chevron } from '@/components/dashboard/ParametresFormV2'

// Petites pièces partagées par les écrans « Prestations et prix », « Horaires »,
// « Apparence de ma page » et « Messages automatiques » de la PWA.
//
// `Interrupteur` et `LigneDeuxNiveaux` vivaient dans `MessagesAutomatiquesV2` et
// `ApparenceV2` ; déplacés ici tels quels le 2026-09-25 quand les sections Zone et
// Créneaux intelligents de « Prestations et prix » en ont eu besoin — importer un
// écran entier (et sa chaîne de dépendances : aperçu de page, détourage du logo…)
// pour un interrupteur n'aurait rien d'anodin sur le poids du bundle.

export const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`

/** Rouge pour un texte ou un lien (« Supprimer… »). Le rouge du jeton, seul, tombe
 *  à environ 2,5:1 sur la surface sombre — trop peu pour du texte : on le mêle à
 *  l'encre, ce qui garde la teinte et donne ~4,6:1 en sombre (et un rouge plus
 *  profond, lisible, en clair). Réservé au TEXTE ; les points restent le rouge pur. */
export const TEXTE_ROUGE = 'color-mix(in srgb, var(--v2-color-rouge) 70%, var(--v2-color-encre))'

/** Un constat : point plein de la couleur du statut + une phrase en encre. Le
 *  point porte la couleur, le texte reste lisible dans les deux thèmes (le rouge
 *  et l'ambre seuls, sur fond sombre, ne donnent pas un contraste de texte). */
export function Constat({
  ton, children, role,
}: { ton: 'rouge' | 'ambre'; children: ReactNode; role?: 'alert' | 'status' }) {
  return (
    <p role={role} className="flex items-start gap-2">
      <span
        className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: ton === 'rouge' ? 'var(--v2-color-rouge)' : 'var(--v2-color-ambre)' }}
        aria-hidden
      />
      <span className={`min-w-0 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>{children}</span>
    </p>
  )
}

/** Confirmation d'une suppression, en feuille du bas : Annuler / action rouge,
 *  l'échec éventuel dit sur place. Déplacée ici depuis `PrestationsV2` pour que
 *  l'écran Horaires la partage sans charger tout l'écran Prestations. */
export function ConfirmationSuppression({
  titre: intitule, texte, remarque, enCours, erreur, libelleAction = 'Supprimer', libelleEnCours = 'Suppression…', onConfirmer, onClose,
}: {
  titre: string
  texte: string
  remarque?: string
  enCours: boolean
  erreur: string | null
  /** Texte du bouton rouge (« Supprimer » par défaut, « Retirer » pour une plage). */
  libelleAction?: string
  libelleEnCours?: string
  onConfirmer: () => void
  onClose: () => void
}) {
  return (
    <Feuille
      titre={intitule}
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              {erreur ? 'Fermer' : 'Annuler'}
            </button>
            <button
              type="button"
              onClick={onConfirmer}
              disabled={enCours}
              className={`${BOUTON} flex-1 text-white`}
              style={{ background: 'var(--v2-color-rouge)', ...PRESSION }}
            >
              {enCours ? libelleEnCours : libelleAction}
            </button>
          </div>
        </div>
      }
    >
      <p className={`text-[15px] leading-snug ${corps}`}>{texte}</p>
      {remarque && <p className={`mt-3 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{remarque}</p>}
    </Feuille>
  )
}

/** Interrupteur à deux états (48 px de zone tactile, 28 px de piste). `verrouille`
 *  grise sans bascule possible (fonction hors plan). */
export function Interrupteur({
  actif, enCours, libelle, onClick, verrouille,
}: { actif: boolean; enCours: boolean; libelle: string; onClick: () => void; verrouille?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      aria-busy={enCours}
      disabled={enCours || verrouille}
      onClick={onClick}
      className="flex h-11 w-[52px] shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span
        className="flex h-[28px] w-[46px] items-center rounded-[15px] p-[3px] transition-colors motion-reduce:transition-none"
        style={{
          background: actif ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)',
          justifyContent: actif ? 'flex-end' : 'flex-start',
          transitionDuration: 'var(--v2-duration-press)',
          transitionTimingFunction: 'var(--v2-ease-out)',
        }}
        aria-hidden
      >
        <span className="h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
      </span>
    </button>
  )
}

/** Ligne de carte à deux niveaux : le nom au-dessus, son état dessous, un chevron.
 *  Le libellé et la valeur sont l'un SOUS l'autre et non côte à côte : à côté, un
 *  libellé long (« Message d'accueil ») ne laissait que trois mots à la valeur.
 *
 *  `ton` met un point plein devant l'état — réservé à une configuration cassée,
 *  jamais à un réglage simplement vide (ce serait transformer une option en reproche). */
export function LigneDeuxNiveaux({
  label, valeur, ton, pastille, tronquer, onClick,
}: {
  label: string
  valeur?: string
  ton?: 'ambre' | 'rouge'
  pastille?: string
  tronquer?: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-[15.5px] ${nom}`}>{label}</span>
          {valeur && (
            <span className={`flex items-start gap-2 ${tronquer ? 'min-w-0' : ''}`}>
              {ton && (
                <span
                  className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: ton === 'rouge' ? 'var(--v2-color-rouge)' : 'var(--v2-color-ambre)' }}
                  aria-hidden
                />
              )}
              <span
                className={`text-[13.5px] leading-snug ${corps} ${
                  ton ? 'text-[color:var(--v2-color-encre)]' : 'text-[color:var(--v2-color-gris)]'
                } ${tronquer ? 'truncate' : ''}`}
              >
                {valeur}
              </span>
            </span>
          )}
        </span>
        {pastille && (
          <span
            aria-hidden
            className="h-[18px] w-[18px] shrink-0 rounded-full"
            style={{ background: pastille, boxShadow: 'inset 0 0 0 1px var(--v2-filet-fort)' }}
          />
        )}
        <Chevron />
      </button>
    </li>
  )
}

/** Section repliée par défaut, avec sa ligne de résumé : le formulaire reste
 *  court, et ce qui est réglé se lit sans l'ouvrir. */
export function Repliable({
  id, titre, resume, ouvert, onBascule, children,
}: { id: string; titre: string; resume: string; ouvert: boolean; onBascule: () => void; children: ReactNode }) {
  return (
    <section className="border-t border-[color:var(--v2-filet)]">
      <h3>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={id}
          onClick={onBascule}
          className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
        >
          <span className={`text-[15px] ${corpsFort}`}>{titre}</span>
          <span className={`ml-auto min-w-0 truncate text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{resume}</span>
          <ChevronDown
            size={17}
            strokeWidth={2}
            aria-hidden
            className={`shrink-0 text-[color:var(--v2-color-gris)] transition-transform motion-reduce:transition-none ${ouvert ? 'rotate-180' : ''}`}
            style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
          />
        </button>
      </h3>
      {ouvert && <div id={id} className="pb-5">{children}</div>}
    </section>
  )
}
