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
import { CLE_CARTE_CACHEE } from '@/lib/reglagesMasques'

// « Réglages » — ce qui règle l'APPLICATION, pas l'entreprise (Alexandre, 2026-09-27 :
// « réglage apparaît dans Mon compte, mais juste Réglages, et quand on clique dessus on voit
// tout ce qu'on peut faire »).
//
// La distinction tient en une phrase : ce qui est ICI ne change rien à ce que voient les
// clients du laveur. Ses prestations, ses horaires, sa page — c'est « Plus ». L'apparence de
// l'app, ses notifications, l'aide — c'est ici.
//
// « Tous les réglages » y est aussi, parce qu'il faut bien un chemin vers ce qui n'a pas
// encore d'écran refait (email, mot de passe, accès support, zone de danger) ; il occupait
// jusqu'ici le bas de « Plus », où il traînait sans raison.

export default function ReglagesV2() {
  const { theme, setTheme } = useTheme()
  const { etat: etatNotifications } = useNotificationsPush()
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

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 space-y-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
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

      <div>
        <TitreSection>Plus loin</TitreSection>
        <CarteListe>
          <Ligne
            label="Tous les réglages"
            sousLabel="Email, mot de passe"
            href="/dashboard/parametres/tout"
          />
        </CarteListe>
        <p className={`mt-2 px-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          L’ancien écran complet, pour les réglages qui n’ont pas encore leur page ici.
        </p>
      </div>

      {feuilleNotifications && <FeuilleNotificationsV2 onClose={() => setFeuilleNotifications(false)} />}
    </div>
  )
}
