'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { SupportThread } from '@/lib/support'
import type { SupportSendError } from '@/lib/useSupportThreads'
import SupportConversation, { type SupportVue } from './SupportConversation'

/**
 * Panneau « Une question pour l'équipe », ouvert depuis le bouton du Guide.
 * Toute la logique d'affichage (liste, nouvelle question, fil) vit dans
 * SupportConversation — ce composant ne fournit que l'habillage : boîte
 * modale (feuille en bas d'écran sur mobile, boîte centrée sur desktop),
 * fermeture (croix, Échap, clic hors boîte), et la réinitialisation de
 * l'écran affiché à chaque réouverture.
 *
 * La page /dashboard/assistance affiche le même contenu en plein écran via
 * le même SupportConversation — jamais une deuxième implémentation de la
 * conversation elle-même.
 */
export default function SupportPanel({
  open,
  onClose,
  threads,
  onSend,
  onOpenThread,
  sendError,
  onDismissSendError,
}: {
  open: boolean
  onClose: () => void
  threads: SupportThread[]
  onSend: (texte: string, threadId: string | null) => string
  onOpenThread: (threadId: string) => void
  sendError?: SupportSendError | null
  onDismissSendError?: () => void
}) {
  // Premier usage : aucun fil -> droit à la saisie, pas de liste vide à montrer.
  const [vue, setVue] = useState<SupportVue>(threads.length === 0 ? { type: 'nouvelle' } : { type: 'liste' })
  const closeRef = useRef<HTMLButtonElement>(null)

  // À chaque ouverture, on repart de l'écran adapté à l'état courant.
  useEffect(() => {
    if (open) setVue(threads.length === 0 ? { type: 'nouvelle' } : { type: 'liste' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Le bouton WhatsApp flottant du tableau de bord (DashboardShell) partage le
  // coin bas-droit avec ce panneau, au même z-index : sans ça, il reste
  // au-dessus du bouton « Envoyer » et peut même capter le clic à sa place.
  // On le masque via une classe sur <body> (règle dans globals.css) plutôt
  // que de le déplacer ou de monter le panneau au-dessus de lui — il
  // resterait sinon visible en flottant sur la conversation. Le nettoyage au
  // démontage évite de le laisser masqué si ce composant disparaissait alors
  // que le panneau était encore ouvert.
  useEffect(() => {
    if (!open) return
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [open])

  if (!open) return null

  function fermer() {
    onDismissSendError?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-panel-titre"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={fermer}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <SupportConversation
          threads={threads}
          onSend={onSend}
          onOpenThread={onOpenThread}
          sendError={sendError}
          onDismissSendError={onDismissSendError}
          vue={vue}
          onVueChange={setVue}
          titleId="support-panel-titre"
          headerEnd={
            <button
              ref={closeRef}
              onClick={fermer}
              aria-label="Fermer"
              className="shrink-0 w-11 h-11 -m-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          }
        />
      </div>
    </div>
  )
}
