'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  doitDemander, peutChargerPixel, enregistrerChoix, oublierChoix, lireRegistre,
  type Registre,
} from '@/lib/consentement'
import { chargerPixel, retirerPixel } from '@/lib/metaPixel'

/** Événement qui rouvre la question depuis le pied de page. */
export const EVENEMENT_GERER = 'wb:gerer-cookies'

/** Ouvre le bandeau depuis n'importe où dans la page. */
export function ouvrirGestionCookies(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENEMENT_GERER))
}

/** Le bandeau de consentement, et le chargement du Pixel qu'il commande.
 *
 *  ── Ce que ce composant garantit ─────────────────────────────────────────
 *
 *  1. AUCUN cookie Meta avant le clic. Le script n'est pas simplement inactif :
 *     il n'est pas dans la page. Il n'est injecté que dans la branche
 *     « accepté ».
 *  2. Accepter et refuser se valent. Même taille, même forme, même distance du
 *     pouce, aucune couleur qui pousse à l'un plutôt qu'à l'autre. La loi
 *     l'exige, et un bandeau qui triche se voit.
 *  3. Le bandeau n'existe que si le laveur a un Pixel. Sinon il n'y a rien à
 *     consentir, et il ne coûterait que des réservations.
 *
 *  ── Ce qu'il ne touche pas ───────────────────────────────────────────────
 *
 *  La mesure interne de WashBoard (visites, entonnoir, attribution) continue
 *  quoi qu'il arrive : première partie, sans partage ni profilage. Un refus
 *  rendrait sinon le laveur aveugle sur ses propres réservations, ce qui n'a
 *  rien à voir avec ce qu'on demande au visiteur d'accepter. */
export default function ConsentementCookies({ pixelId, slug }: {
  /** `null` quand le laveur n'a pas de Pixel : le composant ne rend rien. */
  pixelId: string | null
  /** Le consentement est retenu PAR LAVEUR : accepter chez l'un n'autorise
   *  pas le Pixel d'un autre, et tous partagent le domaine washboard.fr. */
  slug: string
}) {
  // `null` tant que le registre n'est pas lu : au premier rendu, le serveur ne
  // sait rien du navigateur. Afficher le bandeau avant d'avoir lu le choix le
  // ferait apparaître puis disparaître à chaque visite de quelqu'un qui a déjà
  // répondu.
  const [registre, setRegistre] = useState<Registre | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const lu = lireRegistre()
    setRegistre(lu)
    setVisible(doitDemander(pixelId, lu, slug))
    if (peutChargerPixel(pixelId, lu, slug)) chargerPixel(pixelId!)
  }, [pixelId, slug])

  // « Gérer mes cookies » : on efface le choix et on repose la question, plutôt
  // que de basculer. C'est au visiteur de redécider, pas à nous de deviner.
  useEffect(() => {
    const rouvrir = () => {
      if (!pixelId) return
      setRegistre(oublierChoix(slug))
      retirerPixel()
      setVisible(true)
    }
    window.addEventListener(EVENEMENT_GERER, rouvrir)
    return () => window.removeEventListener(EVENEMENT_GERER, rouvrir)
  }, [pixelId, slug])

  const repondre = useCallback((choix: 'accepte' | 'refuse') => {
    const maj = enregistrerChoix(slug, choix)
    setRegistre(maj)
    setVisible(false)
    if (choix === 'accepte' && pixelId) chargerPixel(pixelId)
    else retirerPixel()
  }, [pixelId, slug])

  if (!pixelId || registre === null || !visible) return null

  // Les deux boutons partagent la MÊME classe : c'est la garantie visuelle que
  // refuser est aussi simple qu'accepter, et toute divergence future se verrait
  // ici, sur une seule ligne.
  //
  // Le bandeau est volontairement minuscule — deux lignes et deux boutons, sous
  // le pouce, sans défilement. Ce qu'on accélère, c'est la DÉCISION, pas
  // l'acceptation : un bandeau qui enterre « Refuser » se fait sanctionner, et
  // c'est le laveur qui porte le risque, pas nous. Le détail complet est dans
  // la politique de confidentialité, à un clic.
  const bouton = 'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consentement-titre"
      className="fixed inset-x-0 bottom-0 z-50 p-2 sm:p-3"
    >
      <div className="mx-auto max-w-lg rounded-xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-slate-900/10 dark:ring-white/10 px-4 py-3 sm:flex sm:items-center sm:gap-4">
        <p id="consentement-titre" className="text-[13px] leading-snug text-slate-600 dark:text-slate-300 sm:flex-1">
          Ce prestataire mesure ses publicités avec le Pixel Meta.{' '}
          <Link href="/confidentialite" className="underline hover:text-slate-900 dark:hover:text-slate-100">
            En savoir plus
          </Link>
        </p>
        <div className="mt-2.5 flex gap-2 sm:mt-0 sm:shrink-0 sm:w-56">
          <button onClick={() => repondre('refuse')} className={bouton}>Refuser</button>
          <button onClick={() => repondre('accepte')} className={bouton}>Accepter</button>
        </div>
      </div>
    </div>
  )
}

/** Le lien du pied de page. N'apparaît que là où il y a quelque chose à gérer. */
export function LienGererCookies({ pixelId }: { pixelId: string | null }) {
  if (!pixelId) return null
  return (
    <button
      onClick={ouvrirGestionCookies}
      className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors"
    >
      Gérer mes cookies
    </button>
  )
}
