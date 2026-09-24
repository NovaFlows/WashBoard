'use client'

import { useState } from 'react'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { normaliserSiteWeb } from '@/lib/apparence'

// Mon site web — feuille du bas de l'écran « Apparence de ma page » (PWA). C'est le
// seul champ de la carte « Présence en ligne » de l'ancien écran (aucun réseau
// social ne s'y trouve).
//
// L'adresse est validée et normalisée À LA SAISIE (`normaliserSiteWeb`) : l'ancien
// formulaire accepte « monsite.fr » puis la page de réservation l'ignore sans un mot
// (`isPublicHttpUrl`, googleReviews.ts). Ici, `https://` est ajouté quand il manque,
// un schéma autre que http(s) (`javascript:`, `data:`…) est refusé avec une phrase.
//
// Ce que la page de réservation fait de cette adresse (`scrapeWebsiteReviews`) : elle
// la lit côté serveur, en gardant les avis marqués d'étoiles (★), et met le résultat
// en cache 24 h (`revalidate: 86400`). Elle refuse de suivre une redirection : une
// adresse qui redirige (avec/sans www, http→https) ne donne aucun avis.

type Props = {
  /** Adresse enregistrée (`null` : aucune). */
  site: string | null
  /** `null` si enregistré, sinon la phrase d'erreur. */
  onEnregistrer: (valeur: string | null) => Promise<string | null>
  onClose: () => void
}

export default function FeuilleSiteV2({ site, onEnregistrer, onClose }: Props) {
  const [saisie, setSaisie] = useState(site ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreurChamp, setErreurChamp] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  // Montre tout de suite ce qui sera enregistré (« monsite.fr » devient
  // « https://monsite.fr »). Une adresse invalide n'est pas touchée : l'erreur
  // viendra à l'envoi, on ne réécrit pas ce que le laveur tape.
  function normaliserAuDepart() {
    const r = normaliserSiteWeb(saisie)
    if (r.ok && r.valeur) setSaisie(r.valeur)
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    setErreur(null)
    const r = normaliserSiteWeb(saisie)
    if (!r.ok) { setErreurChamp(r.message); return }
    setErreurChamp(null)
    if (r.valeur === site) { onClose(); return }
    setEnCours(true)
    const retour = await onEnregistrer(r.valeur)
    setEnCours(false)
    // En cas d'échec, l'adresse saisie reste dans le champ.
    if (retour) setErreur(retour)
    else onClose()
  }

  return (
    <Feuille
      titre="Mon site web"
      sousTitre="Facultatif."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="apparence-site" />}
    >
      <form id="apparence-site" onSubmit={valider} noValidate>
        <Bloc titre="Adresse de votre site">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={saisie}
            onChange={e => { setSaisie(e.target.value); setErreurChamp(null) }}
            onBlur={normaliserAuDepart}
            placeholder="https://monsite.fr"
            aria-label="Adresse de votre site web"
            aria-invalid={!!erreurChamp}
            aria-describedby="apparence-site-aide"
            className={CHAMP}
          />
          {erreurChamp && <div className="mt-2"><Constat ton="rouge" role="alert">{erreurChamp}</Constat></div>}
          <div id="apparence-site-aide" className={`mt-2 space-y-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            <p>
              S’il y a des avis avec étoiles sur cette page, ils s’affichent sur votre page de réservation. Mis à jour chaque jour.
            </p>
            <p>
              Copiez l’adresse exacte de la page : si elle redirige vers une autre adresse (avec ou sans « www », par exemple), les avis ne sont pas lus.
            </p>
          </div>
        </Bloc>

        {erreur && <div className="pb-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      </form>
    </Feuille>
  )
}
