'use client'

import { useEffect, useState } from 'react'
import { X, Send, CheckCircle2, MessageCircle, ChevronLeft, Plus, AlertCircle } from 'lucide-react'
import { formatSupportDate, type SupportThread } from '@/lib/support'
import type { SupportSendError } from '@/lib/useSupportThreads'

export type SupportVue = { type: 'liste' } | { type: 'nouvelle' } | { type: 'fil'; id: string }

function StatutBadge({ statut }: { statut: SupportThread['status'] }) {
  if (statut === 'resolue') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 shrink-0">
        <CheckCircle2 size={12} /> Résolue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
      Ouverte
    </span>
  )
}

function triParRecence(threads: SupportThread[]): SupportThread[] {
  return [...threads].sort((a, b) => {
    const da = a.messages.at(-1)?.createdAt ?? ''
    const db = b.messages.at(-1)?.createdAt ?? ''
    return db.localeCompare(da)
  })
}

function ListeFils({ threads, onOuvrir, onNouvelle }: {
  threads: SupportThread[]
  onOuvrir: (id: string) => void
  onNouvelle: () => void
}) {
  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onNouvelle}
        className="w-full inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold transition-colors mb-4"
      >
        <Plus size={16} /> Nouvelle question
      </button>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {triParRecence(threads).map(t => {
          const dernier = t.messages.at(-1)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOuvrir(t.id)}
              className="w-full flex items-center gap-3 py-3 text-left min-h-11 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-1.5 -mx-1.5 transition-colors"
            >
              {t.nonLue && (
                <span className="w-2 h-2 rounded-full bg-[#1651E8] dark:bg-[#6A9FFF] shrink-0" aria-label="Réponse non lue" title="Réponse non lue" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`truncate ${t.nonLue ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>
                  {t.title}
                </p>
                {dernier && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {formatSupportDate(dernier.createdAt)}
                  </p>
                )}
              </div>
              <StatutBadge statut={t.status} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Composer({ onEnvoyer, placeholder, erreur, onDismissErreur }: {
  onEnvoyer: (texte: string) => void
  placeholder: string
  /** Échec du dernier envoi depuis CE composer — texte à restituer et message à afficher. */
  erreur?: { message: string; texte: string } | null
  onDismissErreur?: () => void
}) {
  const [texte, setTexte] = useState('')

  // Un envoi qui échoue ne doit pas faire perdre ce qui a été écrit : on le
  // remet dans le champ pour que le laveur n'ait qu'à cliquer de nouveau,
  // pas à retaper — surtout gênant pour qui vient de décrire un problème en
  // détail.
  useEffect(() => {
    if (erreur) setTexte(erreur.texte)
  }, [erreur])

  function envoyer(e: React.FormEvent) {
    e.preventDefault()
    const t = texte.trim()
    if (!t) return
    onEnvoyer(t)
    setTexte('')
  }

  return (
    <form onSubmit={envoyer} className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
      {erreur && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-400 leading-snug">{erreur.message}</p>
          <button
            type="button"
            onClick={onDismissErreur}
            aria-label="Masquer ce message"
            className="shrink-0 -m-1 w-7 h-7 flex items-center justify-center rounded-lg text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <label htmlFor="support-message" className="sr-only">Votre message à l&apos;équipe</label>
      <textarea
        id="support-message"
        value={texte}
        onChange={e => {
          setTexte(e.target.value)
          if (erreur) onDismissErreur?.()
        }}
        placeholder={placeholder}
        rows={2}
        className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1651E8] resize-none"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!texte.trim()}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-[#1651E8] hover:bg-[#0F4ACC] text-white text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          <Send size={15} /> Envoyer
        </button>
      </div>
    </form>
  )
}

/**
 * Cœur de l'interface « question à l'équipe » : liste des fils, écran de
 * nouvelle question, fil ouvert. UNE SEULE implémentation, partagée par le
 * panneau du Guide (SupportPanel, en boîte flottante) et la page plein écran
 * /dashboard/assistance — le projet s'est déjà fait piéger par une logique
 * dupliquée qui a divergé, on ne recommence pas ici.
 *
 * Ce composant ne connaît que le contenu : ni boîte modale, ni bouton
 * fermer, ni touche Échap. C'est à chaque hôte (SupportPanel, la page
 * Assistance) d'ajouter son propre habillage autour, et de décider quelle
 * vue afficher au départ (`vue` est entièrement piloté par l'appelant).
 */
export default function SupportConversation({
  threads,
  onSend,
  onOpenThread,
  sendError,
  onDismissSendError,
  vue,
  onVueChange,
  titleId,
  headerEnd,
}: {
  threads: SupportThread[]
  /** threadId à null pour une nouvelle question. Retourne l'id du fil (créé ou existant). */
  onSend: (texte: string, threadId: string | null) => string
  onOpenThread: (threadId: string) => void
  sendError?: SupportSendError | null
  onDismissSendError?: () => void
  vue: SupportVue
  onVueChange: (vue: SupportVue) => void
  /** Id posé sur le titre affiché — pour `aria-labelledby` côté modale (SupportPanel). */
  titleId?: string
  /** Élément affiché à droite de l'en-tête (ex. le bouton fermer de la modale) — inexistant en pleine page. */
  headerEnd?: React.ReactNode
}) {
  // Cas particulier d'une nouvelle question qui échoue : le fil optimiste a
  // déjà été retiré de `threads` côté appelant, mais on avait déjà basculé
  // sur sa vue « fil » pour montrer le message tout de suite. Sans ce
  // correctif, l'écran resterait bloqué sur un fil qui n'existe plus (rien à
  // afficher, pas de champ pour corriger et renvoyer). On revient sur
  // l'écran de saisie, où l'erreur et le texte perdu sont restitués juste en
  // dessous.
  useEffect(() => {
    if (!sendError) return
    if (vue.type === 'fil' && vue.id === sendError.threadId && !threads.some(t => t.id === sendError.threadId)) {
      onVueChange({ type: 'nouvelle' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendError, threads])

  function ouvrirFil(id: string) {
    onOpenThread(id)
    onDismissSendError?.()
    onVueChange({ type: 'fil', id })
  }

  function allerA(v: SupportVue) {
    onDismissSendError?.()
    onVueChange(v)
  }

  function envoyerDepuisComposer(texte: string) {
    const threadId = vue.type === 'fil' ? vue.id : null
    const id = onSend(texte, threadId)
    if (vue.type !== 'fil') onVueChange({ type: 'fil', id })
  }

  const filActif = vue.type === 'fil' ? threads.find(t => t.id === vue.id) : undefined
  const peutRevenirALaListe = threads.length > 0 && vue.type !== 'liste'

  // L'erreur ne s'affiche que sur l'écran où l'envoi a été tenté : le fil
  // visé s'il existe encore, sinon l'écran de saisie (cas ci-dessus).
  const erreurPourCetEcran = sendError && (
    (vue.type === 'fil' && vue.id === sendError.threadId) ||
    (vue.type === 'nouvelle' && !threads.some(t => t.id === sendError.threadId))
  ) ? { message: sendError.message, texte: sendError.texte } : null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
        {peutRevenirALaListe && (
          <button
            onClick={() => allerA({ type: 'liste' })}
            aria-label="Revenir à la liste des questions"
            className="shrink-0 w-11 h-11 -m-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id={titleId} className="font-bold text-slate-900 dark:text-white truncate">
              {vue.type === 'fil' && filActif ? filActif.title : vue.type === 'nouvelle' ? 'Nouvelle question' : 'Vos questions'}
            </h2>
            {filActif && <StatutBadge statut={filActif.status} />}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Une personne de l&apos;équipe vous répond en moins de 24&nbsp;h.
          </p>
        </div>

        {headerEnd}
      </div>

      {vue.type === 'liste' && (
        <div className="overflow-y-auto flex-1">
          <ListeFils
            threads={threads}
            onOuvrir={ouvrirFil}
            onNouvelle={() => allerA({ type: 'nouvelle' })}
          />
        </div>
      )}

      {vue.type === 'nouvelle' && (
        <>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-center py-6">
              <MessageCircle size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" aria-hidden />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Décrivez votre souci en quelques mots, on vous répond directement ici.
              </p>
            </div>
          </div>
          <Composer
            onEnvoyer={envoyerDepuisComposer}
            placeholder="Décrivez ce qui vous bloque…"
            erreur={erreurPourCetEcran}
            onDismissErreur={onDismissSendError}
          />
        </>
      )}

      {vue.type === 'fil' && filActif && (
        <>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {filActif.messages.map(m => (
              <div key={m.id} className={`flex ${m.from === 'laveur' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  m.from === 'laveur'
                    ? 'bg-[#1651E8] text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                }`}>
                  <span className="sr-only">{m.from === 'laveur' ? 'Vous' : 'Équipe NovaFlows'} : </span>
                  <p className="text-sm leading-[1.5] whitespace-pre-wrap">{m.text}</p>
                  <p className={`text-[10px] mt-1 ${m.from === 'laveur' ? 'text-blue-100/80' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatSupportDate(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Composer
            onEnvoyer={envoyerDepuisComposer}
            placeholder="Décrivez ce qui vous bloque…"
            erreur={erreurPourCetEcran}
            onDismissErreur={onDismissSendError}
          />
        </>
      )}
    </div>
  )
}
