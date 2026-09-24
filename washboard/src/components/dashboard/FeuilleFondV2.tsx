'use client'

import { Sun, Moon } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat, TEXTE_ROUGE } from '@/components/dashboard/PrestationsUiV2'
import { Bloc } from '@/components/dashboard/ReglageAutomatismeV2'
import { ANNEAU_CHOIX, EtatEnvoi, enCoursEnvoi } from '@/components/dashboard/ApparenceUiV2'
import type { EtatImage } from '@/hooks/useApparenceV2'
import { BG_THEME_PRESETS, OVERLAY, getBgStyle, type BgThemePreset } from '@/lib/themes'
import { LIBELLE_FOND_PHOTO, LIBELLE_FOND_ORIGINAL, estPhotoPerso, miniaturePhoto } from '@/lib/apparence'

// Fond de la page — feuille du bas de l'écran « Apparence de ma page » (PWA). Mêmes
// choix que l'ancien écran : Original (clair/sombre au choix du client), trois
// dégradés, trois photos, et la photo du laveur. Différences d'interface : le NOM
// est sous chaque vignette (le libellé de 9 px posé sur l'image était illisible),
// et un choix qui échoue est annulé avec une phrase (l'ancien écran échouait sans
// rien dire).
//
// Le voile noir de 52 % que la page publique pose sur toute photo (`OVERLAY`,
// `themes.ts`) est repris sur les vignettes : elles montrent ce que verront les
// clients, pas la photo brute. Ce garde-fou de lisibilité n'est pas modifié.

type Props = {
  /** Fond enregistré. */
  fond: string | null
  /** Fond touché, en cours d'enregistrement (`undefined` : aucun ; `null` : Original). */
  enAttente: string | null | undefined
  erreur: string | null
  photo: EtatImage
  onChoisir: (valeur: string | null) => void
  onPhoto: () => void
  onRetirerPhoto: () => void
  onClose: () => void
}

/** Une vignette : le visuel, et son NOM dessous. Sans `onClick`, c'est un simple
 *  affichage (la photo du laveur, quand elle est déjà le fond choisi). */
function Vignette({
  nom: intitule, choisi, onClick, visuel, ratio,
}: { nom: string; choisi: boolean; onClick?: () => void; visuel: React.CSSProperties; ratio: string }) {
  const contenu = (
    <>
      <span
        className={`block w-full rounded-[12px] bg-[color:var(--v2-filet)] ${ratio}`}
        style={{ ...visuel, boxShadow: choisi ? ANNEAU_CHOIX : 'inset 0 0 0 1px var(--v2-filet-fort)' }}
      />
      <span className={`truncate text-[13px] ${choisi ? corpsFort : corps}`}>{intitule}</span>
    </>
  )
  const classe = 'flex w-full min-w-0 flex-col gap-2 text-left'
  if (!onClick) return <div className={classe}>{contenu}</div>
  return (
    <button
      type="button"
      aria-pressed={choisi}
      onClick={onClick}
      className={`${classe} active:scale-[.98] motion-reduce:transition-none`}
      style={PRESSION}
    >
      {contenu}
    </button>
  )
}

const visuelPreset = (t: BgThemePreset): React.CSSProperties =>
  t.photo
    ? {
        backgroundImage: `linear-gradient(${OVERLAY},${OVERLAY}), url(${miniaturePhoto(t.photo)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: t.gradient }

export default function FeuilleFondV2({ fond, enAttente, erreur, photo, onChoisir, onPhoto, onRetirerPhoto, onClose }: Props) {
  const courant = enAttente === undefined ? fond : enAttente
  // Un identifiant que `getBgStyle` ne reconnaît pas n'habille pas la page : c'est « Original ».
  const original = getBgStyle(courant) === null
  const occupe = enCoursEnvoi(photo)
  const photoActive = estPhotoPerso(fond)
  const degrades = BG_THEME_PRESETS.filter(t => !t.photo)
  const photos = BG_THEME_PRESETS.filter(t => !!t.photo)

  return (
    <Feuille
      titre="Fond de la page"
      sousTitre="Un fond retire le bouton clair/sombre chez vos clients."
      onClose={onClose}
    >
      <div className="space-y-5 pb-2">
        <button
          type="button"
          aria-pressed={original}
          onClick={() => onChoisir(null)}
          className="flex min-h-[56px] w-full items-center gap-3 rounded-[12px] bg-[color:var(--v2-color-surface)] px-4 py-2.5 text-left active:scale-[.99] motion-reduce:transition-none"
          style={{ boxShadow: original ? ANNEAU_CHOIX : 'inset 0 0 0 1px var(--v2-filet-fort)', ...PRESSION }}
        >
          <span className="min-w-0 flex-1">
            <span className={`block text-[15px] ${original ? corpsFort : corps}`}>{LIBELLE_FOND_ORIGINAL}</span>
            <span className={`block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Vos clients choisissent eux-mêmes.</span>
          </span>
          <Sun size={16} strokeWidth={2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
          <Moon size={16} strokeWidth={2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
        </button>

        <Bloc titre="Dégradés">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            {degrades.map(t => (
              <Vignette
                key={t.id}
                nom={t.name}
                choisi={courant === t.id}
                onClick={() => onChoisir(t.id)}
                visuel={visuelPreset(t)}
                ratio="h-14"
              />
            ))}
          </div>
        </Bloc>

        <Bloc titre="Photos">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {photos.map(t => (
              <Vignette
                key={t.id}
                nom={t.name}
                choisi={courant === t.id}
                onClick={() => onChoisir(t.id)}
                visuel={visuelPreset(t)}
                ratio="aspect-[16/9]"
              />
            ))}
          </div>
        </Bloc>

        <Bloc titre={LIBELLE_FOND_PHOTO}>
          {photoActive ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3">
              <Vignette
                nom={LIBELLE_FOND_PHOTO}
                choisi={courant === fond}
                visuel={{
                  backgroundImage: `linear-gradient(${OVERLAY},${OVERLAY}), url(${fond})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                ratio="aspect-[16/9]"
              />
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onPhoto}
                  disabled={occupe}
                  className={`${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
                  style={PRESSION}
                >
                  {occupe ? 'En cours…' : 'Changer'}
                </button>
                <button
                  type="button"
                  onClick={onRetirerPhoto}
                  disabled={occupe}
                  className={`flex h-11 w-full items-center justify-center text-[15px] ${corpsFort} disabled:opacity-50`}
                  style={{ color: TEXTE_ROUGE }}
                >
                  Retirer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPhoto}
              disabled={occupe}
              className={`${BOUTON} w-full border border-dashed border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              {occupe ? 'En cours…' : 'Choisir ma photo'}
            </button>
          )}
          <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            JPG, PNG, WebP, réduite automatiquement. Une photo est assombrie pour que le texte reste lisible.
          </p>
        </Bloc>

        <div className="space-y-2" aria-live="polite">
          <EtatEnvoi etat={photo} texteFait="Photo mise en ligne." />
          {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        </div>
      </div>
    </Feuille>
  )
}
