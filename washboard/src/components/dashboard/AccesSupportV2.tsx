'use client'

import { useAccesSupport } from '@/hooks/useAccesSupport'
import { BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { useT , useLocale } from '@/components/i18n/I18nProvider'

// « Aide à la configuration », version de la PWA : le laveur ouvre lui-même, pour une heure,
// l'accès de l'équipe à son compte, et peut le couper tout de suite. Même fonction et mêmes
// phrases que la carte du site (`SupportAccessPanel`, inchangée). Le ton compte autant que la
// fonction : on demande à quelqu'un d'ouvrir son tableau de bord, ses clients, sa comptabilité —
// chaque phrase dit donc ce qui se passe, combien de temps, et comment couper.

export default function AccesSupportV2() {
  const loc = useLocale()
  const t = useT()
  const { etat, occupe, erreur, basculer } = useAccesSupport()

  // Rien tant que l'état n'est pas connu : « fermé » affiché par défaut laisserait croire
  // que personne ne peut entrer, alors qu'un accès est peut-être ouvert.
  if (!etat && !erreur) return null

  const ouvert = !!etat?.active
  const dernierAcces = etat?.lastUsedAt
    ? new Date(etat.lastUsedAt).toLocaleString(loc, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section
      aria-label={t('Aide à la configuration')}
      className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4"
    >
      <p className={`text-[15.5px] ${corpsFort}`}>{t('Aide à la configuration')}</p>
      <p className={`mt-1 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        {t('Ouvrez l’accès à votre compte pour qu’on vous aide à le configurer. Il se referme tout seul au bout d’une heure, et vous pouvez le couper à tout moment.')}
      </p>

      {etat && (
        <p role="status" className="mt-3.5 flex items-start gap-2">
          <span
            className="mt-[7px] h-[8px] w-[8px] shrink-0 rounded-full"
            style={{ background: ouvert ? 'var(--v2-color-ambre)' : 'var(--v2-color-gris)' }}
            aria-hidden
          />
          <span className={`text-[13.5px] leading-snug ${corpsFort}`}>
            {ouvert
              ? t('Accès ouvert : il reste {minutesLeft} minute{v1}. Notre équipe peut se connecter à votre compte.', { minutesLeft: etat.minutesLeft, v1: etat.minutesLeft > 1 ? 's' : '' })
              : t('Accès fermé : personne ne peut se connecter à votre compte.')}
          </span>
        </p>
      )}

      {etat && (
        <button
          type="button"
          onClick={() => void basculer(!ouvert)}
          disabled={occupe}
          className={`${BOUTON} mt-4 w-full ${
            ouvert ? 'border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]' : 'text-white'
          }`}
          style={ouvert ? PRESSION : { background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          {occupe ? t('Un instant…') : ouvert ? t('Fermer l’accès maintenant') : t('Ouvrir l’accès pour 1 heure')}
        </button>
      )}

      {dernierAcces && (
        <p className={`mt-3 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('Dernier accès de notre équipe : {dernierAcces}', { dernierAcces })}</p>
      )}

      {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
    </section>
  )
}
