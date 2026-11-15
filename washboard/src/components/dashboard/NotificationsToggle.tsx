'use client'

import { useNotificationsPush } from '@/hooks/useNotificationsPush'
import { useT } from '@/components/i18n/I18nProvider'

// Activation des notifications push, dans les réglages du laveur (écran du site, inchangé).
//
// L'abonnement lui-même, l'autorisation et les cas qui empêchent d'y arriver (iPhone pas
// encore installé, autorisation refusée…) vivent dans `useNotificationsPush` depuis le
// 2026-09-26 : l'application (PWA) a sa propre présentation et doit se comporter exactement
// pareil. Ce fichier ne garde que l'habillage v1.

export function NotificationsToggle() {
  const t = useT()
  const { etat, occupe, erreur, activer, desactiver } = useNotificationsPush()

  if (etat === 'chargement') return null

  return (
    // id="notifications" : cible du guide, qui écrit ses liens avec les ancres du site
    // (voir `lib/lienV2.ts`, qui les traduit pour l'application).
    <div id="notifications" className="scroll-mt-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-1">{t('Notifications')}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {t('Soyez prévenu sur votre téléphone dès qu’un client réserve, sans attendre l’email.')}
      </p>

      {etat === 'ios-non-installe' && (
        <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5">
          {t('Sur iPhone, ajoutez d’abord WashBoard à votre écran d’accueil : bouton Partager dans Safari, puis')} <strong>{t('Sur l’écran d’accueil')}</strong>{t('. Revenez ensuite ici depuis l’icône WashBoard.')}
        </p>
      )}

      {etat === 'non-supporte' && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('Votre navigateur ne gère pas les notifications. Vous continuez à recevoir les emails de réservation.')}
        </p>
      )}

      {etat === 'refuse' && (
        <p className="text-sm text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3.5">
          {t('Les notifications ont été refusées pour ce site. Pour les réactiver, autorisez-les dans les réglages de votre navigateur, puis revenez sur cette page.')}
        </p>
      )}

      {(etat === 'inactif' || etat === 'actif') && (
        <button
          onClick={etat === 'actif' ? desactiver : activer}
          disabled={occupe}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            etat === 'actif'
              ? 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              : 'bg-[#1651E8] text-white hover:bg-[#0F4ACC]'
          }`}
        >
          {occupe ? 'Un instant…' : etat === 'actif' ? t('Désactiver sur cet appareil') : t('Activer les notifications')}
        </button>
      )}

      {etat === 'actif' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2.5 font-medium">
          {t('Actives sur cet appareil.')}
        </p>
      )}

      {/* Le rappel du soir ne part QUE par notification : ni email, ni SMS. Un
          laveur qui ne les a jamais activées ne le recevait jamais et ne
          pouvait pas le deviner (relevé par Ryan le 2026-09-15). */}
      {etat !== 'actif' && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          {t('Sans notifications actives, vous ne recevrez pas le')} <strong>{t('rappel de 22 h')}</strong> {t('sur les rendez-vous du jour qui ne sont pas encore marqués « Terminé » — il n’existe ni par email, ni par SMS. Les réservations, elles, vous arrivent toujours par email.')}
        </p>
      )}

      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{erreur}</p>}
    </div>
  )
}
