'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSupportThreads } from '@/lib/useSupportThreads'
import SupportConversation, { type SupportVue } from './SupportConversation'

/**
 * Page /dashboard/assistance : la même conversation que le panneau du Guide
 * (SupportConversation, partagé — voir ce fichier), mais en plein écran.
 * C'est ici, et seulement ici, qu'on atterrit :
 *  - depuis le menu (entrée « Assistance », juste sous « Guide ») ;
 *  - depuis un lien direct `?fil=<id>` (notification ou email envoyés au
 *    laveur quand l'équipe répond).
 *
 * Le bouton « Poser une question » du Guide, lui, continue d'ouvrir le
 * panneau flottant sur place (SupportPanel) — Ryan y tient, et rien n'oblige
 * à dupliquer la conversation pour ça : les deux partagent SupportConversation.
 */
export default function AssistanceContent() {
  const searchParams = useSearchParams()
  const filParam = searchParams.get('fil')

  const { threads, loaded, sendError, envoyerQuestion, ouvrirFil, dismissSendError } = useSupportThreads()

  const [vue, setVue] = useState<SupportVue>({ type: 'liste' })
  // La vue de départ ne peut être décidée qu'une fois les fils réellement
  // chargés (avant, `threads` est encore vide et un fil valide semblerait
  // introuvable). `applique` garantit que ça ne se fait qu'une fois : une
  // fois le laveur reparti vers la liste ou un autre fil, un rechargement de
  // `threads` (après un envoi, par ex.) ne doit pas le ramener de force vers
  // l'URL de départ.
  const applique = useRef(false)

  useEffect(() => {
    if (!loaded || applique.current) return
    applique.current = true

    if (filParam && threads.some(t => t.id === filParam)) {
      setVue({ type: 'fil', id: filParam })
      ouvrirFil(filParam)
      return
    }

    // Fil inconnu, déjà supprimé, ou appartenant à quelqu'un d'autre (la
    // liste chargée ici est déjà filtrée par laveur côté serveur) : on
    // retombe simplement sur la liste, sans message d'erreur — un lien de
    // notification périmé ne doit pas avoir l'air d'un incident.
    setVue(threads.length === 0 ? { type: 'nouvelle' } : { type: 'liste' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, threads])

  // Cette page EST déjà une conversation avec l'équipe : le bouton WhatsApp
  // flottant (DashboardShell) se disputerait le coin bas-droit avec le
  // bouton « Envoyer », même règle que le panneau du Guide (voir globals.css).
  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  return (
    // Pas de hauteur forcée : avec un seul fil (souvent le cas), une boîte
    // figée à 75 % de l'écran laisserait un grand vide sous la liste — la
    // page grandit avec son contenu et défile normalement, comme le reste du
    // tableau de bord. `min-h` évite juste que l'écran « Nouvelle question »
    // paraisse écrasé quand il n'y a encore aucun fil.
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-h-[420px] flex flex-col">
      <SupportConversation
        threads={threads}
        onSend={envoyerQuestion}
        onOpenThread={ouvrirFil}
        sendError={sendError}
        onDismissSendError={dismissSendError}
        vue={vue}
        onVueChange={setVue}
      />
    </div>
  )
}
