'use client'

import { BOUTON, PRESSION, corps } from '@/components/dashboard/FeuilleV2'
import { Feuille } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { useNotificationsPush, type EtatNotifications } from '@/hooks/useNotificationsPush'

// Notifications sur le téléphone — feuille du bas de « Plus » (PWA). Même autorisation, même
// abonnement et mêmes routes que l'écran du site (`NotificationsToggle`) : tout vient du hook
// partagé `useNotificationsPush`. Seule la présentation change.

/** Ce que la ligne de « Plus » affiche sous « Notifications ». */
export function resumeNotifications(etat: EtatNotifications): { texte: string; ton?: 'ambre' } {
  switch (etat) {
    case 'actif': return { texte: 'Activées sur cet appareil' }
    case 'inactif': return { texte: 'Désactivées', ton: 'ambre' }
    case 'refuse': return { texte: 'Bloquées par le téléphone', ton: 'ambre' }
    case 'ios-non-installe': return { texte: 'Ajoutez l’app à votre écran d’accueil', ton: 'ambre' }
    case 'non-supporte': return { texte: 'Indisponibles sur cet appareil' }
    default: return { texte: '' }
  }
}

export default function FeuilleNotificationsV2({ onClose }: { onClose: () => void }) {
  const { etat, occupe, erreur, activer, desactiver } = useNotificationsPush()
  const actif = etat === 'actif'

  return (
    <Feuille
      titre="Notifications"
      sousTitre="Être prévenu sur ce téléphone dès qu’un client réserve, sans attendre l’e-mail."
      onClose={onClose}
    >
      {etat === 'ios-non-installe' && (
        <Constat ton="ambre" role="status">
          Sur iPhone, ajoutez d’abord WashBoard à votre écran d’accueil : bouton Partager dans Safari,
          puis « Sur l’écran d’accueil ». Revenez ensuite ici depuis l’icône WashBoard.
        </Constat>
      )}

      {etat === 'non-supporte' && (
        <p className={`text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Cet appareil ne gère pas les notifications. Vous continuez à recevoir les réservations par e-mail.
        </p>
      )}

      {etat === 'refuse' && (
        <Constat ton="ambre" role="status">
          Les notifications ont été refusées pour WashBoard. Pour les rétablir, autorisez-les dans les
          réglages de votre téléphone, puis revenez ici.
        </Constat>
      )}

      {(etat === 'actif' || etat === 'inactif') && (
        <>
          <p className="flex items-start gap-2">
            <span
              className="mt-[7px] h-[8px] w-[8px] shrink-0 rounded-full"
              style={{ background: actif ? 'var(--v2-color-vert)' : 'var(--v2-color-gris)' }}
              aria-hidden
            />
            <span className={`text-[14px] leading-snug ${corps}`}>
              {actif ? 'Activées sur cet appareil.' : 'Désactivées sur cet appareil.'}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void (actif ? desactiver() : activer())}
            disabled={occupe}
            className={`${BOUTON} mt-4 w-full ${
              actif ? 'border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]' : 'text-white'
            }`}
            style={actif ? PRESSION : { background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            {occupe ? 'Un instant…' : actif ? 'Désactiver sur cet appareil' : 'Activer les notifications'}
          </button>
        </>
      )}

      {/* Le rappel du soir ne part QUE par notification : ni e-mail, ni SMS. Un laveur qui ne les
          a jamais activées ne le recevait jamais et ne pouvait pas le deviner. */}
      {etat !== 'actif' && etat !== 'chargement' && (
        <p className={`mt-4 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Sans notifications, vous ne recevrez pas le <strong>rappel de 22 h</strong> sur les rendez-vous
          du jour qui ne sont pas encore clôturés : il n’existe ni par e-mail, ni par SMS. Les réservations,
          elles, vous arrivent toujours par e-mail.
        </p>
      )}

      {erreur && <div className="mt-4"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
    </Feuille>
  )
}
