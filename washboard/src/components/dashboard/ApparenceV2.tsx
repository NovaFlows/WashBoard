'use client'

import BookingPageModePicker from '@/components/dashboard/BookingPageModePicker'
import { bookingPageMode } from '@/lib/bookingPageMode'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useApparenceV2, type ReglagesApparence } from '@/hooks/useApparenceV2'
import { BOUTON, PRESSION, corps, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe } from '@/components/dashboard/ParametresFormV2'
import { ConfirmationSuppression, LigneDeuxNiveaux as Ligne } from '@/components/dashboard/PrestationsUiV2'
import { EtatEnvoi } from '@/components/dashboard/ApparenceUiV2'
import ApercuPageIframeV2 from '@/components/dashboard/ApercuPageIframeV2'
import FeuilleLogoV2 from '@/components/dashboard/FeuilleLogoV2'
import FeuilleCouleurV2 from '@/components/dashboard/FeuilleCouleurV2'
import FeuilleFondV2 from '@/components/dashboard/FeuilleFondV2'
import FeuilleMessageV2 from '@/components/dashboard/FeuilleMessageV2'
import FeuilleSiteV2 from '@/components/dashboard/FeuilleSiteV2'
import FeuilleAvisGoogleV2 from '@/components/dashboard/FeuilleAvisGoogleV2'
import { COULEUR_PAR_DEFAUT, MESSAGE_PAR_DEFAUT, libelleFond } from '@/lib/apparence'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { useApparenceCoteACote } from '@/hooks/useApparenceCoteACote'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// « Apparence de ma page » — refonte 2026, destination NEUVE de « Plus » (la maquette
// n'a aucun écran pour ça ; Alexandre, 2026-09-24 : « avec le même design que les
// autres pages et les mêmes fonctionnalités qu'avant »). Réservé à la PWA installée
// (voir Apparence.tsx, le garde-fou : le site est renvoyé vers
// `/dashboard/admin#identite`, l'écran web `IdentiteForm`).
// Le choix default/custom est commun aux deux surfaces et sauvegardé séparément.
//
// Périmètre décidé par Alexandre : les CINQ premières cartes de `IdentiteForm` —
// Logo, Couleur de la marque, Fond de la page, Message d'accueil, Présence en ligne
// (le site web). Zone d'intervention, Créneaux intelligents et Google Agenda n'ont
// AUCUNE trace ici : ils gardent leurs lignes provisoires dans Plus.
// Avis Google (ID de fiche) ajouté le 2026-10-04, à la demande explicite
// d'Alexandre : même geste que `IdentiteForm`, pour régler le même champ des
// deux côtés sans devoir passer par le site.
//
// Un seul aperçu, en héros (approximation honnête de l'en-tête de la vraie page), puis
// une carte de cinq lignes qui ouvrent chacune leur feuille. La couleur de la marque
// du laveur n'apparaît QUE dans l'aperçu et l'échantillon : jamais comme accent de
// l'écran, pour ne pas la confondre avec l'accent bleu de l'application.
//
// L'état d'envoi des images vit dans `useApparenceV2` : fermer une feuille n'annule
// rien. Les écritures : logo, couleur, fond au geste ; message et site par le bouton
// Enregistrer de leur feuille.

// Passe bureau (2026-10-06) : sur grand écran (`useGrandEcran`, ≥1024px — site en bêta ou PWA
// sur ordinateur), la liste « Plus » reste visible à gauche, en permanence, pendant que ce
// réglage s'affiche à droite (voir `ListeReglagesV2.tsx` et le rapport de la passe). Même
// raisonnement que `ChiffresV2.tsx`/`ClientsViewV2.tsx` : ce composant « respire » lui-même au
// lieu d'un troisième fichier — la présentation mobile/PWA, elle, ne change pas d'une ligne.
//
// Retouche du 2026-10-07 (Alexandre, après l'arrivée de l'aperçu en iframe pleine page : « ça
// fait moche [...] peut-être ajouter le segment de modification » à côté) : réglages ET aperçu
// côte à côte sur grand écran, comme l'écran 10 de la maquette (`bureau-2026/index.html`,
// colonne de gauche 252px + aperçu à droite). Avant cette passe, l'aperçu prenait toute la
// largeur de la colonne de droite (jusqu'à ~826px à 1440px de fenêtre) pour une page publique
// qui ne fait que 512px de large (`max-w-lg`, `(public)/book/[slug]/page.tsx`) : deux bandes
// vides de ~150px de chaque côté, et les réglages repoussés sous un aperçu déjà plus haut que
// l'écran. Deux changements : (1) une colonne de réglages à largeur FIXE (`LARGEUR_REGLAGES_PX`,
// proche de celle de la maquette) plutôt que `flex-1` — des lignes de liste n'ont aucune raison
// de s'étirer sur 800px ; (2) l'aperçu plafonné à `LARGEUR_APERCU_MAX_PX` (560px, un peu plus
// que les 512px de la page + sa marge intérieure de 16px de chaque côté) au lieu de `flex-1` :
// il prend toute la largeur dont il a besoin pour ne (quasi) plus réduire, jamais plus.
//
// Triple empilement mesuré (rail 252px + colonne « Plus » 260px + ces deux colonnes) : en
// dessous de 1280px de fenêtre (donc entre le seuil `useGrandEcran`, 1024px, et 1280px), la
// colonne de réglages tomberait sous 230px de large — illisible, mesuré en capturant cette
// passe. D'où `useApparenceCoteACote()` (`lib/grandEcran.ts`, même famille que
// `SEUIL_RAIL_PX`/`useEcranRail`) : le côte-à-côte attend une largeur de FENÊTRE réelle
// (≥1280px), pas seulement `useGrandEcran()` ; entre 1024 et 1280px, réglages et aperçu restent
// empilés (aperçu d'abord, réglages ensuite, comme avant cette passe) — jamais la rangée serrée.

type FeuilleOuverte = 'logo' | 'couleur' | 'fond' | 'message' | 'site' | 'avisGoogle' | null
type Retrait = 'logo' | 'photo' | null

/** Largeur fixe de la colonne de réglages côte à côte avec l'aperçu — voir le commentaire
 *  d'en-tête du fichier. Réduite le 2026-10-07 (Alexandre : « il reste de la place », après les
 *  pastilles de couleur rétrécies — voir `FeuilleCouleurV2.tsx` — qui n'ont plus besoin de
 *  300px) : 260px, mesuré suffisant pour les lignes de la liste ET pour le nuancier à 8
 *  colonnes, et cède d'autant plus de largeur à l'aperçu à côté. */
const LARGEUR_REGLAGES_PX = 260
/** Plafond de la colonne d'aperçu — relevé le 2026-10-07 avec l'agrandissement de la page
 *  publique dans `ApercuPageIframeV2` (voir son en-tête) : `LARGEUR_REFERENCE_PAGE_PX` (544) ×
 *  `FACTEUR_AGRANDISSEMENT_MAX` (1.25) = 680px, la limite de lisibilité qu'Alexandre a lui-même
 *  située entre 650 et 700px. Au-delà de cette largeur de colonne, l'aperçu n'agrandit plus la
 *  page — il centre le surplus plutôt que de le remplir (même raisonnement qu'avant cette
 *  passe : un cadre plus large qu'il n'en faut recrée les bandes vides qu'on a supprimées). */
const LARGEUR_APERCU_MAX_PX = 680

type Props = {
  nom: string
  slug: string
  initial: ReglagesApparence
  /** Liste « Plus », affichée à gauche sur grand écran — voir le commentaire plus haut. */
  liste: ReglagesListeProps
}

export default function ApparenceV2({ nom, slug, initial, liste }: Props) {
  const [pageMode, setPageMode] = useState(() => bookingPageMode(initial.pageMode))
  const h = useApparenceV2(initial)
  const grandEcran = useGrandEcran()
  const coteACote = useApparenceCoteACote()
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

  // Bloc des réglages (boutons + liste de 5 lignes) et bloc de l'aperçu : deux fragments
  // qu'on arrange soit empilés (téléphone, ou fenêtre entre 1024 et 1280px — voir
  // `useApparenceCoteACote`), soit côte à côte (≥1280px) — voir le commentaire d'en-tête du
  // fichier pour la mesure qui a fixé ce seuil.
  const blocReglages = (
    <>
      <BookingPageModePicker mode={pageMode} onChange={setPageMode} />
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
          className={`${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
          style={PRESSION}
        >
          Voir ma page
        </a>
      </div>

      <section aria-label="Réglages de la page" className="mt-[26px]">
        <CarteListe>
          <ul className="divide-y divide-[color:var(--v2-filet)]">
            {/* Logo et couleur restent modifiables quel que soit le mode de
                page — la nouvelle page les utilise aussi. Fond et message
                d'accueil ne lui servent encore à rien, ils restent réservés
                à la page classique. */}
            <Ligne label="Logo" valeur={valeurLogo} onClick={() => setFeuille('logo')} />
            <Ligne
              label="Couleur de ma marque"
              pastille={h.couleur ?? COULEUR_PAR_DEFAUT}
              onClick={() => setFeuille('couleur')}
            />
            <Ligne
              label="Avis Google"
              valeur={h.avisGoogle ? 'Renseigné' : 'Pas encore : note de votre site affichée'}
              onClick={() => setFeuille('avisGoogle')}
            />
            {pageMode === 'custom' && <>
            <Ligne label="Fond de la page" valeur={libelleFond(h.fond)} onClick={() => setFeuille('fond')} />
            <Ligne label="Message d’accueil" valeur={valeurMessage} tronquer onClick={() => setFeuille('message')} />
            </>}
            <Ligne label="Mon site web" valeur={h.site ? h.site.replace(/^https?:\/\//i, '') : 'Pas encore : aucun avis affiché'} tronquer onClick={() => setFeuille('site')} />
          </ul>
        </CarteListe>
      </section>
    </>
  )

  // L empreinte des reglages : des que l un d eux change (apres enregistrement), le cadre
  // se remonte tout seul. Sans ca, le laveur regle a gauche et ne voit rien bouger a droite.
  const versionApercu = [pageMode, h.logoUrl, h.couleur, h.fond, h.message, h.site, h.avisGoogle].join("|")
  const blocApercu = <ApercuPageIframeV2 slug={slug} version={versionApercu} />

  // Retouche du 2026-10-07 (Alexandre : « je voudrais qu'il reste [...] pas qu'il s'affiche
  // au milieu de l'écran — comme ça ils peuvent modifier et voir ce que ça donne ») : assez de
  // place pour le côte-à-côte (`coteACote`) → le réglage ouvert prend la PLACE de la liste dans
  // la colonne de gauche (prop `panneau` de `Feuille`, FeuilleV2.tsx — même principe que
  // `ClientProfileModalV2`), l'aperçu reste visible à droite pendant qu'on choisit. En dessous du
  // seuil (téléphone, ou fenêtre entre 1024 et 1280px) : fenêtre centrée / feuille qui monte du
  // bas, par-dessus l'écran, comme avant cette passe — `feuilleOuverte` est le même élément dans
  // les deux cas, seule sa prop `panneau` et son EMPLACEMENT dans ce JSX changent.
  const panneauActif = coteACote && feuille !== null
  const feuilleOuverte = feuille === 'logo' ? (
    <FeuilleLogoV2
      nom={nom}
      logoUrl={h.logoUrl}
      etat={h.logo}
      onChoisir={() => inputLogo.current?.click()}
      onRetirer={() => demanderRetrait('logo')}
      // Sous une confirmation, Échap et la poignée ne ferment que la confirmation.
      onClose={retrait ? () => {} : fermer}
      panneau={panneauActif}
    />
  ) : feuille === 'couleur' ? (
    <FeuilleCouleurV2
      couleur={h.couleur}
      enAttente={h.couleurEnAttente}
      erreur={h.couleurErreur}
      faite={h.couleurFaite}
      onChoisir={h.choisirCouleur}
      onClose={fermer}
      panneau={panneauActif}
    />
  ) : feuille === 'fond' ? (
    <FeuilleFondV2
      fond={h.fond}
      enAttente={h.fondEnAttente}
      erreur={h.fondErreur}
      photo={h.fondPhoto}
      onChoisir={h.choisirFond}
      onPhoto={() => inputPhoto.current?.click()}
      onRetirerPhoto={() => demanderRetrait('photo')}
      onClose={retrait ? () => {} : fermer}
      panneau={panneauActif}
    />
  ) : feuille === 'message' ? (
    <FeuilleMessageV2 message={h.message} onEnregistrer={h.enregistrerMessage} onClose={fermer} panneau={panneauActif} />
  ) : feuille === 'site' ? (
    <FeuilleSiteV2 site={h.site} onEnregistrer={h.enregistrerSite} onClose={fermer} panneau={panneauActif} />
  ) : feuille === 'avisGoogle' ? (
    <FeuilleAvisGoogleV2 avisGoogle={h.avisGoogle} onEnregistrer={h.enregistrerAvisGoogle} onClose={fermer} panneau={panneauActif} />
  ) : null

  const contenu = (
    <div
      className={grandEcran
        ? 'text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'
        : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}
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

      {coteACote ? (
        <div className="flex items-start gap-8">
          <div className="shrink-0" style={{ width: LARGEUR_REGLAGES_PX }}>
            {panneauActif ? feuilleOuverte : blocReglages}
          </div>
          <div className="min-w-0 flex-1" style={{ maxWidth: LARGEUR_APERCU_MAX_PX }}>{blocApercu}</div>
        </div>
      ) : (
        <>
          {/* Même plafond que ci-dessus, pour la fenêtre stackée entre 1024 et 1280px (le site
              étroit et le téléphone restent de toute façon bien en dessous) — sans lui, l'aperçu
              s'étirait sur toute la colonne dans cette plage et recréait des bandes vides. */}
          <div style={{ maxWidth: LARGEUR_APERCU_MAX_PX }}>{blocApercu}</div>
          {blocReglages}
        </>
      )}

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

      {/* En panneau (`panneauActif`), ce même élément est déjà posé dans la colonne de gauche,
          ci-dessus — ne pas le monter une seconde fois ici en fenêtre par-dessus l'écran. */}
      {!panneauActif && feuilleOuverte}

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

  if (!grandEcran) return contenu

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="apparence" />
      </div>
      <div className="min-w-0 flex-1">{contenu}</div>
    </div>
  )
}
