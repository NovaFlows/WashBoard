'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Info } from 'lucide-react'
import type { SupportThread } from '@/lib/support'
import type { SupportSendError } from '@/lib/useSupportThreads'
import SupportConversation, { type SupportVue } from './SupportConversation'

// Combien de temps le rappel « retrouvez ça dans Assistance » (voir plus bas)
// reste affiché avant de s'effacer tout seul — assez pour être lu, pas assez
// pour devenir un bandeau permanent que Ryan ne voulait pas.
const DUREE_RAPPEL_ASSISTANCE_MS = 6000

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

  // Depuis le Guide, rien n'indique où retrouver la conversation une fois le
  // panneau refermé : ce rappel s'affiche juste après un envoi (nouvelle
  // question ou relance), le temps de le lire, puis disparaît de lui-même.
  const [vientDenvoyer, setVientDenvoyer] = useState(false)

  function envoyerEtSignaler(texte: string, threadId: string | null): string {
    const id = onSend(texte, threadId)
    setVientDenvoyer(true)
    return id
  }

  // À chaque ouverture, on repart de l'écran adapté à l'état courant.
  useEffect(() => {
    if (open) {
      setVue(threads.length === 0 ? { type: 'nouvelle' } : { type: 'liste' })
      setVientDenvoyer(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!vientDenvoyer) return
    const t = setTimeout(() => setVientDenvoyer(false), DUREE_RAPPEL_ASSISTANCE_MS)
    return () => clearTimeout(t)
  }, [vientDenvoyer])

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
          onSend={envoyerEtSignaler}
          onOpenThread={onOpenThread}
          sendError={sendError}
          onDismissSendError={onDismissSendError}
          vue={vue}
          onVueChange={setVue}
          banniere={vientDenvoyer && (
            <div role="status" className="flex items-start gap-2 mx-5 mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
              <Info size={16} className="text-[#1651E8] dark:text-[#6A9FFF] shrink-0 mt-0.5" aria-hidden />
              <p className="flex-1 text-xs text-blue-800 dark:text-blue-300 leading-snug">
                Vous retrouverez cette conversation dans <strong>Assistance</strong>, depuis le menu.
              </p>
              <button
                type="button"
                onClick={() => setVientDenvoyer(false)}
                aria-label="Masquer ce message"
                className="shrink-0 -m-1 w-7 h-7 flex items-center justify-center rounded-lg text-blue-600/70 dark:text-blue-400/70 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
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
