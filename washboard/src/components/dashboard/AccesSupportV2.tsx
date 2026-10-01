'use client'

import { useAccesSupport } from '@/hooks/useAccesSupport'
import { BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'

// « Aide à la configuration », version de la PWA : le laveur ouvre lui-même, pour une heure,
// l'accès de l'équipe à son compte, et peut le couper tout de suite. Même fonction et mêmes
// phrases que la carte du site (`SupportAccessPanel`, inchangée). Le ton compte autant que la
// fonction : on demande à quelqu'un d'ouvrir son tableau de bord, ses clients, sa comptabilité —
// chaque phrase dit donc ce qui se passe, combien de temps, et comment couper.

export default function AccesSupportV2() {
  const { etat, occupe, erreur, basculer } = useAccesSupport()

  // Rien tant que l'état n'est pas connu : « fermé » affiché par défaut laisserait croire
  // que personne ne peut entrer, alors qu'un accès est peut-être ouvert.
  if (!etat && !erreur) return null

  const ouvert = !!etat?.active
  const dernierAcces = etat?.lastUsedAt
    ? new Date(etat.lastUsedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section
      aria-label="Aide à la configuration"
      className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4"
    >
      <p className={`text-[15.5px] ${corpsFort}`}>Aide à la configuration</p>
      <p className={`mt-1 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Ouvrez l’accès à votre compte pour qu’on vous aide à le configurer. Il se referme tout seul au bout d’une heure,
        et vous pouvez le couper à tout moment.
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
              ? `Accès ouvert : il reste ${etat.minutesLeft} minute${etat.minutesLeft > 1 ? 's' : ''}. Notre équipe peut se connecter à votre compte.`
              : 'Accès fermé : personne ne peut se connecter à votre compte.'}
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
          {occupe ? 'Un instant…' : ouvert ? 'Fermer l’accès maintenant' : 'Ouvrir l’accès pour 1 heure'}
        </button>
      )}

      {dernierAcces && (
        <p className={`mt-3 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Dernier accès de notre équipe : {dernierAcces}
        </p>
      )}

      {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
    </section>
  )
}
