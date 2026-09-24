'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useApparenceV2, type ReglagesApparence } from '@/hooks/useApparenceV2'
import { BOUTON, PRESSION, corps, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe, Chevron } from '@/components/dashboard/ParametresFormV2'
import { ConfirmationSuppression, nom as classeNom } from '@/components/dashboard/PrestationsUiV2'
import { EtatEnvoi } from '@/components/dashboard/ApparenceUiV2'
import ApercuPageV2 from '@/components/dashboard/ApercuPageV2'
import FeuilleLogoV2 from '@/components/dashboard/FeuilleLogoV2'
import FeuilleCouleurV2 from '@/components/dashboard/FeuilleCouleurV2'
import FeuilleFondV2 from '@/components/dashboard/FeuilleFondV2'
import FeuilleMessageV2 from '@/components/dashboard/FeuilleMessageV2'
import FeuilleSiteV2 from '@/components/dashboard/FeuilleSiteV2'
import { COULEUR_PAR_DEFAUT, MESSAGE_PAR_DEFAUT, libelleFond } from '@/lib/apparence'

// « Apparence de ma page » — refonte 2026, destination NEUVE de « Plus » (la maquette
// n'a aucun écran pour ça ; Alexandre, 2026-09-24 : « avec le même design que les
// autres pages et les mêmes fonctionnalités qu'avant »). Réservé à la PWA installée
// (voir Apparence.tsx, le garde-fou : le site est renvoyé vers
// `/dashboard/admin#identite`, l'écran v1 `IdentiteForm`, inchangé).
//
// Périmètre décidé par Alexandre : les CINQ premières cartes de `IdentiteForm` —
// Logo, Couleur de la marque, Fond de la page, Message d'accueil, Présence en ligne
// (le site web). Zone d'intervention, Créneaux intelligents et Google Agenda n'ont
// AUCUNE trace ici : ils gardent leurs lignes provisoires dans Plus.
//
// Un seul aperçu, en héros (approximation honnête de l'en-tête de la vraie page), puis
// une carte de cinq lignes qui ouvrent chacune leur feuille. La couleur de la marque
// du laveur n'apparaît QUE dans l'aperçu et l'échantillon : jamais comme accent de
// l'écran, pour ne pas la confondre avec l'accent bleu de l'application.
//
// L'état d'envoi des images vit dans `useApparenceV2` : fermer une feuille n'annule
// rien. Les écritures : logo, couleur, fond au geste ; message et site par le bouton
// Enregistrer de leur feuille.

type FeuilleOuverte = 'logo' | 'couleur' | 'fond' | 'message' | 'site' | null
type Retrait = 'logo' | 'photo' | null

type Props = {
  nom: string
  slug: string
  initial: ReglagesApparence
}

function Ligne({
  label, valeur, pastille, tronquer, onClick,
}: { label: string; valeur?: string; pastille?: string; tronquer?: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 py-2.5 text-left">
        {/* Le libellé au-dessus, la valeur dessous sur toute la largeur : à côté, un
            libellé long (« Message d'accueil ») ne laissait que trois mots à la valeur. */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-[15.5px] ${classeNom}`}>{label}</span>
          {valeur && (
            <span
              className={`text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)] ${tronquer ? 'truncate' : ''}`}
            >
              {valeur}
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

export default function ApparenceV2({ nom, slug, initial }: Props) {
  const h = useApparenceV2(initial)
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null)
  const [retrait, setRetrait] = useState<Retrait>(null)
  const [retraitEnCours, setRetraitEnCours] = useState(false)
  const [retraitErreur, setRetraitErreur] = useState<string | null>(null)
  const inputLogo = useRef<HTMLInputElement>(null)
  const inputPhoto = useRef<HTMLInputElement>(null)

  const aLogo = !!h.logoUrl
  const enCoursLogo = h.logo.phase === 'detourage' || h.logo.phase === 'envoi'
  // Un échec ou une progression du logo reste visible sur l'écran, feuille fermée.
  const etatLogoVisible = enCoursLogo || h.logo.phase === 'echec'

  function fermer() {
    if (feuille === 'logo') h.acquitterLogo()
    if (feuille === 'fond') h.acquitterFond()
    setFeuille(null)
  }

  function demanderRetrait(quoi: Exclude<Retrait, null>) {
    setRetraitErreur(null)
    setRetrait(quoi)
  }

  async function confirmerRetrait() {
    if (!retrait || retraitEnCours) return
    setRetraitEnCours(true)
    setRetraitErreur(null)
    const message = retrait === 'logo' ? await h.retirerLogo() : await h.retirerPhoto()
    setRetraitEnCours(false)
    if (message) { setRetraitErreur(message); return }
    setRetrait(null)
    // Le logo retiré n'a plus rien à montrer ; la photo retirée laisse la feuille du
    // fond ouverte, sur « Original ».
    if (retrait === 'logo') fermer()
  }

  // Le sélecteur de fichier est ICI et non dans les feuilles : il doit survivre à
  // leur fermeture, et un champ caché dans la feuille fausserait son piège de focus.
  function choisi(e: React.ChangeEvent<HTMLInputElement>, envoyer: (f: File) => void) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (fichier) envoyer(fichier)
  }

  const valeurLogo = aLogo ? 'Ajouté' : 'Pas encore : votre initiale s’affiche'
  const valeurMessage = h.message ?? `Pas encore : « ${MESSAGE_PAR_DEFAUT} » s’affiche`

  return (
    <div
      className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]"
    >
      <div className="flex items-center gap-1 pb-3">
        <Link
          href="/dashboard/parametres"
          aria-label="Retour à Plus"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[21px] leading-none ${titre}`}>Apparence de ma page</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Ce que vos clients voient en ouvrant votre lien
          </p>
        </div>
      </div>

      <ApercuPageV2 nom={nom} logoUrl={h.logoUrl} message={h.message} couleur={h.couleur} fond={h.fond} />
      <p className={`mt-2 px-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
        Aperçu approximatif de votre page.
      </p>

      <div className={etatLogoVisible ? 'mt-4' : ''} aria-live="polite">
        {etatLogoVisible && <EtatEnvoi etat={h.logo} />}
      </div>

      <div className="mt-4 space-y-2.5">
        {!aLogo && (
          <button
            type="button"
            onClick={() => setFeuille('logo')}
            className={`${BOUTON} w-full text-white`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            Ajouter mon logo
          </button>
        )}
        <a
          href={`/book/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
          style={PRESSION}
        >
          Voir ma page
        </a>
      </div>

      <section aria-label="Réglages de la page" className="mt-[26px]">
        <CarteListe>
          <ul className="divide-y divide-[color:var(--v2-filet)]">
            <Ligne label="Logo" valeur={valeurLogo} onClick={() => setFeuille('logo')} />
            <Ligne
              label="Couleur de ma marque"
              pastille={h.couleur ?? COULEUR_PAR_DEFAUT}
              onClick={() => setFeuille('couleur')}
            />
            <Ligne label="Fond de la page" valeur={libelleFond(h.fond)} onClick={() => setFeuille('fond')} />
            <Ligne label="Message d’accueil" valeur={valeurMessage} tronquer onClick={() => setFeuille('message')} />
            <Ligne label="Mon site web" valeur={h.site ? h.site.replace(/^https?:\/\//i, '') : 'Pas encore : aucun avis affiché'} tronquer onClick={() => setFeuille('site')} />
          </ul>
        </CarteListe>
      </section>

      <input
        ref={inputLogo}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={e => choisi(e, h.changerLogo)}
      />
      <input
        ref={inputPhoto}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={e => choisi(e, h.changerPhotoFond)}
      />

      {feuille === 'logo' && (
        <FeuilleLogoV2
          nom={nom}
          logoUrl={h.logoUrl}
          etat={h.logo}
          onChoisir={() => inputLogo.current?.click()}
          onRetirer={() => demanderRetrait('logo')}
          // Sous une confirmation, Échap et la poignée ne ferment que la confirmation.
          onClose={retrait ? () => {} : fermer}
        />
      )}
      {feuille === 'couleur' && (
        <FeuilleCouleurV2
          couleur={h.couleur}
          enAttente={h.couleurEnAttente}
          erreur={h.couleurErreur}
          faite={h.couleurFaite}
          onChoisir={h.choisirCouleur}
          onClose={fermer}
        />
      )}
      {feuille === 'fond' && (
        <FeuilleFondV2
          fond={h.fond}
          enAttente={h.fondEnAttente}
          erreur={h.fondErreur}
          photo={h.fondPhoto}
          onChoisir={h.choisirFond}
          onPhoto={() => inputPhoto.current?.click()}
          onRetirerPhoto={() => demanderRetrait('photo')}
          onClose={retrait ? () => {} : fermer}
        />
      )}
      {feuille === 'message' && (
        <FeuilleMessageV2 message={h.message} onEnregistrer={h.enregistrerMessage} onClose={fermer} />
      )}
      {feuille === 'site' && (
        <FeuilleSiteV2 site={h.site} onEnregistrer={h.enregistrerSite} onClose={fermer} />
      )}

      {retrait === 'logo' && (
        <ConfirmationSuppression
          titre="Retirer votre logo ?"
          texte="Vos clients verront la première lettre de votre nom à la place."
          remarque="Vous pourrez en ajouter un autre quand vous voulez."
          enCours={retraitEnCours}
          erreur={retraitErreur}
          libelleAction="Retirer"
          libelleEnCours="Retrait…"
          onConfirmer={confirmerRetrait}
          onClose={() => setRetrait(null)}
        />
      )}
      {retrait === 'photo' && (
        <ConfirmationSuppression
          titre="Retirer votre photo de fond ?"
          texte="Votre page reprend le fond « Original » : clair ou sombre, au choix de vos clients."
          remarque="Pour la remettre, il faudra la choisir de nouveau."
          enCours={retraitEnCours}
          erreur={retraitErreur}
          libelleAction="Retirer"
          libelleEnCours="Retrait…"
          onConfirmer={confirmerRetrait}
          onClose={() => setRetrait(null)}
        />
      )}
    </div>
  )
}
