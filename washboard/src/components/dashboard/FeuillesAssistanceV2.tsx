'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Feuille, CHAMP, PRESSION, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { estClavierTactile, shouldSendOnEnter } from '@/lib/composerKeyboard'
import { formatSupportDate, type SupportThread } from '@/lib/support'

// Feuilles du bas de « Aide et assistance » (PWA) : poser une nouvelle question, et lire /
// poursuivre une conversation avec l'équipe. Même logique d'envoi que l'écran du site
// (`SupportConversation`, `useSupportThreads`) — seule la présentation change.

type Erreur = { message: string; texte: string }

const CHAMP_TEXTE = `${CHAMP} h-auto min-h-[7.5rem] resize-none py-3 leading-snug`

/** Nouvelle question : un champ, « Envoyer ». Un envoi qui échoue ramène ici avec le texte
 *  (jamais perdu) et la phrase d'échec. */
export function FeuilleNouvelleQuestionV2({
  erreur, onEnvoyer, onClose,
}: { erreur: Erreur | null; onEnvoyer: (texte: string) => void; onClose: () => void }) {
  const [texte, setTexte] = useState(erreur?.texte ?? '')

  function valider(e: React.FormEvent) {
    e.preventDefault()
    const t = texte.trim()
    if (t) onEnvoyer(t)
  }

  return (
    <Feuille
      titre="Nouvelle question"
      sousTitre="Une personne de l’équipe vous répond en moins de 24 h."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={false} libelle="Envoyer" onClose={onClose} formulaire="assistance-nouvelle" />}
    >
      <form id="assistance-nouvelle" onSubmit={valider} noValidate>
        <label htmlFor="assistance-texte" className="sr-only">Décrivez ce qui vous bloque</label>
        <textarea
          id="assistance-texte"
          value={texte}
          onChange={e => setTexte(e.target.value)}
          placeholder="Décrivez ce qui vous bloque…"
          rows={5}
          autoFocus
          className={CHAMP_TEXTE}
        />
        {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur.message}</Constat></div>}
      </form>
    </Feuille>
  )
}

/** Une conversation : les messages, puis le champ de réponse fixé en bas. */
export function FeuilleFilV2({
  fil, erreur, onEnvoyer, onClose,
}: { fil: SupportThread; erreur: Erreur | null; onEnvoyer: (texte: string) => void; onClose: () => void }) {
  const [texte, setTexte] = useState('')
  const fin = useRef<HTMLDivElement>(null)

  // Un envoi qui échoue ne fait pas perdre ce qui a été écrit.
  useEffect(() => { if (erreur) setTexte(erreur.texte) }, [erreur])

  // Toujours sur le dernier message : à l'ouverture et à chaque nouveau.
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [fil.messages.length])

  function envoyer() {
    const t = texte.trim()
    if (!t) return
    onEnvoyer(t)
    setTexte('')
  }

  function auTouche(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSendOnEnter(e, estClavierTactile())) return
    e.preventDefault()
    envoyer()
  }

  return (
    <Feuille
      titre={fil.title}
      sousTitre={fil.status === 'resolue' ? 'Résolue' : 'Ouverte'}
      onClose={onClose}
      pied={
        <form onSubmit={e => { e.preventDefault(); envoyer() }} className="flex items-end gap-2.5">
          <label htmlFor="assistance-reponse" className="sr-only">Votre message</label>
          <textarea
            id="assistance-reponse"
            value={texte}
            onChange={e => setTexte(e.target.value)}
            onKeyDown={auTouche}
            placeholder="Votre message…"
            rows={2}
            className={`${CHAMP} h-auto min-h-[3.25rem] resize-none py-2.5 leading-snug`}
          />
          <button
            type="submit"
            disabled={!texte.trim()}
            aria-label="Envoyer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-[.94] disabled:opacity-40 motion-reduce:transition-none"
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            <Send size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </form>
      }
    >
      <div className="space-y-2.5 pb-1">
        {fil.messages.map((m, i) => {
          const moi = m.from === 'laveur'
          const dernier = i === fil.messages.length - 1
          return (
            <div key={m.id} className={`flex flex-col ${moi ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[86%] rounded-[18px] px-3.5 py-2.5 ${
                  moi
                    ? 'rounded-br-[6px] text-white'
                    : 'rounded-bl-[6px] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)]'
                }`}
                style={moi ? { background: 'var(--v2-color-accent)' } : undefined}
              >
                <span className="sr-only">{moi ? 'Vous' : 'Support WashBoard'} : </span>
                <p className={`whitespace-pre-wrap text-[15px] leading-snug ${corps}`}>{m.text}</p>
                <p className={`mt-1 text-[11px] ${corps} ${moi ? 'text-white/70' : 'text-[color:var(--v2-color-gris)]'}`}>
                  {formatSupportDate(m.createdAt)}
                </p>
              </div>
              {dernier && moi && fil.vuParEquipe && (
                <p className={`mr-1 mt-1 text-[11px] ${corps} text-[color:var(--v2-color-gris)]`}>Vu</p>
              )}
            </div>
          )
        })}
        {erreur && <div className="pt-1"><Constat ton="rouge" role="alert">{erreur.message}</Constat></div>}
        <div ref={fin} aria-hidden />
      </div>
    </Feuille>
  )
}

