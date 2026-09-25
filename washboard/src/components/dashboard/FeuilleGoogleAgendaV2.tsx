'use client'

import { BOUTON, PRESSION, corps, corpsFort, Feuille } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import type { IssueConnexionGoogle } from '@/lib/googleAgendaRetour'

// Connexion à Google Agenda, depuis l'Agenda de la PWA (Alexandre, 2026-09-25 :
// « la connexion Google Agenda devrait être dans Agenda »). Même réglage, mêmes
// routes qu'avant (`/api/auth/google-calendar`) ; seul le retour change : le
// paramètre `retour=agenda` ramène ici plutôt que sur l'écran du site.

const ISSUES: Record<IssueConnexionGoogle, { ton: 'rouge' | 'ambre' | null; texte: string }> = {
  ok: { ton: null, texte: 'Google Agenda est connecté.' },
  erreur: { ton: 'rouge', texte: 'La connexion n’a pas abouti. Rien n’a été changé : vous pouvez réessayer.' },
  'sans-jeton': {
    ton: 'ambre',
    texte: 'Google n’a pas donné un accès durable. Réessayez en acceptant toutes les autorisations demandées.',
  },
}

export function issueDepuisParametre(valeur: string | null): IssueConnexionGoogle | null {
  return valeur === 'ok' || valeur === 'erreur' || valeur === 'sans-jeton' ? valeur : null
}

export default function FeuilleGoogleAgendaV2({
  connecte, issue, onClose,
}: { connecte: boolean; issue: IssueConnexionGoogle | null; onClose: () => void }) {
  const message = issue ? ISSUES[issue] : null
  return (
    <Feuille titre="Google Agenda" onClose={onClose}>
      <div className="flex items-start gap-2.5">
        <span
          className="mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full"
          style={{ background: connecte ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)' }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className={`text-[16px] ${corpsFort}`}>{connecte ? 'Connecté' : 'Pas connecté'}</p>
          <p className={`mt-0.5 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            {connecte
              ? 'Vos rendez-vous confirmés s’ajoutent tout seuls à votre Google Agenda.'
              : 'Connectez votre compte Google : vos rendez-vous confirmés s’ajouteront tout seuls à votre Google Agenda.'}
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-4">
          {message.ton
            ? <Constat ton={message.ton} role="alert">{message.texte}</Constat>
            : <p role="status" className={`text-[13.5px] ${corpsFort} text-[color:var(--v2-color-vert)]`}>{message.texte}</p>}
        </div>
      )}

      {/* Un lien, pas un `fetch` : la connexion est une redirection vers Google et
          retour, gérée par le serveur. */}
      <a
        href="/api/auth/google-calendar?retour=agenda"
        className={`${BOUTON} mt-5 flex w-full items-center justify-center ${
          connecte
            ? 'border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]'
            : 'text-white'
        }`}
        style={connecte ? PRESSION : { background: 'var(--v2-color-accent)', ...PRESSION }}
      >
        {connecte ? 'Reconnecter le compte' : 'Connecter mon Google Agenda'}
      </a>
      {connecte && (
        <p className={`mt-2.5 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          À utiliser si vos rendez-vous n’apparaissent plus dans Google Agenda.
        </p>
      )}
    </Feuille>
  )
}
