'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CarteListe, Ligne, NonLus, TitreSection } from '@/components/dashboard/ParametresFormV2'
import { corps, titre } from '@/components/dashboard/FeuilleV2'
import FeuilleNotificationsV2, { resumeNotifications } from '@/components/dashboard/FeuilleNotificationsV2'
import { useNotificationsPush } from '@/hooks/useNotificationsPush'
import { usePreferenceLocale } from '@/hooks/usePreferenceLocale'
import { useTheme } from '@/components/ui/ThemeProvider'
import { useSupportBadges } from '@/components/dashboard/SupportBadgesContext'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { CLE_CARTE_CACHEE } from '@/lib/reglagesMasques'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { SetupProgressBar } from '@/components/dashboard/SetupProgressBar'
import type { SetupProgress } from '@/lib/setupProgress'

// « Réglages » — ce qui règle l'APPLICATION, pas l'entreprise (Alexandre, 2026-09-27 :
// « réglage apparaît dans Mon compte, mais juste Réglages, et quand on clique dessus on voit
// tout ce qu'on peut faire »).
//
// La distinction tient en une phrase : ce qui est ICI ne change rien à ce que voient les
// clients du laveur. Ses prestations, ses horaires, sa page — c'est « Plus ». L'apparence de
// l'app, ses notifications, l'aide — c'est ici.
//
// L'ancien écran « Tous les réglages » n'est plus proposé ici : email, mot de passe, frais de
// déplacement, pause et suppression du compte vivent dans « Mon profil » (2026-09-30).
//
// Passe « Plus bureau, second lot » (2026-10-06) : même patron que `ApparenceV2.tsx` sur grand
// écran — `ListeReglagesV2` reste visible à gauche (`selection="reglages"`, voir son en-tête),
// ce composant se contente de RESPIRER au-delà du palier plutôt que de forker un troisième
// fichier (même raisonnement que `ClientsViewV2.tsx`/`ApparenceV2.tsx`). Le contenu mobile
// (en-tête avec chevron, les deux cartes) ne change pas d'une ligne.
//
// La carte « Configuration de votre compte » (`SetupProgressBar`) vit ici depuis le 2026-10-04,
// à la demande d'Alexandre : le bouton qui la masque/affiche vivait déjà sur cet écran, elle ne
// doit plus s'afficher sur « Plus » (voir `SetupProgressBarPlus`, qui l'y cache en PWA).

type Props = {
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`). */
  liste: ReglagesListeProps
  progress: SetupProgress
}

export default function ReglagesV2({ liste, progress }: Props) {
  const { theme, setTheme } = useTheme()
  const { etat: etatNotifications } = useNotificationsPush()
  const grandEcran = useGrandEcran()
  // Arrivée par un lien du guide (`#notifications`) : la feuille s'ouvre d'office, sinon le
  // laveur atterrit sur un écran de réglages et doit re-chercher la ligne qu'on lui promettait.
  // Cet écran ne se monte qu'après le garde-fou de `Reglages.tsx`, donc toujours dans le
  // navigateur — `window` existe.
  const [feuilleNotifications, setFeuilleNotifications] = useState(
    () => window.location.hash === '#notifications',
  )
  const [carteCachee, setCarteCachee] = usePreferenceLocale(CLE_CARTE_CACHEE)
  const { unreadSupportCount } = useSupportBadges()
  const notifications = resumeNotifications(etatNotifications)

  const contenu = (
    <div className={grandEcran ? 'space-y-6 [font-family:var(--font-archivo)]' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 space-y-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      {!grandEcran && (
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/parametres"
            aria-label="Retour à Plus"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className={`text-[24px] leading-none ${titre}`}>Réglages</h1>
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              L’application, pas votre entreprise
            </p>
          </div>
        </div>
      )}
      {grandEcran && (
        <div>
          <h1 className={`text-[20px] leading-none ${titre}`}>Réglages</h1>
          <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            L’application, pas votre entreprise
          </p>
        </div>
      )}

      <div>
        <TitreSection>L’application</TitreSection>
        <CarteListe>
          <Ligne
            label="Apparence"
            valeur={theme === 'dark' ? 'Sombre' : 'Clair'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            chevron={false}
          />
          <Ligne
            label="Notifications"
            valeur={notifications.texte || undefined}
            signal={notifications.ton === 'ambre'
              ? <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-ambre)' }} aria-hidden />
              : undefined}
            onClick={() => setFeuilleNotifications(true)}
          />
          {/* Le seul chemin pour faire revenir la carte de configuration une fois masquée. */}
          <Ligne
            label="Barre de configuration"
            valeur={carteCachee === '1' ? 'Masquée' : 'Affichée'}
            onClick={() => setCarteCachee(carteCachee === '1' ? null : '1')}
            chevron={false}
          />
        </CarteListe>
      </div>

      {/* Se masque elle-même (lit la même préférence que le bouton ci-dessus,
          `CLE_CARTE_CACHEE`) : pas de condition à dupliquer ici. */}
      <SetupProgressBar progress={progress} />

      <div>
        <TitreSection>De l’aide</TitreSection>
        <CarteListe>
          <Ligne label="Guide d’utilisation" sousLabel="Questions fréquentes" href="/dashboard/guide" />
          <Ligne
            label="Aide et assistance"
            sousLabel="Écrire à l’équipe"
            href="/dashboard/assistance"
            signal={<NonLus count={unreadSupportCount} />}
          />
        </CarteListe>
      </div>

      {feuilleNotifications && <FeuilleNotificationsV2 onClose={() => setFeuilleNotifications(false)} />}
    </div>
  )

  if (!grandEcran) return contenu

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="reglages" />
      </div>
      <div className="min-w-0 max-w-[640px] flex-1">{contenu}</div>
    </div>
  )
}
