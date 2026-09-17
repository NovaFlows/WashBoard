// État et actions du canal de question laveur → équipe : chargement des
// fils, envoi (nouvelle question ou relance), marquage comme lu.
//
// Extrait de GuideContent (qui l'hébergeait seul jusqu'ici) pour que la page
// /dashboard/assistance et le panneau du Guide (SupportPanel) partagent EXACTEMENT
// la même logique — un envoi optimiste ou un marquage « lu » qui se
// comporterait différemment selon l'endroit d'où on l'appelle serait
// exactement le genre de divergence qui a déjà posé problème sur ce projet.

import { useCallback, useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import { deriveSupportSubject } from '@/lib/supportSubject'
import { notifySupportThreadRead } from '@/lib/supportUnread'
import type { SupportThread } from '@/lib/support'

export type SupportSendError = { threadId: string; texte: string; message: string }

export function useSupportThreads() {
  const [threads, setThreads] = useState<SupportThread[]>([])
  // Distingue « pas encore chargé » de « chargé, zéro fil » : un appelant qui
  // doit réagir une fois les fils connus (ex. ouvrir un fil visé par un lien
  // ?fil=...) ne peut pas s'y fier avant que ce soit vrai.
  const [loaded, setLoaded] = useState(false)
  // Échec du dernier envoi : à afficher près du champ de saisie concerné,
  // jamais en boîte système. Le texte est conservé pour que le laveur n'ait
  // pas à le retaper.
  const [sendError, setSendError] = useState<SupportSendError | null>(null)

  useEffect(() => {
    let annule = false
    fetch('/api/support/questions')
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) throw new Error(json?.error ?? 'Lecture impossible')
        if (!annule) setThreads(json.threads)
      })
      .catch(e => logger.error('support.threads_load_failed', {}, e))
      .finally(() => { if (!annule) setLoaded(true) })
    return () => { annule = true }
  }, [])

  // Écrit tout de suite dans l'état local (l'appelant peut naviguer vers le
  // fil avec l'id retourné ICI, avant toute réponse réseau), puis confirme en
  // tâche de fond. L'id d'un nouveau fil est généré côté client et transmis
  // au serveur pour qu'il l'utilise tel quel : sans ça, remplacer l'id
  // optimiste par celui de la base casserait la navigation qui continue de
  // chercher l'ancien id.
  const envoyerQuestion = useCallback((texte: string, threadId: string | null): string => {
    const id = threadId ?? crypto.randomUUID()
    const messageId = crypto.randomUUID()
    const message = { id: messageId, from: 'laveur' as const, text: texte, createdAt: new Date().toISOString() }

    setSendError(null) // une nouvelle tentative efface l'erreur précédente

    setThreads(ts => {
      if (threadId === null) {
        // Même fonction que côté serveur : la maquette optimiste et le titre
        // final ne peuvent pas diverger, elle est partagée telle quelle.
        const titre = deriveSupportSubject(texte)
        return [{ id, title: titre, status: 'ouverte', messages: [message] }, ...ts]
      }
      return ts.map(t => (t.id === id ? { ...t, status: 'ouverte', messages: [...t.messages, message] } : t)) // réécrire rouvre un fil résolu
    })

    const url = threadId === null ? '/api/support/questions' : `/api/support/questions/${id}`
    const payload = threadId === null ? { text: texte, questionId: id } : { text: texte }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json) {
          // Réponse du serveur reçue (ex. plafond de questions atteint,
          // message vide...) : ce message est déjà écrit pour être lu par le
          // laveur, on l'affiche tel quel plutôt qu'un texte générique qui
          // lui ferait croire à un problème de connexion.
          throw Object.assign(new Error(json?.error ?? 'Envoi impossible.'), { duServeur: true })
        }
        // Le serveur fait autorité sur le sujet déduit, le statut et les
        // horodatages exacts — l'id, lui, ne change jamais ici.
        setThreads(ts => ts.map(t => (t.id === id ? { ...json.thread, id } : t)))
      })
      .catch(e => {
        logger.error('support.send_failed', { threadId: id }, e)
        // Le message optimiste ne doit pas laisser croire qu'il est parti.
        setThreads(ts => threadId === null
          ? ts.filter(t => t.id !== id)
          : ts.map(t => (t.id === id ? { ...t, messages: t.messages.filter(m => m.id !== messageId) } : t)))
        // Distingue un refus du serveur (message déjà clair, ex. plafond
        // atteint) d'un échec réseau réel (fetch n'a même pas abouti), qui
        // seul mérite le texte générique « vérifiez votre connexion ».
        const message = e?.duServeur && typeof e.message === 'string'
          ? e.message
          : 'Votre message n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.'
        setSendError({ threadId: id, texte, message })
      })

    return id
  }, [])

  const ouvrirFil = useCallback((id: string) => {
    setThreads(ts => ts.map(t => (t.id === id ? { ...t, nonLue: false } : t)))
    // Décoratif (pastilles du menu) : on ne bloque pas sur la confirmation
    // serveur pour retirer le point tout de suite là où le laveur regarde.
    notifySupportThreadRead()
    fetch(`/api/support/questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
      .then(res => {
        if (!res.ok) logger.error('support.mark_read_failed', { threadId: id, status: res.status })
      })
      .catch(e => logger.error('support.mark_read_failed', { threadId: id }, e))
  }, [])

  const dismissSendError = useCallback(() => setSendError(null), [])

  return { threads, loaded, sendError, envoyerQuestion, ouvrirFil, dismissSendError }
}
