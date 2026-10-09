'use client'

import { useCallback, useEffect, useState } from 'react'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'

// Avis Google — feuille du bas de l'écran « Apparence de ma page » (PWA).
// Rejoint « Mon site web » le 2026-10-04 : même forme (un champ, un bouton
// Enregistrer), à la demande d'Alexandre, pour que l'ID de fiche Google soit
// réglable au même endroit que sur l'écran web (`IdentiteForm`).
//
// Pas de normalisation à la saisie comme `normaliserSiteWeb` pour le site :
// Google ne documente aucun format stable pour ses identifiants de fiche
// (longueur et préfixe peuvent changer), donc aucune validation stricte côté
// client — le serveur refuse seulement ce qui ressemble à un LIEN Google Maps
// collé par erreur à la place de l'identifiant (api/washer/route.ts).
//
// L'aperçu en dessous (`/api/washer/avis-preview`) est la vraie protection :
// plutôt que de deviner si un identifiant est bon, on montre ce qu'il donne
// réellement — ajouté après qu'un identifiant invalide soit resté silencieux
// jusqu'à ce qu'Alexandre aille vérifier la page publique lui-même.

type Apercu = { aSource: boolean; aggregate: { value: number; count: number } | null }

type Props = {
  /** Identifiant enregistré (`null` : aucun). */
  avisGoogle: string | null
  /** `null` si enregistré, sinon la phrase d'erreur. */
  onEnregistrer: (valeur: string | null) => Promise<string | null>
  onClose: () => void
  /** Passe bureau : posée en panneau à côté de l'aperçu plutôt qu'en fenêtre centrée —
   *  même prop que `FeuilleSiteV2`, voir `Feuille` (FeuilleV2.tsx) et `ApparenceV2.tsx`. */
  panneau?: boolean
}

export default function FeuilleAvisGoogleV2({ avisGoogle, onEnregistrer, onClose, panneau }: Props) {
  const [saisie, setSaisie] = useState(avisGoogle ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [apercu, setApercu] = useState<'chargement' | Apercu | null>(null)

  const chargerApercu = useCallback(async () => {
    setApercu('chargement')
    try {
      const res = await fetch('/api/washer/avis-preview')
      if (!res.ok) { setApercu(null); return }
      const data = await res.json()
      setApercu({ aSource: !!data.aSource, aggregate: data.aggregate ?? null })
    } catch {
      setApercu(null)
    }
  }, [])
  useEffect(() => { chargerApercu() }, [chargerApercu])

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    setErreur(null)
    const valeur = saisie.trim() || null
    if (valeur === avisGoogle) { onClose(); return }
    setEnCours(true)
    const retour = await onEnregistrer(valeur)
    setEnCours(false)
    if (retour) { setErreur(retour); return }
    // Ne ferme plus automatiquement : l'aperçu ci-dessous, rechargé avec la
    // nouvelle valeur, EST la confirmation — fermer tout de suite aurait
    // caché la seule preuve que ça marche vraiment.
    chargerApercu()
  }

  return (
    <Feuille
      titre="Avis Google"
      sousTitre="Facultatif."
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="apparence-avis-google" />}
      panneau={panneau}
    >
      <form id="apparence-avis-google" onSubmit={valider} noValidate>
        <Bloc titre="Identifiant de votre fiche Google (Place ID)">
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={saisie}
            onChange={e => { setSaisie(e.target.value); setErreur(null) }}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            aria-label="Identifiant de votre fiche Google"
            aria-describedby="apparence-avis-google-aide"
            className={CHAMP}
          />
          <div id="apparence-avis-google-aide" className={`mt-2 space-y-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            <p>
              Affiche votre vraie note Google (★ note et nombre d’avis) sur votre page de
              réservation, au lieu de celle trouvée sur votre site si vous en avez un.
            </p>
            <p>
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Trouver l’identifiant de votre fiche
              </a>
            </p>
          </div>
        </Bloc>

        {/* Preuve, pas une promesse : ce que la page publique affiche
            VRAIMENT en ce moment (site + fiche ci-dessus), recalculé à
            l'ouverture et après chaque enregistrement. */}
        {apercu === 'chargement' && (
          <p className={`pb-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Vérification de l’aperçu…</p>
        )}
        {apercu && apercu !== 'chargement' && apercu.aSource && (
          <div className="pb-2">
            {apercu.aggregate ? (
              <p role="status" className="flex items-start gap-2">
                <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-vert)' }} aria-hidden />
                <span className={`min-w-0 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>
                  Affiché sur votre page : ★ {apercu.aggregate.value.toLocaleString('fr-FR')} · {apercu.aggregate.count} avis
                </span>
              </p>
            ) : (
              <Constat ton="ambre" role="status">
                Aucune note trouvée avec ces réglages. Vérifiez l’identifiant ou l’adresse de votre site.
              </Constat>
            )}
          </div>
        )}

        {erreur && <div className="pb-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      </form>
    </Feuille>
  )
}
